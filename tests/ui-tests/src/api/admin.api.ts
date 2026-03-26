import { UserApi } from "./user.api";

function getAdminApiKey(): string {
    const adminApiKey = process.env.ADMIN_API_KEY?.trim() || '';
    if (!adminApiKey) {
        throw new Error('ADMIN_API_KEY is not set');
    }
    return adminApiKey;
}

export class AdminApi extends UserApi {


}
