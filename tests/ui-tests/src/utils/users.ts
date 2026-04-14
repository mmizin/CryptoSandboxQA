import type { APIRequestContext, Page } from "@playwright/test";
import { expect } from "@playwright/test";
import type { AuthApi } from "../services/auth.api";
import type { UserFactory } from "../factories/user.factory";
import type { TestUser } from "../models/user/TestUser";
import { CHART_BLOCK_COUNT, type DashboardPage } from "../pages/dashboard.page";
import { ApiUserCreationStrategy } from "../strategies/user/api.strategy";

/**
 * Registers a test user via the auth API (`ApiUserCreationStrategy` / register-with-profile).
 * The returned {@link TestUser} includes `accessToken` and email/password for UI login or token injection.
 */
export async function registerTestUserViaApi(
    request: APIRequestContext,
    authApi: AuthApi,
    userFactory: UserFactory,
    displayName: string,
) {
    const strategy = new ApiUserCreationStrategy(request, authApi);
    return userFactory.create(strategy, (b) =>
        b
            .withDisplayName(displayName)
            .withhUsername(`login_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`),
    );
}

/**
 * Same session shape as after UI sign-in on the home page: `localStorage` key `token` (see `frontend/app/page.tsx`),
 * then navigates to `/dashboard` under Playwright `baseURL`.
 */
export async function openDashboardWithApiUser(page: Page, dashboard: DashboardPage, user: TestUser): Promise<void> {
    await page.addInitScript(
        ({ token }: { token: string }) => {
            localStorage.setItem("token", token);
        },
        { token: user.accessToken },
    );
    await page.goto("/dashboard");
    await dashboard.customizeLayoutButton.waitFor({ state: "visible" });
    await expect(dashboard.chartBlocksInOrder()).toHaveCount(CHART_BLOCK_COUNT, { timeout: 15_000 });
}
