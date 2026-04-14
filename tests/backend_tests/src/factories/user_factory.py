"""
Factory that composes UserBuilder with a UserCreationStrategy (mirrors tests/ui-tests/src/factories/user.factory.ts).
"""

from __future__ import annotations

from typing import Callable, Optional

from builders.user_builder import UserBuilder
from models.user.registered_user import RegisteredTestUser
from strategies.user.user_creation_strategy import UserCreationStrategy


class UserFactory:
    def create(
        self,
        strategy: UserCreationStrategy,
        configure: Optional[Callable[[UserBuilder], UserBuilder]] = None,
    ) -> RegisteredTestUser:
        builder = UserBuilder()
        if configure:
            builder = configure(builder)
        return strategy.create_user(builder.build())

    def create_minimal(
        self,
        strategy: UserCreationStrategy,
        configure: Optional[Callable[[UserBuilder], UserBuilder]] = None,
    ) -> RegisteredTestUser:
        builder: UserBuilder = UserBuilder().required()
        if configure:
            builder = configure(builder)
        return strategy.create_user(builder.build())
