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

/**
 * Profile fields accepted as flat input for `POST /auth/register-with-profile` (optional).
 * Same names as {@link UserProfile}; no `id` / `userId` (assigned by the server).
 */
export type UserProfileRegistrationFields = Partial<
    Pick<
        UserProfile,
        | "photoUrl"
        | "username"
        | "bio"
        | "fullName"
        | "websiteUrl"
        | "location"
        | "birthday"
        | "languageCode"
        | "timezone"
        | "preferences"
    >
>;

/**
 * Data carried by tests: registration/login credentials, optional profile fields, and optional
 * post-auth fields merged from API responses. Not the same as {@link UserWithProfile} (nested API shape).
 */
export type UserWithProfileTestData = {
    email: string;
    password: string;
    displayName?: string;
} & UserProfileRegistrationFields & {
    id?: string;
    emailVerifiedAt?: Date | null;
    createdAt?: Date;
    updatedAt?: Date;
    /** Raw profile from API when tests stash the full nested object */
    profile?: unknown;
};
