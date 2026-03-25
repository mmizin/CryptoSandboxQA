import type { UserWithProfileTestData } from "../models/TestUser";


export interface UserCreationStrategy {
    createUser(user: UserWithProfileTestData): Promise<UserWithProfileTestData>
}