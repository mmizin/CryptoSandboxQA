import type { APIRequestContext } from "@playwright/test";
import { AuthApi } from "../services/auth.api";
import { UserBuilder } from "../builders/user.builder";
import { UserFactory } from "../factories/user.factory";
import type { AdminUser } from "../models/user/AdminUser";
import { AdminApiUserCreationStrategy } from "../strategies/user/api.strategy";

export type AdminFixtures = {
    adminUser: AdminUser;
};

export const adminFixture = {
    adminUser: async (
        { request, authApi, userFactory }: { request: APIRequestContext; authApi: AuthApi; userFactory: UserFactory },
        use: (r: AdminUser) => Promise<void>,
    ) => {
        const strategy = new AdminApiUserCreationStrategy(request, authApi);
        const user = await userFactory.create(strategy, (b: UserBuilder) => b.withDisplayName("Fixture admin user"));
        await use(user);
    },
};
