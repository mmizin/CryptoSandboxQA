import type { ChartBlockTestId } from "../pages/dashboard.page";

/** `data-testid` → `AnalyticsBlockId` in session JSON (`portfolio-analytics-block-order`). */
export const CHART_TEST_ID_TO_BLOCK_ID: Record<ChartBlockTestId, string> = {
    "chart-balance-pie": "balance-pie",
    "chart-balance-bar": "balance-bar",
    "chart-progress": "portfolio-health",
    "chart-line-trend": "line-trend",
    "chart-area-portfolio": "area-portfolio",
    "chart-radar": "radar-allocation",
};

export function chartTestIdsToBlockIds(testIds: string[]): string[] {
    return testIds.map((id) => {
        const block = CHART_TEST_ID_TO_BLOCK_ID[id as ChartBlockTestId];
        if (block === undefined) {
            throw new Error(`Unknown chart data-testid: ${id}`);
        }
        return block;
    });
}
