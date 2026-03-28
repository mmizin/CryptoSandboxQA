import type { Locator, Page } from "@playwright/test";

/**
 * Sign-in UI lives on `/` (home). `/login` client-redirects to `/`.
 *
 * Locators match Playwright MCP accessibility snapshots (`getByLabel` / `getByRole` for the same
 * names as `textbox "Email"`, `button "Sign in"`, etc.).
 */
export class LoginPage {
    readonly page: Page;
    readonly heading: Locator;
    readonly emailInput: Locator;
    readonly passwordInput: Locator;
    readonly submitButton: Locator;
    readonly forgotPasswordLink: Locator;
    readonly createAccountLink: Locator;

    constructor(page: Page) {
        this.page = page;
        this.heading = page.getByRole("heading", { name: "Welcome back" });
        this.emailInput = page.getByLabel("Email");
        this.passwordInput = page.getByLabel("Password");
        this.submitButton = page.getByRole("button", { name: "Sign in" });
        this.forgotPasswordLink = page.getByRole("link", { name: "Forgot password?" });
        this.createAccountLink = page.getByRole("link", { name: "Create account" });
    }

    async goto(): Promise<void> {
        await this.page.goto("/");
    }

    async gotoViaLoginRoute(): Promise<void> {
        await this.page.goto("/login");
        await this.heading.waitFor({ state: "visible" });
    }
}
