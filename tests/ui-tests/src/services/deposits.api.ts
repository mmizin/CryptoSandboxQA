import type { APIRequestContext } from "@playwright/test";
import { BaseApi } from "./base.api";

/**
 * Authenticated deposit calls (user JWT). Used to fund wallets for trading e2e flows.
 */
export class DepositsApi extends BaseApi {
    constructor(requestContext: APIRequestContext, accessToken: string) {
        super(requestContext, undefined, accessToken);
    }

    async depositFiat(payload: {
        fiatCurrency: string;
        amount: number;
        paymentMethodType?: "card" | "sepa" | "applepay";
    }): Promise<void> {
        await this.post("/deposits/fiat", {
            data: {
                paymentMethodType: "card",
                ...payload,
            },
        });
    }
}
