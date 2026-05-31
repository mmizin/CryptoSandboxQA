/**
 * KAN-75 / TC-UI-02 — Deposit crypto client validation (`DepositCryptoForm`).
 */
import * as allure from "allure-js-commons";
import { test, expect } from "@/fixtures";
import type { TestUser } from "@/models/user/TestUser";
import { registerTestUserViaApi } from "@/utils/users";

/** Mirrors `frontend/lib/depositCryptoValidation.ts` (avoid `@/` re-exports from that file). */
const MSG = {
    amountRequired: "Amount is required",
    min: "Minimum amount is 0.00001",
    max: "Maximum amount is 100",
    decimals8: "Maximum 8 decimal places",
} as const;

async function openDepositPage(page: import("@playwright/test").Page, user: TestUser): Promise<void> {
    await page.addInitScript(
        ({ token }: { token: string }) => {
            localStorage.setItem("token", token);
        },
        { token: user.accessToken },
    );
    await page.goto("/assets/deposit");
    await expect(page.getByRole("heading", { name: "Deposit" })).toBeVisible();
}

test.describe("Deposit crypto validation", { tag: ["@client-validation", "@merge-gate"] }, () => {
    let user: TestUser;

    test.beforeEach(async ({ request, authApi, userFactory }) => {
        await allure.epic("Payments");
        await allure.feature("Deposit crypto client validation");
        user = await registerTestUserViaApi(request, authApi, userFactory, `KAN-75 crypto ${Date.now()}`);
    });

    test("Amount is required", async ({ page }) => {
        await openDepositPage(page, user);
        await page.getByRole("button", { name: "Deposit crypto" }).click();
        const crypto = page.locator("section").filter({ hasText: "BTC, ETH, and more to your sandbox wallet" });
        await expect(crypto.getByRole("combobox")).toBeVisible();
        await crypto.getByLabel("Amount to deposit").fill("");
        await crypto.getByRole("button", { name: "Deposit" }).click();
        await expect(crypto.getByText(MSG.amountRequired).first()).toBeVisible();
    });

    test("Minimum crypto amount", async ({ page }) => {
        await openDepositPage(page, user);
        await page.getByRole("button", { name: "Deposit crypto" }).click();
        const crypto = page.locator("section").filter({ hasText: "BTC, ETH, and more to your sandbox wallet" });
        await crypto.getByLabel("Amount to deposit").fill("0.000001");
        await crypto.getByRole("button", { name: "Deposit" }).click();
        await expect(crypto.getByText(MSG.min)).toBeVisible();
    });

    test("Maximum crypto amount", async ({ page }) => {
        await openDepositPage(page, user);
        await page.getByRole("button", { name: "Deposit crypto" }).click();
        const crypto = page.locator("section").filter({ hasText: "BTC, ETH, and more to your sandbox wallet" });
        await crypto.getByLabel("Amount to deposit").fill("101");
        await crypto.getByRole("button", { name: "Deposit" }).click();
        await expect(crypto.getByText(MSG.max)).toBeVisible();
    });

    test("Maximum 8 decimal places", async ({ page }) => {
        await openDepositPage(page, user);
        await page.getByRole("button", { name: "Deposit crypto" }).click();
        const crypto = page.locator("section").filter({ hasText: "BTC, ETH, and more to your sandbox wallet" });
        await crypto.getByLabel("Amount to deposit").fill("1.123456789");
        await crypto.getByRole("button", { name: "Deposit" }).click();
        await expect(crypto.getByText(MSG.decimals8)).toBeVisible();
    });

    // KAN-75 row "No crypto selected": CryptoSearchSelect does not clear parent `crypto` to '' via UI — not automatable without product change.
});
