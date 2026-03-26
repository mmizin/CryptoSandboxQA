import type { TestUser, UserWithProfileTestData } from "../../models/TestUser";
import { readJsonFile } from "../../utils/file-reader";
import type { UserCreationStrategy } from "./user-creation.strategy";
import type { ApiUserCreationStrategy } from "./api.strategy";

/** File JSON first; builder `user` overrides overlapping fields; `preferences` are merged shallowly. */
function mergeFileAndBuilder(
    fromFile: UserWithProfileTestData,
    fromBuilder: UserWithProfileTestData
): UserWithProfileTestData {
    return {
        ...fromFile,
        ...fromBuilder,
        preferences:
            fromBuilder.preferences !== undefined || fromFile.preferences !== undefined
                ? {
                      ...(fromFile.preferences ?? {}),
                      ...(fromBuilder.preferences ?? {}),
                  }
                : undefined,
    };
}

export class FileUserCreationStrategy implements UserCreationStrategy {
    /**
     * @param filePath Path to a JSON file (relative to `process.cwd()` or absolute) with {@link UserWithProfileTestData} shape, e.g. `test-data/users/default.json`.
     */
    constructor(
        private readonly filePath: string,
        private readonly apiStrategy: ApiUserCreationStrategy
    ) {}

    async createUser(user: UserWithProfileTestData): Promise<TestUser> {
        const fromFile = await readJsonFile<UserWithProfileTestData>(this.filePath);
        const merged = mergeFileAndBuilder(fromFile, user);
        return this.apiStrategy.createUser(merged);
    }
}
