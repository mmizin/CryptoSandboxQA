import { expect, test } from "../src/fixtures";

test("creates user via API factory", async ({ testUser }) => {
    expect(testUser.accessToken).toBeTruthy();
    expect(testUser.data.email).toContain("@");
});

test("custom builder overrides", async ({ userFactory, apiUserStrategy }) => {
    const user = await userFactory.createMinimal(apiUserStrategy, (b) => b.withDisplayName("Minimal smoke"));
    expect(user.data.displayName).toBe("Minimal smoke");
});
