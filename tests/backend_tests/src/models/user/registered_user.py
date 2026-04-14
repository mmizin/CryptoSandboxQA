"""
Result of a successful registration/bootstrap (aligned with TestUser.data + token in ui-tests).
"""

from __future__ import annotations

from dataclasses import asdict, dataclass
from typing import Any

from models.user.user_types import UserWithProfileTestData


@dataclass
class RegisteredTestUser:
    """Bearer token plus merged registration payload and API user fields (camelCase keys in data)."""

    access_token: str
    data: dict[str, Any]


def registered_test_user_from_auth_result(
    payload: UserWithProfileTestData,
    auth: dict[str, Any],
) -> RegisteredTestUser:
    """
    Merge request payload with ``user`` from AuthResult; password always from the request.

    Mirrors ``testUserFromAuthResult`` / ``adminUserFromAuthResult`` in
    ``tests/ui-tests/src/strategies/user/api.strategy.ts`` (including ``displayName``:
    API value wins when non-null; null/absent clears to match TS ``?? undefined``).
    """
    user = auth.get("user") or {}
    merged: dict[str, Any] = {**asdict(payload), **user, "password": payload.password}
    api_dn = user.get("displayName")
    merged["displayName"] = api_dn if api_dn is not None else None
    return RegisteredTestUser(access_token=auth["access_token"], data=merged)
