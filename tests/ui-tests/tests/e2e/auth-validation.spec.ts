import { expect, test } from "../../src/fixtures";

/** Must match `AuthMessages` in frontend/lib/authFieldConstraints.ts */
const MSG = {
    emailInvalid: "Enter a valid email address",
    passwordTooShort: "Password must be at least 6 characters",
    displayNameTooLong: "Display name must be at most 100 characters",
    resetCodeDigits: "Reset code must be 8 digits",
} as const;

test.describe("Auth form client validation", () => {
    test("login rejects invalid email before API call", async ({ page }) => {
        await page.goto("/");
        await page.getByTestId("login-email").fill("not-an-email");
        await page.getByTestId("login-password").fill("validpass1");
        await page.getByRole("button", { name: "Sign in" }).click();
        await expect(page.getByTestId("login-email-error")).toHaveText(MSG.emailInvalid);
    });

    test("login rejects short password before API call", async ({ page }) => {
        await page.goto("/");
        await page.getByTestId("login-email").fill("user@example.com");
        await page.getByTestId("login-password").fill("12345");
        await page.getByRole("button", { name: "Sign in" }).click();
        await expect(page.getByTestId("login-password-error")).toHaveText(MSG.passwordTooShort);
    });

    test("register rejects invalid email", async ({ page }) => {
        await page.goto("/register");
        await page.getByTestId("register-email").fill("bad");
        await page.getByTestId("register-password").fill("secret12");
        await page.getByRole("button", { name: "Create account" }).click();
        await expect(page.getByTestId("register-email-error")).toHaveText(MSG.emailInvalid);
    });

    test("register rejects display name over max length", async ({ page }) => {
        await page.goto("/register");
        await page.getByTestId("register-email").fill("qa@example.com");
        await page.getByTestId("register-display-name").fill("x".repeat(101));
        await page.getByTestId("register-password").fill("secret12");
        await page.getByRole("button", { name: "Create account" }).click();
        await expect(page.getByTestId("register-display-name-error")).toHaveText(MSG.displayNameTooLong);
    });

    test("forgot-password rejects invalid email", async ({ page }) => {
        await page.goto("/forgot-password");
        await page.getByTestId("forgot-password-email").fill("not-email");
        await page.getByRole("button", { name: "Send reset code" }).click();
        await expect(page.getByTestId("forgot-password-email-error")).toHaveText(MSG.emailInvalid);
    });

    test("reset-password rejects incomplete code", async ({ page }) => {
        await page.goto("/reset-password");
        await page.getByTestId("reset-password-email").fill("user@example.com");
        await page.getByTestId("reset-password-code").fill("123");
        await page.getByTestId("reset-password-new").fill("newpass1");
        await page.getByTestId("reset-password-confirm").fill("newpass1");
        await page.getByRole("button", { name: "Update password" }).click();
        await expect(page.getByTestId("reset-password-code-error")).toHaveText(MSG.resetCodeDigits);
    });
});
