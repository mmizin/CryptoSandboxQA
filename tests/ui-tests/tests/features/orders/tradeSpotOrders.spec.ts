/**
 * TC-UI-02 (KAN-61) — `/trade/spot` happy path: market buy then limit sell (`KAN-52` / KAN-54).
 */
import * as allure from "allure-js-commons";
import { expect, test } from "@/fixtures";
import {
    fundUsdViaDepositApi,
    openTradePageWithApiUser,
    registerTestUserViaApi,
} from "@/utils/users";

test.describe("Trade spot orders", { tag: ["@e2e"] }, () => {
    test.beforeEach(async () => {
        await allure.epic("Trading");
        await allure.feature("Spot orders UI");
    });

    test(
        "market buy then limit sell succeeds",
        { tag: ["@smoke", "@merge-gate"] },
        async ({ page, request, authApi, userFactory, pages }) => {
            const testUser = await registerTestUserViaApi(
                request,
                authApi,
                userFactory,
                `UI KAN-61 spot trade ${Date.now()}`,
            );
            await fundUsdViaDepositApi(request, testUser, 250_000);
            const trade = pages.tradeSpot;
            await openTradePageWithApiUser(page, trade, testUser);
            await expect(page).toHaveURL("/trade/spot");

            await test.step("market buy BTC", async () => {
                await trade.orderTypeButton("market").click();
                await trade.sideButton("buy").click();
                await trade.orderStatusTestingSelect().selectOption({ label: "Filled" });
                await trade.amountInput().fill("0.00015");
                await trade.submitButton().click();
                await expect(trade.successMessage()).toHaveText("Order placed successfully", { timeout: 30_000 });
            });

            await test.step("limit sell BTC", async () => {
                await trade.resetButton().click();
                await trade.orderTypeButton("limit").click();
                await trade.sideButton("sell").click();
                await trade.orderStatusTestingSelect().selectOption({ label: "Filled" });
                await trade.amountInput().fill("0.00005");
                await trade.priceInput().fill("110000");
                await trade.submitButton().click();
                await expect(trade.successMessage()).toHaveText("Order placed successfully", { timeout: 30_000 });
            });
        },
    );
});
