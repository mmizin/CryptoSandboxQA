"""
Strategy protocol for creating users (mirrors tests/ui-tests/src/strategies/user/user-creation.strategy.ts).

Implementations: ``ApiUserCreationStrategy``, ``AdminApiUserCreationStrategy`` (see ``api_strategy.py``).
"""

from __future__ import annotations

from typing import Protocol

from models.user.registered_user import RegisteredTestUser
from models.user.user_types import UserWithProfileTestData


class UserCreationStrategy(Protocol):
    def create_user(self, user: UserWithProfileTestData) -> RegisteredTestUser:
        """Persist or bootstrap a user and return bearer token + merged test data."""
