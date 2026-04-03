import type { TestUser } from "../../models/user/TestUser";
import type { UserWithProfileTestData } from "../../models/user/user.types";

export interface UserCreationStrategy {
    createUser(user: UserWithProfileTestData): Promise<TestUser>;
}
