import type { APIRequestContext } from "@playwright/test";
import type { AuthApi, AuthResult } from "../../api/auth.api";
import { getAdminApiKey } from "../../api/admin.api";
import { UserApi } from "../../api/user.api";
import type { UserWithProfileTestData } from "../../models/user/user.types";
import { AdminUser } from "../../models/user/AdminUser";
import { TestUser } from "../../models/user/TestUser";
import type { UserCreationStrategy } from "./user-creation.strategy";

export function testUserFromAuthResult(
    requestContext: APIRequestContext,
    payload: UserWithProfileTestData,
    response: AuthResult
): TestUser {
    const userApi = new UserApi(requestContext, response.access_token);
    const data: Partial<UserWithProfileTestData> = {
        ...payload,
        ...response.user,
        password: payload.password,
        displayName: response.user.displayName ?? undefined,
    };
    return new TestUser(requestContext, response.access_token, userApi, data);
}

export function adminUserFromAuthResult(
    requestContext: APIRequestContext,
    payload: UserWithProfileTestData,
    response: AuthResult
): AdminUser {
    const userApi = new UserApi(requestContext, response.access_token);
    const data: Partial<UserWithProfileTestData> = {
        ...payload,
        ...response.user,
        password: payload.password,
        displayName: response.user.displayName ?? undefined,
    };
    return new AdminUser(requestContext, response.access_token, userApi, data);
}

export class ApiUserCreationStrategy implements UserCreationStrategy {
    constructor(
        protected readonly requestContext: APIRequestContext,
        protected readonly authApi: AuthApi
    ) {}

    async createUser(user: UserWithProfileTestData): Promise<TestUser> {
        const response = await this.authApi.registerUserWithProfile(user);
        return testUserFromAuthResult(this.requestContext, user, response);
    }
}

/**
 * Creates a user via `POST /auth/admin/register` (bootstrap). Only email, password, and displayName are sent;
 * profile-only fields on {@link UserWithProfileTestData} are ignored by the API. Use {@link ApiUserCreationStrategy}
 * when you need full register-with-profile behavior.
 */
export class AdminApiUserCreationStrategy extends ApiUserCreationStrategy {
    constructor(
        requestContext: APIRequestContext,
        authApi: AuthApi,
        private readonly adminApiKey: string = getAdminApiKey()
    ) {
        super(requestContext, authApi);
    }

    async createUser(user: UserWithProfileTestData): Promise<AdminUser> {
        const response = await this.authApi.createAdmin(
            {
                email: user.email,
                password: user.password,
                displayName: user.displayName,
            },
            this.adminApiKey
        );
        return adminUserFromAuthResult(this.requestContext, user, response);
    }
}
