import type { Page, TestInfo } from "@playwright/test";
import * as allure from "allure-js-commons";
import { expect, test } from "@/fixtures";
import { CHART_BLOCK_COUNT, type DashboardPage } from "@/pages/dashboard.page";
import { arrayMove } from "@/utils/array-move";
import { chartTestIdsToBlockIds } from "@/utils/portfolio-analytics-charts";
import {
    combineSeed,
    createMulberry32,
    getSeedFromEnv,
    pickDistinctIndices,
} from "@/utils/seeded-random";
import { openDashboardWithApiUser, registerTestUserViaApi } from "@/utils/users";

/** Same key as `PORTFOLIO_ANALYTICS_ORDER_KEY` in `frontend/components/DashboardCharts.tsx`. */
const PORTFOLIO_ANALYTICS_ORDER_KEY = "portfolio-analytics-block-order";

type RandomDragPlan = {
    baseSeed: number;
    effectiveSeed: number;
    envSeed: string | null;
    from: number;
    to: number;
    initialOrder: string[];
    expectedOrder: string[];
};

async function chartTestIdsInDomOrder(dashboard: DashboardPage): Promise<string[]> {
    return dashboard.chartBlocksInOrder().evaluateAll((els) =>
        els.map((el) => el.getAttribute("data-testid")).filter((id): id is string => id != null),
    );
}

function dragPlanSalt(testInfo: TestInfo): string {
    return testInfo.titlePath.join(" › ");
}

async function prepareRandomDragPlan(dashboard: DashboardPage, testInfo: TestInfo): Promise<RandomDragPlan> {
    const baseSeed = getSeedFromEnv();
    const effectiveSeed = combineSeed(baseSeed, dragPlanSalt(testInfo));
    const rng = createMulberry32(effectiveSeed);
    const initialOrder = await chartTestIdsInDomOrder(dashboard);
    const { from, to } = pickDistinctIndices(rng, initialOrder.length);
    const expectedOrder = arrayMove(initialOrder, from, to);
    return {
        baseSeed,
        effectiveSeed,
        envSeed: process.env.PLAYWRIGHT_RANDOM_SEED ?? process.env.TEST_RANDOM_SEED ?? null,
        from,
        to,
        initialOrder,
        expectedOrder,
    };
}

/**
 * Per-segment pointer path. One long dragTo across the grid is flaky in Firefox (closestCenter picks a wrong cell).
 * Moving the same card step-by-step via neighbors matches arrayMove and keeps each drag short/reliable.
 */
const CHART_DRAG_STEPS = 75;
const CHART_DRAG_STEPS_FIREFOX = 110;

/** Brief settle after pointerup so React/dnd-kit can commit before we poll the DOM. */
const CHART_DRAG_SETTLE_MS = 120;

/** At most (n-1) moves per direction for n chart cards; extra headroom for retries. */
const MAX_ADJACENT_CHART_MOVES = 16;

/**
 * After drag ends, React state + sessionStorage can lag behind the pointer. Prefer polling over a fixed sleep.
 */
const CHART_REORDER_STABLE_TIMEOUT_MS = 15_000;
const CHART_REORDER_POLL_INTERVALS_MS = [50, 100, 200, 400, 800];

function chartDragStepsForBrowser(page: Page): number {
    const name = page.context().browser()?.browserType().name() ?? "";
    return name === "firefox" ? CHART_DRAG_STEPS_FIREFOX : CHART_DRAG_STEPS;
}

async function settleAfterChartDrag(page: Page): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, CHART_DRAG_SETTLE_MS));
}

async function dragChartOntoNeighbor(page: Page, sourceTestId: string, neighborTestId: string): Promise<void> {
    const source = page.getByTestId(sourceTestId);
    const target = page.getByTestId(neighborTestId);
    await source.scrollIntoViewIfNeeded();
    await target.scrollIntoViewIfNeeded();
    const sBox = await source.boundingBox();
    const tBox = await target.boundingBox();
    const steps = chartDragStepsForBrowser(page);
    if (sBox && tBox) {
        await source.dragTo(target, {
            steps,
            sourcePosition: { x: sBox.width / 2, y: sBox.height / 2 },
            targetPosition: { x: tBox.width / 2, y: tBox.height / 2 },
        });
    } else {
        await source.dragTo(target, { steps });
    }
}

/**
 * Reorders by repeated adjacent drags (same end state as one arrayMove(from, to) in the app).
 */
async function executeDragPlan(dashboard: DashboardPage, plan: RandomDragPlan): Promise<void> {
    const page = dashboard.page;
    const movingId = plan.initialOrder[plan.from];
    const targetIndex = plan.to;

    let guard = 0;
    while (guard++ < MAX_ADJACENT_CHART_MOVES) {
        const order = await chartTestIdsInDomOrder(dashboard);
        const currentIdx = order.indexOf(movingId);
        if (currentIdx === -1) {
            throw new Error(`Chart block ${movingId} not found in DOM order`);
        }
        if (currentIdx === targetIndex) {
            return;
        }

        const neighborId = currentIdx < targetIndex ? order[currentIdx + 1]! : order[currentIdx - 1]!;
        const expectedNextIdx = currentIdx < targetIndex ? currentIdx + 1 : currentIdx - 1;

        let neighborAttempts = 0;
        const maxNeighborAttempts = 4;
        while (neighborAttempts < maxNeighborAttempts) {
            await dragChartOntoNeighbor(page, movingId, neighborId);
            await settleAfterChartDrag(page);

            const idxAfter = (await chartTestIdsInDomOrder(dashboard)).indexOf(movingId);
            if (idxAfter === expectedNextIdx) {
                break;
            }
            if (idxAfter === currentIdx) {
                neighborAttempts += 1;
                continue;
            }
            throw new Error(
                `Adjacent chart drag moved ${movingId} from index ${currentIdx} to ${idxAfter}, expected ${expectedNextIdx}`,
            );
        }
        if (neighborAttempts >= maxNeighborAttempts) {
            throw new Error(
                `Adjacent drag did not move ${movingId} from index ${currentIdx} toward ${expectedNextIdx} after ${maxNeighborAttempts} tries`,
            );
        }
    }

    throw new Error(
        `Adjacent chart drag did not reach target index after ${MAX_ADJACENT_CHART_MOVES} moves (card ${movingId} → index ${targetIndex})`,
    );
}

async function expectChartOrderOrAttachDebug(
    testInfo: TestInfo,
    plan: RandomDragPlan,
    actualOrder: string[],
): Promise<void> {
    const debugPayload = {
        ...plan,
        actualOrder,
    };
    try {
        expect(actualOrder).toEqual(plan.expectedOrder);
    } catch (e) {
        await testInfo.attach("portfolio-drag-reorder-debug.json", {
            body: Buffer.from(JSON.stringify(debugPayload, null, 2), "utf-8"),
            contentType: "application/json",
        });
        throw e;
    }
}

async function expectSessionStorageOrderOrAttachDebug(
    testInfo: TestInfo,
    plan: RandomDragPlan,
    parsed: string[],
    expectedBlockIds: string[],
): Promise<void> {
    try {
        expect(parsed).toEqual(expectedBlockIds);
    } catch (e) {
        await testInfo.attach("portfolio-session-storage-debug.json", {
            body: Buffer.from(
                JSON.stringify(
                    {
                        ...plan,
                        sessionStorageOrder: parsed,
                        expectedBlockIds,
                    },
                    null,
                    2,
                ),
                "utf-8",
            ),
            contentType: "application/json",
        });
        throw e;
    }
}

async function expectChartOrderStable(
    dashboard: DashboardPage,
    testInfo: TestInfo,
    plan: RandomDragPlan,
): Promise<void> {
    try {
        await expect
            .poll(async () => chartTestIdsInDomOrder(dashboard), {
                timeout: CHART_REORDER_STABLE_TIMEOUT_MS,
                intervals: CHART_REORDER_POLL_INTERVALS_MS,
            })
            .toEqual(plan.expectedOrder);
    } catch {
        const actualOrder = await chartTestIdsInDomOrder(dashboard);
        await expectChartOrderOrAttachDebug(testInfo, plan, actualOrder);
    }
}

async function expectSessionStorageOrderStable(
    page: Page,
    testInfo: TestInfo,
    plan: RandomDragPlan,
    expectedBlockIds: string[],
): Promise<void> {
    try {
        await expect
            .poll(
                async () => {
                    const raw = await page.evaluate((key) => sessionStorage.getItem(key), PORTFOLIO_ANALYTICS_ORDER_KEY);
                    if (!raw) return null;
                    return JSON.parse(raw) as string[];
                },
                {
                    timeout: CHART_REORDER_STABLE_TIMEOUT_MS,
                    intervals: CHART_REORDER_POLL_INTERVALS_MS,
                },
            )
            .toEqual(expectedBlockIds);
    } catch {
        const raw = await page.evaluate((key) => sessionStorage.getItem(key), PORTFOLIO_ANALYTICS_ORDER_KEY);
        const parsed = raw ? (JSON.parse(raw) as string[]) : [];
        await expectSessionStorageOrderOrAttachDebug(testInfo, plan, parsed, expectedBlockIds);
    }
}

test.describe("Portfolio Analytics layout", { tag: ["@e2e"] }, () => {
    test.beforeEach(async () => {
        await allure.epic("Portfolio");
        await allure.feature("Analytics layout UI");
    });

    test(
        "dragging two random chart cards reorders the grid to match arrayMove",
        { tag: ["@smoke", "@merge-gate"] },
        async ({ page, request, authApi, userFactory, pages }, testInfo) => {
            const testUser = await registerTestUserViaApi(
                request,
                authApi,
                userFactory,
                "Portfolio analytics drag reorder",
            );
            const { dashboard } = pages;
            await openDashboardWithApiUser(page, dashboard, testUser);
            await dashboard.portfolioSection.scrollIntoViewIfNeeded();
            await dashboard.customizeLayoutButton.click();
            await expect(dashboard.customizeLayoutButton).toHaveText("Done customizing");

            const plan = await prepareRandomDragPlan(dashboard, testInfo);

            await test.step(`drag index ${plan.from} → ${plan.to} (baseSeed=${plan.baseSeed})`, async () => {
                await executeDragPlan(dashboard, plan);
            });

            await expectChartOrderStable(dashboard, testInfo, plan);
        },
    );

    test("reordered layout persists for the tab after reload", async (
        { page, request, authApi, userFactory, pages },
        testInfo,
    ) => {
        const testUser = await registerTestUserViaApi(
            request,
            authApi,
            userFactory,
            "Portfolio analytics session persist",
        );
        const { dashboard } = pages;
        await openDashboardWithApiUser(page, dashboard, testUser);
        await dashboard.portfolioSection.scrollIntoViewIfNeeded();
        await dashboard.customizeLayoutButton.click();

        const plan = await prepareRandomDragPlan(dashboard, testInfo);

        await test.step(`drag index ${plan.from} → ${plan.to} (baseSeed=${plan.baseSeed})`, async () => {
            await executeDragPlan(dashboard, plan);
        });

        const expectedBlockIds = chartTestIdsToBlockIds(plan.expectedOrder);
        await expectSessionStorageOrderStable(page, testInfo, plan, expectedBlockIds);

        await page.reload();
        await dashboard.customizeLayoutButton.waitFor({ state: "visible" });
        await expect(dashboard.chartBlocksInOrder()).toHaveCount(CHART_BLOCK_COUNT, { timeout: 15_000 });
        await expect
            .poll(async () => (await chartTestIdsInDomOrder(dashboard)).length, { timeout: 15_000 })
            .toBe(CHART_BLOCK_COUNT);

        await expectChartOrderStable(dashboard, testInfo, plan);
    });
});
