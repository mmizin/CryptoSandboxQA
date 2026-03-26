import { test as base } from "@playwright/test";
import { adminFixture } from "./admin.fixture";
import type { AdminFixtures } from "./admin.fixture";
import { userFixture } from "./user.fixture";
import type { UserFixtures } from "./user.fixture";

type Fixtures = UserFixtures & AdminFixtures;

export const test = base.extend<Fixtures>({
    ...userFixture,
    ...adminFixture,
});

export const expect = test.expect;
