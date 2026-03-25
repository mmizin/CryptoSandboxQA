import { APIRequestContext } from "@playwright/test";
import { BaseApi } from "./base.api";
import { UserApi } from "./user.api";
import { TestUser, UserWithProfileTestData } from "../models/TestUser";

export type AuthUserDto = {
    id: string;
    email: string;
    displayName: string | null;
    emailVerifiedAt?: Date | null;
    createdAt?: Date;
    updatedAt?: Date;
    profile?: unknown;
};

export type AuthResult = {
    access_token: string;
    user: AuthUserDto;
};

type LoginPayload = {
    email: string;
    password: string;
    displayName?: string;
};

type CreateAdminPayload = LoginPayload;
type RegisterUserPayload = LoginPayload;

export class AuthApi extends BaseApi {
    constructor(requestContext: APIRequestContext, apiUrl: string) {
        super(requestContext, apiUrl);
    }

    async login(payload: LoginPayload): Promise<TestUser> {
        const response = await this.post<AuthResult>('/auth/login', { data: payload });
        const userApi = new UserApi(this.requestContext, response.access_token);
        // Merge request + API user into flat test data; password only ever comes from the request.
        const data: Partial<UserWithProfileTestData> = {
            ...payload,
            ...response.user,
            password: payload.password,
            displayName: response.user.displayName ?? undefined,
        };
        return new TestUser(this.requestContext, response.access_token, userApi, data);
    }

    async registerUser(payload: RegisterUserPayload) {
        const response = await this.post<AuthResult>('/auth/register', { data: payload });
        return response;
    }

    async registerUserWithProfile(payload: UserWithProfileTestData) {
        const response = await this.post<AuthResult>('/auth/register-with-profile', { data: payload });
        return response;
    }

    async createAdmin(payload: CreateAdminPayload, apiKey: string) {
        const response = await this.post<AuthResult>('/auth/admin/register', {
            data: payload,
            headers: { 'X-Admin-API-Key': apiKey },
        });

        return response;
    }

    async logout() {
        const response = await this.post<void>('/auth/logout', {});
        return response;
    }
}
