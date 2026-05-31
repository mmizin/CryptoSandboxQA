/**
 * TC-UI-03 (KAN-62) — `/trade/futures` mirrors spot flows; POST `/orders` must include `marketType: "futures"`.
 */
import * as allure from "allure-js-commons";
import { expect, test } from "@/fixtures";
import {
    fundUsdViaDepositApi,
    openTradePageWithApiUser,
    registerTestUserViaApi,
} from "@/utils/users";

test.describe("Trade futures orders", { tag: ["@e2e"] }, () => {
    test.beforeEach(async () => {
        await allure.epic("Trading");
        await allure.feature("Futures orders UI");
    });

    test(
        "market buy sends futures marketType then limit sell succeeds",
        { tag: ["@smoke", "@merge-gate"] },
        async ({ page, request, authApi, userFactory, pages }) => {
            const testUser = await registerTestUserViaApi(
                request,
                authApi,
                userFactory,
                `UI KAN-62 futures trade ${Date.now()}`,
            );
            await fundUsdViaDepositApi(request, testUser, 250_000);
            const trade = pages.tradeFutures;
            await openTradePageWithApiUser(page, trade, testUser);
            await expect(page).toHaveURL("/trade/futures");

            let futuresMarketBuySeen = false;

            await test.step("market buy with futures payload", async () => {
                await page.route("**/orders", async (route) => {
                    const req = route.request();
                    if (req.method() !== "POST") {
                        await route.continue();
                        return;
                    }
                    const body = req.postDataJSON() as { marketType?: string };
                    if (body?.marketType === "futures") {
                        futuresMarketBuySeen = true;
                    }
                    await route.continue();
                });

                await trade.orderTypeButton("market").click();
                await trade.sideButton("buy").click();
                await trade.orderStatusTestingSelect().selectOption({ label: "Filled" });
                await trade.amountInput().fill("0.00012");
                await trade.submitButton().click();
                await expect(trade.successMessage()).toHaveText("Order placed successfully", { timeout: 30_000 });
                expect(futuresMarketBuySeen).toBe(true);
            });

            await page.unroute("**/orders");

            await test.step("limit sell", async () => {
                await trade.resetButton().click();
                await trade.orderTypeButton("limit").click();
                await trade.sideButton("sell").click();
                await trade.orderStatusTestingSelect().selectOption({ label: "Filled" });
                await trade.amountInput().fill("0.00004");
                await trade.priceInput().fill("110000");
                await trade.submitButton().click();
                await expect(trade.successMessage()).toHaveText("Order placed successfully", { timeout: 30_000 });
            });
        },
    );
});
