import type { Locator, Page } from "@playwright/test";

export type TradeMarketPath = "spot" | "futures";

/** Spot/futures trade screen — order entry aligns with `frontend/components/TradeOrderEntry.tsx`. */
export class TradePage {
    readonly page: Page;
    readonly market: TradeMarketPath;
    readonly heading: Locator;
    /** Root of `TradeOrderEntry` (card with "Order Entry" heading). Prefer this over `form` — a11y tree may not expose `form`. */
    readonly orderEntryCard: Locator;

    constructor(page: Page, market: TradeMarketPath) {
        this.page = page;
        this.market = market;
        const title = market === "spot" ? "Trade Spot" : "Trade Futures";
        this.heading = page.getByRole("heading", { level: 1, name: title });
        this.orderEntryCard = page.locator("div.rounded-xl").filter({ has: page.getByRole("heading", { name: "Order Entry" }) });
    }

    get path(): `/trade/${TradeMarketPath}` {
        return `/trade/${this.market}`;
    }

    /** Accessible names stay lowercase (`capitalize` is visual-only in the a11y tree). */
    orderTypeButton(type: "market" | "limit" | "stop-limit"): Locator {
        const label = type === "stop-limit" ? "stop limit" : type;
        return this.orderEntryCard.getByRole("button", { name: label, exact: true });
    }

    sideButton(side: "buy" | "sell"): Locator {
        const label = side === "buy" ? "Buy" : "Sell";
        return this.orderEntryCard.getByRole("button", { name: label, exact: true });
    }

    /** Amount / price / stop inputs — exclude the USD checkbox (`input[type="checkbox"]`). Includes text fallback after tests strip `type="number"` for NaN literals. */
    numberInputs(): Locator {
        return this.orderEntryCard.locator('input:not([type="checkbox"])');
    }

    amountInput(): Locator {
        return this.numberInputs().first();
    }

    priceInput(): Locator {
        return this.numberInputs().nth(1);
    }

    stopPriceInput(): Locator {
        return this.numberInputs().nth(2);
    }

    usdAmountCheckbox(): Locator {
        return this.orderEntryCard.getByRole("checkbox", { name: /in usd/i });
    }

    submitButton(): Locator {
        return this.orderEntryCard.getByRole("button", { name: "Submit", exact: true });
    }

    resetButton(): Locator {
        return this.orderEntryCard.getByRole("button", { name: "Reset", exact: true });
    }

    inlineError(): Locator {
        return this.orderEntryCard.locator("p.text-red-400");
    }

    successMessage(): Locator {
        return this.orderEntryCard.locator("p.text-emerald-400");
    }

    /** Sandbox/testing `<select>` on `TradeOrderEntry` (no `htmlFor`; single `select` in the card). */
    orderStatusTestingSelect(): Locator {
        return this.orderEntryCard.locator("select");
    }
}
