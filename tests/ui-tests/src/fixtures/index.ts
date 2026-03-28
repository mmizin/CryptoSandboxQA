import { test as base } from "@playwright/test";
import { adminFixture } from "./admin.fixture";
import type { AdminFixtures } from "./admin.fixture";
import { pagesFixture } from "./pages.fixture";
import type { PagesFixtures } from "./pages.fixture";
import { userFixture } from "./user.fixture";
import type { UserFixtures } from "./user.fixture";

type Fixtures = UserFixtures & AdminFixtures & PagesFixtures;

export const test = base.extend<Fixtures>({
    ...userFixture,
    ...adminFixture,
    ...pagesFixture,
});

export const expect = test.expect;

export type { AppPages, PagesFixtures } from "./pages.fixture";
