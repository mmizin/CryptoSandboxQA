/**
 * KAN-74 / TC-UI-01 — Deposit cash client validation (`DepositCashForm`).
 */
import { test, expect } from "../../src/fixtures";
import type { TestUser } from "../../src/models/user/TestUser";
import { registerTestUserViaApi } from "../../src/utils/users";

/** Mirrors `frontend/lib/depositCashValidation.ts` (avoid importing that module — it uses `@/` aliases). */
const MSG = {
    amountRequired: "Amount is required",
    amountNaN: "Amount must be a number",
    amountMin: "Minimum amount is 1",
    amountMax: "Maximum amount is 50000",
    decimals2: "Maximum 2 decimal places",
    applePaySoon: "Apple Pay integration coming soon",
    ibanRequired: "IBAN is required",
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

test.describe("Deposit cash validation", { tag: ["@client-validation", "@merge-gate"] }, () => {
    let user: TestUser;

    test.beforeEach(async ({ request, authApi, userFactory }) => {
        user = await registerTestUserViaApi(request, authApi, userFactory, `KAN-74 cash ${Date.now()}`);
    });

    test("Amount is required (empty)", async ({ page }) => {
        await openDepositPage(page, user);
        const cash = page.locator("section").filter({ hasText: "USD, EUR, and other fiat via card or SEPA" });

        await cash.getByLabel("Amount").fill("");
        await cash.getByPlaceholder("4111 1111 1111 1111").fill("4111111111111111");
        await cash.getByPlaceholder("12/28").fill("12/99");
        await cash.getByPlaceholder("123").fill("123");
        await cash.getByRole("button", { name: "Deposit" }).click();
        await expect(cash.getByText(MSG.amountRequired)).toBeVisible();
        await expect(cash.getByRole("button", { name: "Deposit" })).toBeDisabled();
    });

    test("Amount must be a number", async ({ page }) => {
        await openDepositPage(page, user);
        const cash = page.locator("section").filter({ hasText: "USD, EUR, and other fiat via card or SEPA" });
        const amt = cash.getByLabel("Amount");
        await amt.fill("abc");
        await cash.getByPlaceholder("4111 1111 1111 1111").fill("4111111111111111");
        await cash.getByPlaceholder("12/28").fill("12/99");
        await cash.getByPlaceholder("123").fill("123");
        await cash.getByRole("button", { name: "Deposit" }).click();
        await expect(cash.getByText(MSG.amountNaN)).toBeVisible();
        await expect(cash.getByRole("button", { name: "Deposit" })).toBeDisabled();
    });

    test("Minimum amount is 1 (zero)", async ({ page }) => {
        await openDepositPage(page, user);
        const cash = page.locator("section").filter({ hasText: "USD, EUR, and other fiat via card or SEPA" });
        await cash.getByLabel("Amount").fill("0");
        await cash.getByPlaceholder("4111 1111 1111 1111").fill("4111111111111111");
        await cash.getByPlaceholder("12/28").fill("12/99");
        await cash.getByPlaceholder("123").fill("123");
        await cash.getByRole("button", { name: "Deposit" }).click();
        await expect(cash.getByText(MSG.amountMin)).toBeVisible();
    });

    test("Minimum amount is 1 (0.5)", async ({ page }) => {
        await openDepositPage(page, user);
        const cash = page.locator("section").filter({ hasText: "USD, EUR, and other fiat via card or SEPA" });
        await cash.getByLabel("Amount").fill("0.5");
        await cash.getByPlaceholder("4111 1111 1111 1111").fill("4111111111111111");
        await cash.getByPlaceholder("12/28").fill("12/99");
        await cash.getByPlaceholder("123").fill("123");
        await cash.getByRole("button", { name: "Deposit" }).click();
        await expect(cash.getByText(MSG.amountMin)).toBeVisible();
    });

    test("Maximum amount is 50000", async ({ page }) => {
        await openDepositPage(page, user);
        const cash = page.locator("section").filter({ hasText: "USD, EUR, and other fiat via card or SEPA" });
        await cash.getByLabel("Amount").fill("50001");
        await cash.getByPlaceholder("4111 1111 1111 1111").fill("4111111111111111");
        await cash.getByPlaceholder("12/28").fill("12/99");
        await cash.getByPlaceholder("123").fill("123");
        await cash.getByRole("button", { name: "Deposit" }).click();
        await expect(cash.getByText(MSG.amountMax)).toBeVisible();
    });

    test("Maximum 2 decimal places", async ({ page }) => {
        await openDepositPage(page, user);
        const cash = page.locator("section").filter({ hasText: "USD, EUR, and other fiat via card or SEPA" });
        await cash.getByLabel("Amount").fill("10.123");
        await cash.getByPlaceholder("4111 1111 1111 1111").fill("4111111111111111");
        await cash.getByPlaceholder("12/28").fill("12/99");
        await cash.getByPlaceholder("123").fill("123");
        await cash.getByRole("button", { name: "Deposit" }).click();
        await expect(cash.getByText(MSG.decimals2)).toBeVisible();
    });

    test("Apple Pay blocked message", async ({ page }) => {
        await openDepositPage(page, user);
        const cash = page.locator("section").filter({ hasText: "USD, EUR, and other fiat via card or SEPA" });
        await cash.getByLabel("Amount").fill("100");
        await cash.getByRole("button", { name: "Apple Pay" }).click();
        await expect(
            cash.locator("p.text-red-400").filter({ hasText: MSG.applePaySoon }),
        ).toBeVisible();
        await expect(cash.getByRole("button", { name: "Deposit" })).toBeDisabled();
    });

    test("SEPA IBAN required", async ({ page }) => {
        await openDepositPage(page, user);
        const cash = page.locator("section").filter({ hasText: "USD, EUR, and other fiat via card or SEPA" });
        await cash.getByLabel("Amount").fill("100");
        await cash.getByRole("button", { name: "SEPA" }).click();
        await cash.getByLabel("Account holder name").fill("Test User");
        await cash.getByLabel("IBAN").fill("");
        await cash.getByRole("button", { name: "Deposit" }).click();
        await expect(cash.getByText(MSG.ibanRequired)).toBeVisible();
    });
});
