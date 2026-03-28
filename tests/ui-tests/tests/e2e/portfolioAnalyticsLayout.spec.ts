import type { TestInfo } from "@playwright/test";
import { expect, test } from "../../src/fixtures";
import { CHART_BLOCK_COUNT, type DashboardPage } from "../../src/pages/dashboard.page";
import { arrayMove } from "../../src/utils/array-move";
import { chartTestIdsToBlockIds } from "../../src/utils/portfolio-analytics-charts";
import {
    combineSeed,
    createMulberry32,
    getSeedFromEnv,
    pickDistinctIndices,
} from "../../src/utils/seeded-random";
import { openDashboardWithApiUser, registerTestUserViaApi } from "../../src/utils/users";

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

async function executeDragPlan(dashboard: DashboardPage, plan: RandomDragPlan): Promise<void> {
    const source = dashboard.page.getByTestId(plan.initialOrder[plan.from]);
    const target = dashboard.page.getByTestId(plan.initialOrder[plan.to]);
    await source.dragTo(target, { steps: 15 });
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

test.describe("Portfolio Analytics layout", { tag: ["@e2e"] }, () => {
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

            const actual = await chartTestIdsInDomOrder(dashboard);
            await expectChartOrderOrAttachDebug(testInfo, plan, actual);
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

        await expect
            .poll(async () => page.evaluate((key) => sessionStorage.getItem(key), PORTFOLIO_ANALYTICS_ORDER_KEY))
            .not.toBeNull();

        const stored = await page.evaluate((key) => sessionStorage.getItem(key), PORTFOLIO_ANALYTICS_ORDER_KEY);
        const parsed = JSON.parse(stored!) as string[];
        const expectedBlockIds = chartTestIdsToBlockIds(plan.expectedOrder);
        await expectSessionStorageOrderOrAttachDebug(testInfo, plan, parsed, expectedBlockIds);

        await page.reload();
        await dashboard.customizeLayoutButton.waitFor({ state: "visible" });
        await expect(dashboard.chartBlocksInOrder()).toHaveCount(CHART_BLOCK_COUNT, { timeout: 15_000 });
        await expect
            .poll(async () => (await chartTestIdsInDomOrder(dashboard)).length, { timeout: 15_000 })
            .toBe(CHART_BLOCK_COUNT);

        const idsAfterReload = await chartTestIdsInDomOrder(dashboard);
        await expectChartOrderOrAttachDebug(testInfo, plan, idsAfterReload);
    });
});
