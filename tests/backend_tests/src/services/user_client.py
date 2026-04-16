"""
HTTP client for user-scoped routes (aligned with tests/ui-tests/src/services/user.api.ts).

``RegisteredTestUser.api`` is a lazy alias: same client as ``user_client_from_registered(user)``.
"""

from __future__ import annotations

from functools import cached_property
from typing import TYPE_CHECKING, Any

import httpx

from models.user.registered_user import RegisteredTestUser

from .base_client import BaseClient, get_api_url

if TYPE_CHECKING:
    from .deposits_client import DepositsClient
    from .orders_client import OrdersClient


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

    @cached_property
    def orders(self) -> OrdersClient:
        """Orders API (``/orders``); shares this client's httpx session and Bearer token."""
        from .orders_client import OrdersClient

        return OrdersClient.from_user_client(self)

    @cached_property
    def deposits(self) -> DepositsClient:
        """Deposits API (``/deposits``); shares this client's httpx session and Bearer token."""
        from .deposits_client import DepositsClient

        return DepositsClient.from_user_client(self)

    def get_me(self) -> dict[str, Any] | httpx.Response:

        return self.get("/users/me")


def user_client_from_registered(user: RegisteredTestUser, **kwargs: Any) -> UserClient:
    """Factory: build a ``UserClient`` from a registration/bootstrap result."""
    return UserClient(user.access_token, **kwargs)
