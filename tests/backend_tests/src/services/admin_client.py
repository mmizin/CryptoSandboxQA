"""
HTTP client for admin-only routes (aligned with tests/ui-tests/src/services/admin.api.ts).
"""

from __future__ import annotations

from typing import Any

import httpx

from models.user.admin_registered_user import AdminRegisteredTestUser

from .user_client import UserClient


class AdminClient(UserClient):
    """Extends ``UserClient`` with methods for routes guarded by ``AdminGuard``."""

    def __enter__(self) -> AdminClient:
        return self

    def list_users(
        self,
        *,
        search: str | None = None,
        expected_failure: bool = False,
    ) -> dict[str, Any] | list[Any] | httpx.Response:
        params = {"search": search} if search is not None else None
        return self.get("/users", params=params, expected_failure=expected_failure)


def admin_client_from_registered(user: AdminRegisteredTestUser, **kwargs: Any) -> AdminClient:
    """Factory: build an ``AdminClient`` from an admin bootstrap result."""
    return AdminClient(user.access_token, **kwargs)
