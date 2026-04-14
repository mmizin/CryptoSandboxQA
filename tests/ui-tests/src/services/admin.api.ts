import { UserApi } from "./user.api";

/** Reads `ADMIN_API_KEY` from the environment (shared with admin bootstrap in tests). */
export function getAdminApiKey(): string {
    const adminApiKey = process.env.ADMIN_API_KEY?.trim() || "";
    if (!adminApiKey) {
        throw new Error("ADMIN_API_KEY is not set");
    }
    return adminApiKey;
}

/**
 * API client for requests authenticated as an admin user (admin JWT).
 * For bootstrapping the first admin via `POST /auth/admin/register`, use {@link AuthApi.createAdmin} instead.
 */
export class AdminApi extends UserApi {}
