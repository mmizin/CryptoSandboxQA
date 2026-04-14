"""
HTTP client for user-scoped routes (aligned with tests/ui-tests/src/services/user.api.ts).
"""

from __future__ import annotations

from typing import Any

import httpx

from models.user.registered_user import RegisteredTestUser

from .base_client import BaseClient, get_api_url


class UserClient(BaseClient):
    """httpx wrapper with ``Authorization: Bearer`` for user-scoped routes."""

    def __init__(
        self,
        access_token: str,
        base_url: str | None = None,
        *,
        client: httpx.Client | None = None,
        timeout: float = 30.0,
    ) -> None:
        resolved_base = (base_url or get_api_url()).rstrip("/")
        if client is None:
            client = httpx.Client(
                base_url=resolved_base,
                timeout=timeout,
                headers={"Authorization": f"Bearer {access_token}"},
            )
        super().__init__(base_url=resolved_base, client=client, timeout=timeout)

    def __enter__(self) -> UserClient:
        return self

    def get_me(
        self,
        *,
        expected_failure: bool = False,
    ) -> dict[str, Any] | httpx.Response:
        return self.get("/users/me", expected_failure=expected_failure)


def user_client_from_registered(user: RegisteredTestUser, **kwargs: Any) -> UserClient:
    """Factory: build a ``UserClient`` from a registration/bootstrap result."""
    return UserClient(user.access_token, **kwargs)
