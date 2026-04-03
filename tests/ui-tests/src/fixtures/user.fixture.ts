import type { APIRequestContext } from "@playwright/test";
import { getApiUrl } from "../api/base.api";
import { AuthApi } from "../api/auth.api";
import { UserBuilder } from "../builders/user.builder";
import { UserFactory } from "../factories/user.factory";
import type { TestUser } from "../models/user/TestUser";
import { ApiUserCreationStrategy } from "../strategies/user/api.strategy";

export type UserFixtures = {
    authApi: AuthApi;
    userFactory: UserFactory;
    testUser: TestUser;
};

export const userFixture = {
    authApi: async ({ request }: { request: APIRequestContext }, use: (r: AuthApi) => Promise<void>) => {
        await use(new AuthApi(request, getApiUrl()));
    },
    userFactory: async ({ }, use: (r: UserFactory) => Promise<void>) => {
        await use(new UserFactory());
    },
    testUser: async (
        { request, authApi, userFactory }: { request: APIRequestContext; authApi: AuthApi; userFactory: UserFactory },
        use: (r: TestUser) => Promise<void>,
    ) => {
        const strategy = new ApiUserCreationStrategy(request, authApi);
        const user = await userFactory.create(strategy, (b: UserBuilder) => b.withDisplayName("Fixture user"));
        await use(user);
    },
};
