/**
 * Shapes aligned with `GET /users/me` and related user APIs (camelCase JSON).
 * See backend `UsersController.me` / `UsersService.findByIdWithProfile`.
 */

export type UserRole = "user" | "admin";

export type UserProfile = {
    id: string;
    userId: string;
    photoUrl: string | null;
    username: string | null;
    bio: string | null;
    fullName: string | null;
    websiteUrl: string | null;
    location: string | null;
    birthday: string | null;
    languageCode: string;
    timezone: string;
    preferences: Record<string, unknown>;
    verificationStatus: string;
    createdAt: string;
    updatedAt: string;
};

export type UserWithProfile = {
    id: string;
    email: string;
    displayName: string | null;
    role: UserRole;
    emailVerifiedAt: string | null;
    createdAt: string;
    updatedAt: string;
    profile: UserProfile | null;
};
