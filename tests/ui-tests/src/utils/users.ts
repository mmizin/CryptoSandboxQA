import type { APIRequestContext, Page } from "@playwright/test";
import { expect } from "@playwright/test";
import type { AuthApi } from "../services/auth.api";
import { DepositsApi } from "../services/deposits.api";
import type { UserFactory } from "../factories/user.factory";
import type { TestUser } from "../models/user/TestUser";
import { CHART_BLOCK_COUNT, type DashboardPage } from "../pages/dashboard.page";
import type { TradePage } from "../pages/trade.page";
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

/**
 * JWT in `localStorage` then opens a trade route (`/trade/spot` | `/trade/futures`; see `useAuth`).
 */
export async function openTradePageWithApiUser(page: Page, trade: TradePage, user: TestUser): Promise<void> {
    await page.addInitScript(
        ({ token }: { token: string }) => {
            localStorage.setItem("token", token);
        },
        { token: user.accessToken },
    );
    await page.goto(trade.path);
    await trade.heading.waitFor({ state: "visible", timeout: 15_000 });
}

/** Fiat credit for order flows that need non-zero USD (mock card path; see `DepositsService.depositFiat`). */
export async function fundUsdViaDepositApi(request: APIRequestContext, user: TestUser, amount: number): Promise<void> {
    const deposits = new DepositsApi(request, user.accessToken);
    await deposits.depositFiat({ fiatCurrency: "USD", amount, paymentMethodType: "card" });
}
