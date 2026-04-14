"""
Strategy protocol for creating users (mirrors tests/ui-tests/src/strategies/user/user-creation.strategy.ts).

Implementations: ``ApiUserCreationStrategy``, ``AdminApiUserCreationStrategy`` (see ``api_strategy.py``).
"""

from __future__ import annotations

from typing import Protocol, TypeVar

from models.user.registered_user import RegisteredTestUser
from models.user.user_types import UserWithProfileTestData

TRegisteredUser = TypeVar("TRegisteredUser", bound=RegisteredTestUser)


class UserCreationStrategy(Protocol[TRegisteredUser]):
    def create_user(self, user: UserWithProfileTestData) -> TRegisteredUser:
        """Persist or bootstrap a user and return bearer token + merged test data."""
