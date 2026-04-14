"""
Factory that composes UserBuilder with a UserCreationStrategy (mirrors tests/ui-tests/src/factories/user.factory.ts).
"""

from __future__ import annotations

from typing import Callable, Optional

from builders.user_builder import UserBuilder
from strategies.user.user_creation_strategy import TRegisteredUser, UserCreationStrategy


class UserFactory:
    """Strategy-first API (same argument order as ``tests/ui-tests/src/factories/user.factory.ts``)."""

    def create(
        self,
        strategy: UserCreationStrategy[TRegisteredUser],
        configure: Optional[Callable[[UserBuilder], UserBuilder]] = None,
    ) -> TRegisteredUser:
        builder = UserBuilder()
        if configure:
            builder = configure(builder)
        return strategy.create_user(builder.build())

    def create_minimal(
        self,
        strategy: UserCreationStrategy[TRegisteredUser],
        configure: Optional[Callable[[UserBuilder], UserBuilder]] = None,
    ) -> TRegisteredUser:
        builder: UserBuilder = UserBuilder().required()
        if configure:
            builder = configure(builder)
        return strategy.create_user(builder.build())
