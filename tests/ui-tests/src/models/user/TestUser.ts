import type { APIRequestContext } from "@playwright/test";
import { BaseApi } from "../../services/base.api";
import type { UserApi } from "../../services/user.api";
import type { UserWithProfileTestData } from "./user.types";

export class TestUser extends BaseApi {
    public readonly api: UserApi;
    public readonly accessToken: string;
    public data: Partial<UserWithProfileTestData>;

    constructor(
        requestContext: APIRequestContext,
        accessToken: string,
        api: UserApi,
        data: Partial<UserWithProfileTestData>
    ) {
        super(requestContext, undefined, accessToken);
        this.api = api;
        this.accessToken = accessToken;
        this.data = data;
    }
}
