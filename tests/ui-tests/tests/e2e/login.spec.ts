import * as allure from "allure-js-commons";
import { expect, test } from "../../src/fixtures";
import { registerTestUserViaApi } from "../../src/utils/users";
import { LoginPage } from "../../src/pages/login.page";

test.describe("Login page", { tag: ["@e2e", "@login"] }, () => {
    test.beforeEach(async () => {
        await allure.epic("Authentication");
        await allure.feature("Login UI");
    });

    test("redirects /login to home and shows sign-in form", async ({ page }) => {
        const login = new LoginPage(page);
        await login.gotoViaLoginRoute();
        await expect(page).not.toHaveURL("/login");
        await expect(login.heading).toBeVisible();
        await expect(login.emailInput).toBeVisible();
        await expect(login.passwordInput).toBeVisible();
        await expect(login.submitButton).toBeVisible();
        await expect(login.forgotPasswordLink).toBeVisible();
        await expect(login.createAccountLink).toBeVisible();
    });

    test("shows error for invalid credentials", async ({ page, request, authApi, userFactory }) => {
        const testUser = await registerTestUserViaApi(request, authApi, userFactory, "Invalid credentials probe");
        const login = new LoginPage(page);
        await login.goto();
        await login.emailInput.fill(testUser.data.email!);
        await login.passwordInput.fill("DefinitelyWrongPassword123!");
        await login.submitButton.click();
        await expect(page.getByText("Invalid email or password")).toBeVisible();
    });

    test(
        "successful login navigates to dashboard",
        { tag: ["@smoke", "@merge-gate"] },
        async ({ page, request, authApi, userFactory }) => {
            const testUser = await registerTestUserViaApi(request, authApi, userFactory, "Successful login");
            const login = new LoginPage(page);
            await login.goto();
            await login.emailInput.fill(testUser.data.email!);
            await login.passwordInput.fill(testUser.data.password!);
            await login.submitButton.click();
            await expect(page).toHaveURL("/dashboard", { timeout: 15_000 });
        },
    );

    test("forgot password link goes to forgot-password", async ({ page }) => {
        const login = new LoginPage(page);
        await login.goto();
        await login.forgotPasswordLink.click();
        await expect(page).toHaveURL("/forgot-password");
    });

    test("create account link goes to register", async ({ page }) => {
        const login = new LoginPage(page);
        await login.goto();
        await login.createAccountLink.click();
        await expect(page).toHaveURL("/register");
    });
});
