import type { Page } from "@playwright/test";
import type { TestUser, UserWithProfileTestData } from "../../models/TestUser";
import type { UserCreationStrategy } from "./user-creation.strategy";

/**
 * Placeholder for browser-based signup. Implement navigation and form submission,
 * then obtain a session (e.g. via API login) and return {@link TestUser}.
 */
export class UiUserCreationStrategy implements UserCreationStrategy {
    constructor(private readonly _page: Page) {}

    async createUser(_user: UserWithProfileTestData): Promise<TestUser> {
        throw new Error(
            "UiUserCreationStrategy: signup UI is not implemented yet. Extend this class once signup flows and page objects exist."
        );
    }
}
