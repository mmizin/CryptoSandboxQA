import type { TestUser, UserWithProfileTestData } from "../../models/TestUser";

export interface UserCreationStrategy {
    createUser(user: UserWithProfileTestData): Promise<TestUser>;
}
