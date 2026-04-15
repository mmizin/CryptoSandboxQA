"""
Admin-bootstrapped test identity (mirrors tests/ui-tests/src/models/user/AdminUser.ts).
"""

from __future__ import annotations

from dataclasses import dataclass
from functools import cached_property
from typing import TYPE_CHECKING, Any

from models.user.user_types import UserWithProfileTestData

from .registered_user import RegisteredTestUser, registered_test_user_from_auth_result

if TYPE_CHECKING:
    from services.admin_client import AdminClient


@dataclass
class AdminRegisteredTestUser(RegisteredTestUser):
    """User created via ``POST /auth/admin/register`` (distinct from public register-with-profile)."""

    @cached_property
    def api(self) -> AdminClient:
        """
        Authenticated HTTP client with admin helpers (``AdminClient``). Lazily built; same as
        ``admin_client_from_registered(self)``.
        """
        from services.admin_client import admin_client_from_registered

        return admin_client_from_registered(self)


def admin_registered_test_user_from_auth_result(
    payload: UserWithProfileTestData,
    auth: dict[str, Any],
) -> AdminRegisteredTestUser:
    base = registered_test_user_from_auth_result(payload, auth)
    return AdminRegisteredTestUser(access_token=base.access_token, data=base.data)
