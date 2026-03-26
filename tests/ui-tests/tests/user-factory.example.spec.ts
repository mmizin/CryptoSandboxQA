import { expect, test } from "../src/fixtures";
import { ApiUserCreationStrategy } from "../src/strategies/user/api.strategy";

test("creates user via API factory", async ({ testUser }) => {
    expect(testUser.accessToken).toBeTruthy();
    expect(testUser.data.email).toContain("@");
});

test("custom builder overrides", async ({ userFactory, request, authApi }) => {
    const strategy = new ApiUserCreationStrategy(request, authApi);
    const user = await userFactory.createMinimal(strategy, (b) => b.withDisplayName("Minimal smoke"));
    expect(user.data.displayName).toBe("Minimal smoke");
});
