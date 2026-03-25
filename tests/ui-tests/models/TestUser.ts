import type { APIRequestContext } from "@playwright/test";
import { BaseApi } from "../api/base.api";
import type { UserApi } from "../api/user.api";

export type UserWithProfileTestData = {
    email: string;
    password: string;
    displayName?: string;
    username?: string;
    fullName?: string;
    photoUrl?: string;
    bio?: string;
    websiteUrl?: string;
    location?: string;
    birthday?: string;
    languageCode?: string;
    timezone?: string;
    preferences?: Record<string, unknown>;

    id?: string;
    emailVerifiedAt?: Date | null;
    createdAt?: Date;
    updatedAt?: Date;
    profile?: unknown;
};

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
