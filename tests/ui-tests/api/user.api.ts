import { APIRequestContext } from "@playwright/test";
import { BaseApi } from "./base.api";

export class UserApi extends BaseApi {
    constructor(requestContext: APIRequestContext, accessToken?: string) {
        super(requestContext, undefined, accessToken);
    }
}