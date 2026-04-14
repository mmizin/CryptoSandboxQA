"""
API-backed user creation strategies (mirrors tests/ui-tests/src/strategies/user/api.strategy.ts).
"""

from __future__ import annotations

from typing import Optional

from models.user.registered_user import RegisteredTestUser, registered_test_user_from_auth_result
from models.user.user_types import UserWithProfileTestData
from services.auth_client import AuthClient, get_admin_api_key


class ApiUserCreationStrategy:
    """Registers via POST /auth/register-with-profile (full profile fields supported)."""

    def __init__(self, client: AuthClient) -> None:
        self._client = client

    def create_user(self, user: UserWithProfileTestData) -> RegisteredTestUser:
        auth = self._client.register_with_profile(user)
        return registered_test_user_from_auth_result(user, auth)


class AdminApiUserCreationStrategy:
    """
    Bootstrap via POST /auth/admin/register — only email, password, displayName are sent;
    profile-only fields on UserWithProfileTestData are ignored by the API.
    """

    def __init__(
        self,
        client: AuthClient,
        admin_api_key: Optional[str] = None,
    ) -> None:
        self._client = client
        self._admin_api_key = admin_api_key

    def create_user(self, user: UserWithProfileTestData) -> RegisteredTestUser:
        key = self._admin_api_key if self._admin_api_key is not None else get_admin_api_key()
        auth = self._client.create_admin(
            email=user.email,
            password=user.password,
            display_name=user.displayName,
            admin_api_key=key,
        )
        return registered_test_user_from_auth_result(user, auth)
