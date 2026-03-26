import { UserBuilder } from "../builders/user.builder";
import type { TestUser } from "../models/TestUser";
import type { UserCreationStrategy } from "../strategies/user/user-creation.strategy";

export class UserFactory {
    async create(
        strategy: UserCreationStrategy,
        configure?: (b: UserBuilder) => UserBuilder
    ): Promise<TestUser> {
        const builder = new UserBuilder();
        const configured = configure ? configure(builder) : builder;
        return strategy.createUser(configured.build());
    }

    async createMinimal(
        strategy: UserCreationStrategy,
        configure?: (b: UserBuilder) => UserBuilder
    ): Promise<TestUser> {
        let builder: UserBuilder = new UserBuilder().required();
        if (configure) {
            builder = configure(builder);
        }
        return strategy.createUser(builder.build());
    }
}
