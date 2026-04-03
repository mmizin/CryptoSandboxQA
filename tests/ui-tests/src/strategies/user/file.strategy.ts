import type { TestUser } from "../../models/user/TestUser";
import type { UserWithProfileTestData } from "../../models/user/user.types";
import { readJsonFile } from "../../utils/file-reader";
import type { UserCreationStrategy } from "./user-creation.strategy";

type UserTestDataFile = UserWithProfileTestData | UserWithProfileTestData[];

function entryFromFile(raw: UserTestDataFile, entryIndex: number, filePath: string): UserWithProfileTestData {
    const list = Array.isArray(raw) ? raw : [raw];
    const entry = list[entryIndex];
    if (entry === undefined) {
        throw new Error(
            `test data file "${filePath}": no user at index ${entryIndex} (${list.length} ${list.length === 1 ? "entry" : "entries"})`
        );
    }
    return entry;
}

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
     * @param filePath Path to a JSON file (relative to `process.cwd()` or absolute). Either one {@link UserWithProfileTestData} object or an array of them, e.g. `test-data/users/default.json`.
     * @param entryIndex When the file contains an array, which entry to use (0-based). Ignored when the file is a single object.
     */
    constructor(
        private readonly filePath: string,
        private readonly apiStrategy: UserCreationStrategy,
        private readonly entryIndex: number = 0
    ) {}

    async createUser(user: UserWithProfileTestData): Promise<TestUser> {
        const raw = await readJsonFile<UserTestDataFile>(this.filePath);
        const fromFile = entryFromFile(raw, this.entryIndex, this.filePath);
        const merged = mergeFileAndBuilder(fromFile, user);
        return this.apiStrategy.createUser(merged);
    }
}
