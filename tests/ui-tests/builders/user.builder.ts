export type UserWithProfileTestData = {
    email: string;
    password: string;
    displayName: string;
    username?: string;
    fullName?: string;
    photoUrl?: string;
    bio?: string;
    websiteUrl?: string;
    location?: string;
    birthday?: string;
    languageCode?: string;
    timezone?: string;
    preferences?: Record<string, unknown>;
};

function uniqueEmail(prefix = 'user'): string {
    const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    return `${prefix}-${suffix}@test.com`;
}


export class UserBuilder {
    private data: UserWithProfileTestData;

    constructor() {
        this.data = {
            email: uniqueEmail(),
            password: 'TestPassword123!',
            displayName: 'Test User',
            username: 'testuser',
            fullName: 'Test User Full',
            photoUrl: 'https://example.com/photo.jpg',
            bio: 'Crypto enthusiast',
            websiteUrl: 'https://example.com',
            location: 'New York',
            birthday: '1990-01-15',
            languageCode: 'en',
            timezone: 'America/New_York',
            preferences: { theme: 'dark', notifications: true },
        };
    }

    withEmail(email: string): this {
        this.data.email = email;
        return this
    }

    withUniqueEmail(): this {
        this.data.email = uniqueEmail('unique');
        return this;
    }

    withPassword(password: string): this {
        this.data.password = password;
        return this;
    }

    withDisplayName(displayName: string): this {
        this.data.displayName = displayName;
        return this;
    }

    withhUsername(username: string): this {
        this.data.username = username;
        return this;
    }

    withFullName(fullName: string): this {
        this.data.fullName = fullName;
        return this;
    }

    withPhotoUrl(photoUrl: string): this {
        this.data.photoUrl = photoUrl;
        return this;
    }

    withBio(bio: string): this {
        this.data.bio = bio;
        return this;
    }

    withWebsiteUrl(websiteUrl: string): this {
        this.data.websiteUrl = websiteUrl;
        return this;
    }

    withLocation(location: string | undefined): this {
        this.data.location = location;
        return this;
    }
    withBirthday(birthday: string | undefined): this {
        this.data.birthday = birthday;
        return this;
    }
    withLanguageCode(languageCode: string | undefined): this {
        this.data.languageCode = languageCode;
        return this;
    }
    withTimezone(timezone: string | undefined): this {
        this.data.timezone = timezone;
        return this;
    }
    withPreferences(preferences: Record<string, unknown> | undefined): this {
        this.data.preferences = preferences;
        return this;
    }

    required(): this {
        this.data = {
            email: uniqueEmail('minimal'),
            password: 'TestPassword123!',
            displayName: 'Minimal User',
        };
        return this;
    }

    build(): UserWithProfileTestData {
        return { ...this.data}
    }









}