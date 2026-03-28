import type { Page } from "@playwright/test";
import { DashboardPage } from "../pages/dashboard.page";
import { LoginPage } from "../pages/login.page";

/**
 * All page objects for the app, bound to the same Playwright `page` per test.
 * Add new entries here when you add `*.page.ts` classes.
 */
export type AppPages = {
    login: LoginPage;
    dashboard: DashboardPage;
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
            dashboard: new DashboardPage(page),
        });
    },
};
