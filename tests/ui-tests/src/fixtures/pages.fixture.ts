import type { Page } from "@playwright/test";
import { LoginPage } from "../pages/login.page";

/**
 * All page objects for the app, bound to the same Playwright `page` per test.
 * Add new entries here when you add `*.page.ts` classes.
 */
export type AppPages = {
    login: LoginPage;
};

export type PagesFixtures = {
    pages: AppPages;
};

export const pagesFixture = {
    pages: async (
        { page }: { page: Page },
        use: (value: AppPages) => Promise<void>,
    ) => {
        await use({
            login: new LoginPage(page),
        });
    },
};
