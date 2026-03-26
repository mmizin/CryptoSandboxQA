import type { APIRequestContext } from "@playwright/test";
import type { UserApi } from "../api/user.api";
import { TestUser, type UserWithProfileTestData } from "./TestUser";

/**
 * Test identity created via admin bootstrap (`POST /auth/admin/register`), distinct from
 * {@link TestUser} instances produced by public register-with-profile.
 */
export class AdminUser extends TestUser {
    constructor(
        requestContext: APIRequestContext,
        accessToken: string,
        api: UserApi,
        data: Partial<UserWithProfileTestData>
    ) {
        super(requestContext, accessToken, api, data);
    }
}
