"""
Factory fixture ``fxt_regular_user``: optional ``UserBuilder`` configure callback and ``minimal=True``.
"""

from __future__ import annotations

from collections.abc import Callable
from typing import Optional

import pytest

from builders.user_builder import UserBuilder
from factories.user_factory import UserFactory
from models.user.registered_user import RegisteredTestUser
from services.auth_client import AuthClient
from strategies.user.api_strategy import ApiUserCreationStrategy

RegularUserFactory = Callable[..., RegisteredTestUser]


@pytest.fixture
def fxt_regular_user() -> RegularUserFactory:
    """Return a callable that creates a user via ``POST /auth/register-with-profile``."""

    strategy = ApiUserCreationStrategy(AuthClient())
    factory = UserFactory()

    def _make(
        configure: Optional[Callable[[UserBuilder], UserBuilder]] = None,
        *,
        minimal: bool = False,
    ) -> RegisteredTestUser:
        if minimal:
            return factory.create_minimal(strategy, configure=configure)
        return factory.create(strategy, configure=configure)

    return _make
