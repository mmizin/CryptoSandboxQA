import type { APIRequestContext } from "@playwright/test";
import type { AuthApi, AuthResult } from "../../api/auth.api";
import { UserApi } from "../../api/user.api";
import { TestUser, type UserWithProfileTestData } from "../../models/TestUser";
import type { UserCreationStrategy } from "./user-creation.strategy";

function testUserFromAuthResult(
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

export class ApiUserCreationStrategy implements UserCreationStrategy {
    constructor(
        private readonly requestContext: APIRequestContext,
        private readonly authApi: AuthApi
    ) {}

    async createUser(user: UserWithProfileTestData): Promise<TestUser> {
        const response = await this.authApi.registerUserWithProfile(user);
        return testUserFromAuthResult(this.requestContext, user, response);
    }
}
