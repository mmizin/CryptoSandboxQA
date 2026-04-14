"""
Admin-bootstrapped test identity (mirrors tests/ui-tests/src/models/user/AdminUser.ts).
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from models.user.user_types import UserWithProfileTestData

from .registered_user import RegisteredTestUser, registered_test_user_from_auth_result


@dataclass
class AdminRegisteredTestUser(RegisteredTestUser):
    """User created via ``POST /auth/admin/register`` (distinct from public register-with-profile)."""


def admin_registered_test_user_from_auth_result(
    payload: UserWithProfileTestData,
    auth: dict[str, Any],
) -> AdminRegisteredTestUser:
    base = registered_test_user_from_auth_result(payload, auth)
    return AdminRegisteredTestUser(access_token=base.access_token, data=base.data)
