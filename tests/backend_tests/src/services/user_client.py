"""
HTTP client for user-scoped routes (aligned with tests/ui-tests/src/services/user.api.ts).

``RegisteredTestUser.api`` is a lazy alias: same client as ``user_client_from_registered(user)``.
In tests, prefer ``user.api`` call sites; call ``user_client_from_registered`` directly only when passing custom kwargs.
"""

from __future__ import annotations

from functools import cached_property
from typing import TYPE_CHECKING, Any
from urllib.parse import urlencode

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

    def list_wallets(self) -> list[dict[str, Any]]:
        """GET /wallets — list of balance rows for the current user."""
        result = self.get("/wallets")
        assert isinstance(result, list)
        return result

    def list_transactions_deposits(
        self,
        *,
        limit: int | None = None,
        offset: int | None = None,
        from_date: str | None = None,
        to_date: str | None = None,
        expected_failure: bool = False,
    ) -> dict[str, Any] | httpx.Response:
        """GET /transactions/deposits."""
        q: dict[str, str] = {}
        if limit is not None:
            q["limit"] = str(limit)
        if offset is not None:
            q["offset"] = str(offset)
        if from_date:
            q["from"] = from_date
        if to_date:
            q["to"] = to_date
        path = "/transactions/deposits"
        if q:
            path = f"{path}?{urlencode(q)}"
        return self.get(path, expected_failure=expected_failure)


def user_client_from_registered(user: RegisteredTestUser, **kwargs: Any) -> UserClient:
    """Factory: build a ``UserClient`` from a registration/bootstrap result."""
    return UserClient(user.access_token, **kwargs)
