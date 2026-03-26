import { test as base, expect } from "@playwright/test";
import { getApiUrl } from "../api/base.api";
import { AuthApi } from "../api/auth.api";
import { UserFactory } from "../factories/user.factory";
import type { TestUser } from "../models/TestUser";
import { ApiUserCreationStrategy } from "../strategies/user/api.strategy";

type Fixtures = {
    authApi: AuthApi;
    apiUserStrategy: ApiUserCreationStrategy;
    userFactory: UserFactory;
    testUser: TestUser;
};

export const test = base.extend<Fixtures>({
    authApi: async ({ request }, use) => {
        await use(new AuthApi(request, getApiUrl()));
    },
    apiUserStrategy: async ({ request, authApi }, use) => {
        await use(new ApiUserCreationStrategy(request, authApi));
    },
    userFactory: async ({}, use) => {
        await use(new UserFactory());
    },
    testUser: async ({ userFactory, apiUserStrategy }, use) => {
        const user = await userFactory.create(apiUserStrategy, (b) => b.withDisplayName("Fixture user"));
        await use(user);
    },
});

export { expect };
