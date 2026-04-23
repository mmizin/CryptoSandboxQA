"""
Factory fixture ``fxt_admin_user``: optional ``UserBuilder`` configure callback and ``minimal=True``.
"""

from __future__ import annotations

from collections.abc import Callable
from typing import Optional

import allure
import pytest

from builders.user_builder import UserBuilder
from factories.user_factory import UserFactory
from models.user.admin_registered_user import AdminRegisteredTestUser
from services.auth_client import AuthClient
from strategies.user.api_strategy import AdminApiUserCreationStrategy

AdminUserFactory = Callable[..., AdminRegisteredTestUser]


@pytest.fixture
@allure.title("Factory: admin-bootstrapped user (API admin register)")
def fxt_admin_user() -> AdminUserFactory:
    """Return a callable that creates an admin-bootstrapped user (``POST /auth/admin/register``)."""

    strategy = AdminApiUserCreationStrategy(AuthClient())
    factory = UserFactory()

    def _make(
        configure: Optional[Callable[[UserBuilder], UserBuilder]] = None,
        *,
        minimal: bool = False,
    ) -> AdminRegisteredTestUser:
        if minimal:
            return factory.create_minimal(strategy, configure=configure)
        return factory.create(strategy, configure=configure)

    return _make
