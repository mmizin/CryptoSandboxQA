import type { Locator, Page } from "@playwright/test";

/** Matches `data-testid` on sortable chart cards in `DashboardCharts.tsx`. */
export const CHART_BLOCK_TEST_IDS = [
    "chart-balance-pie",
    "chart-balance-bar",
    "chart-progress",
    "chart-line-trend",
    "chart-area-portfolio",
    "chart-radar",
] as const;

/** Expected number of Portfolio Analytics chart cards (matches `CHART_TEST_ID_TO_BLOCK_ID` / app `ANALYTICS_BLOCK_IDS`). */
export const CHART_BLOCK_COUNT = CHART_BLOCK_TEST_IDS.length;

export type ChartBlockTestId = (typeof CHART_BLOCK_TEST_IDS)[number];

/**
 * Dashboard — Portfolio Analytics lives under `data-testid="dashboard-charts"`.
 */
export class DashboardPage {
    readonly page: Page;
    readonly portfolioSection: Locator;
    readonly customizeLayoutButton: Locator;

    constructor(page: Page) {
        this.page = page;
        this.portfolioSection = page.getByTestId("dashboard-charts");
        this.customizeLayoutButton = page.getByTestId("customize-analytics-layout");
    }

    chartBlock(testId: ChartBlockTestId): Locator {
        return this.page.getByTestId(testId);
    }

    /** Sortable chart card roots in DOM order (excludes inner nodes like `chart-empty-state`). */
    chartBlocksInOrder(): Locator {
        const selector = CHART_BLOCK_TEST_IDS.map((id) => `[data-testid="${id}"]`).join(", ");
        return this.portfolioSection.locator(selector);
    }
}
