/**
 * TC-UI-01 (KAN-65) — client validation messages from `frontend/lib/tradeOrderValidation.ts` surfaced
 * via `TradeOrderEntry` (`setError` → inline `<p className="text-sm text-red-400">`).
 *
 * Rows mirror `validateAmount`, `validatePrice`, balance checks, and stop-limit guard in `TradeOrderEntry`.
 */
import type { Page } from "@playwright/test";
import * as allure from "allure-js-commons";
import { expect, test } from "../../src/fixtures";
import type { TradePage } from "../../src/pages/trade.page";
import { openTradePageWithApiUser, registerTestUserViaApi } from "../../src/utils/users";

/** Expected copy aligned with `tradeOrderValidation.ts` (avoid diverging via re-export from app). */
const TradeValidationMessages = {
    amountRequired: "Amount is required",
    amountTooSmall: "Amount must be greater than 0",
    maxAmount: /^Maximum amount is [\d,]+$/,
    maxDecimals: "Maximum 8 decimal places",
    priceRequired: "Price is required",
    priceNotPositive: "Price must be greater than 0",
    insufficientUsd: /^Insufficient USD balance\. Available: [\d,.]+$/,
    insufficientBtc: /^Insufficient BTC balance\. Available: [\d,.]+$/,
    stopLimitUnsupported: "Stop-limit orders are not yet supported. Use limit order.",
} as const;

type Row = {
    name: string;
    setup: (trade: TradePage, page: Page) => Promise<void>;
    assert: (trade: TradePage) => Promise<void>;
};

export const tradeOrderValidationRows: Row[] = [
    {
        name: `${TradeValidationMessages.amountRequired}: Empty amount blocks submit or shows React message`,
        setup: async (trade: TradePage, _page: Page) => {
            await trade.orderTypeButton("market").click();
            await trade.sideButton("buy").click();
            await trade.amountInput().fill("");
        },
        assert: async (trade) => {
            await trade.submitButton().click();
            if (await trade.inlineError().isVisible()) {
                await expect(trade.inlineError()).toHaveText(TradeValidationMessages.amountRequired);
            } else {
                await expect(trade.amountInput()).toHaveJSProperty("validity.valueMissing", true);
            }
        },
    },
    {
        name: `${TradeValidationMessages.amountTooSmall}: Positive amount below minimum [Boundary]`,
        setup: async (trade: TradePage, _page: Page) => {
            await trade.orderTypeButton("market").click();
            await trade.sideButton("buy").click();
            await trade.amountInput().fill("0.000000001");
        },
        assert: async (trade) => {
            await trade.submitButton().click();
            await expect(trade.inlineError()).toHaveText(TradeValidationMessages.amountTooSmall);
        },
    },
    {
        name: `${TradeValidationMessages.amountTooSmall}: Zero amount`,
        setup: async (trade: TradePage, _page: Page) => {
            await trade.orderTypeButton("market").click();
            await trade.sideButton("buy").click();
            await trade.amountInput().fill("0");
        },
        assert: async (trade) => {
            await trade.submitButton().click();
            await expect(trade.inlineError()).toHaveText(TradeValidationMessages.amountTooSmall);
        },
    },
    {
        name: `${String(TradeValidationMessages.maxAmount)}: Amount above maximum [Boundary]`,
        setup: async (trade: TradePage, _page: Page) => {
            await trade.orderTypeButton("market").click();
            await trade.sideButton("buy").click();
            await trade.amountInput().fill("2000000");
        },
        assert: async (trade) => {
            await trade.submitButton().click();
            await expect(trade.inlineError()).toHaveText(TradeValidationMessages.maxAmount);
        },
    },
    {
        name: `${TradeValidationMessages.maxDecimals}: Nine fractional digits`,
        setup: async (trade: TradePage, _page: Page) => {
            await trade.orderTypeButton("market").click();
            await trade.sideButton("buy").click();
            await trade.amountInput().fill(`0.${"1".repeat(9)}`);
        },
        assert: async (trade) => {
            await trade.submitButton().click();
            await expect(trade.inlineError()).toHaveText(TradeValidationMessages.maxDecimals);
        },
    },
    {
        name: `${TradeValidationMessages.priceRequired}: Limit order with empty price`,
        setup: async (trade: TradePage, _page: Page) => {
            await trade.orderTypeButton("limit").click();
            await trade.sideButton("buy").click();
            await trade.amountInput().fill("0.01");
            await trade.priceInput().fill("");
        },
        assert: async (trade) => {
            await trade.submitButton().click();
            if (await trade.inlineError().isVisible()) {
                await expect(trade.inlineError()).toHaveText(TradeValidationMessages.priceRequired);
            } else {
                await expect(trade.priceInput()).toHaveJSProperty("validity.valueMissing", true);
            }
        },
    },
    {
        name: `${String(TradeValidationMessages.insufficientBtc)}: Market sell exceeds BTC wallet`,
        setup: async (trade: TradePage, _page: Page) => {
            await trade.orderTypeButton("market").click();
            await trade.sideButton("sell").click();
            await trade.amountInput().fill("1");
        },
        assert: async (trade) => {
            await trade.submitButton().click();
            await expect(trade.inlineError()).toHaveText(TradeValidationMessages.insufficientBtc);
        },
    },
    {
        name: `${TradeValidationMessages.priceNotPositive}: Limit price zero`,
        setup: async (trade: TradePage, _page: Page) => {
            await trade.orderTypeButton("limit").click();
            await trade.sideButton("buy").click();
            await trade.amountInput().fill("0.01");
            await trade.priceInput().fill("0");
        },
        assert: async (trade) => {
            await trade.submitButton().click();
            await expect(trade.inlineError()).toHaveText(TradeValidationMessages.priceNotPositive);
        },
    },
    {
        name: `${String(TradeValidationMessages.insufficientUsd)}: Market buy exceeds USD wallet`,
        setup: async (trade: TradePage, _page: Page) => {
            await trade.orderTypeButton("market").click();
            await trade.sideButton("buy").click();
            await trade.amountInput().fill("2");
        },
        assert: async (trade) => {
            await trade.submitButton().click();
            await expect(trade.inlineError()).toHaveText(TradeValidationMessages.insufficientUsd);
        },
    },
    {
        name: `${TradeValidationMessages.stopLimitUnsupported}: Submit stop-limit without server support`,
        setup: async (trade: TradePage, _page: Page) => {
            await trade.orderTypeButton("stop-limit").click();
            await trade.sideButton("buy").click();
            await trade.amountInput().fill("0.01");
            await trade.priceInput().fill("50000");
            await trade.stopPriceInput().fill("49000");
        },
        assert: async (trade) => {
            await trade.submitButton().click();
            await expect(trade.inlineError()).toHaveText(TradeValidationMessages.stopLimitUnsupported);
        },
    },
];

test.describe("Trade order entry validation (client)", { tag: ["@client-validation", "@merge-gate"] }, () => {
    test.beforeEach(async () => {
        await allure.epic("Trading");
        await allure.feature("Order entry client validation");
    });

    for (const row of tradeOrderValidationRows) {
        test(row.name, async ({ page, request, authApi, userFactory, pages }) => {
            const testUser = await registerTestUserViaApi(request, authApi, userFactory, `UI KAN-65 TC-UI-01 ${Date.now()}`);
            const trade = pages.tradeSpot;
            await openTradePageWithApiUser(page, trade, testUser);
            await trade.orderEntryCard.waitFor({ state: "visible" });
            await row.setup(trade, page);
            await row.assert(trade);
        });
    }
});
