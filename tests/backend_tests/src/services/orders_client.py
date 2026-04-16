"""
HTTP client for /orders routes (aligned with frontend ordersApi and OrdersController).

Use via ``RegisteredTestUser.api.orders`` — shares the same httpx client as ``UserClient``.
"""

from __future__ import annotations

from typing import Any
from urllib.parse import urlencode

import httpx

from models.trading.order_models import CreateOrderRequest, Order, OrdersListResponse

from .base_client import BaseClient
from .user_client import UserClient


def _orders_query_params(
    *,
    market_type: str | None = None,
    status: str | None = None,
    symbol: str | None = None,
    from_date: str | None = None,
    to_date: str | None = None,
    limit: int | None = None,
    offset: int | None = None,
) -> dict[str, str]:
    """Build query string using API camelCase names."""
    raw: dict[str, str | int] = {}
    if market_type is not None and market_type != "":
        raw["marketType"] = market_type
    if status is not None and status != "":
        raw["status"] = status
    if symbol is not None and symbol != "":
        raw["symbol"] = symbol
    if from_date is not None and from_date != "":
        raw["from"] = from_date
    if to_date is not None and to_date != "":
        raw["to"] = to_date
    if limit is not None:
        raw["limit"] = limit
    if offset is not None:
        raw["offset"] = offset
    return {k: str(v) for k, v in raw.items()}


class OrdersClient(BaseClient):
    """User-scoped /orders API; reuses the parent ``UserClient`` connection."""

    def __init__(self, user_client: UserClient) -> None:
        super().__init__(base_url=user_client.base_url, client=user_client.http_client)

    @classmethod
    def from_user_client(cls, user: UserClient) -> OrdersClient:
        return cls(user)

    def list(
        self,
        *,
        market_type: str | None = None,
        status: str | None = None,
        symbol: str | None = None,
        from_date: str | None = None,
        to_date: str | None = None,
        limit: int | None = None,
        offset: int | None = None,
        expected_failure: bool = False,
    ) -> OrdersListResponse | dict[str, Any] | httpx.Response:
        params = _orders_query_params(
            market_type=market_type,
            status=status,
            symbol=symbol,
            from_date=from_date,
            to_date=to_date,
            limit=limit,
            offset=offset,
        )
        q = urlencode(params)
        path = f"/orders?{q}" if q else "/orders"
        result = super().get(path, expected_failure=expected_failure)
        if expected_failure or isinstance(result, httpx.Response):
            return result
        assert isinstance(result, dict)
        return OrdersListResponse.from_api_dict(result)

    def create(
        self,
        body: CreateOrderRequest | dict[str, Any],
        *,
        expected_failure: bool = False,
    ) -> Order | dict[str, Any] | httpx.Response:
        payload = body.to_api_dict() if isinstance(body, CreateOrderRequest) else body
        result = super().post("/orders", json=payload, expected_failure=expected_failure)
        if expected_failure or isinstance(result, httpx.Response):
            return result
        assert isinstance(result, dict)
        return Order.from_api_dict(result)

    def get_order(
        self,
        order_id: str,
        *,
        expected_failure: bool = False,
    ) -> Order | dict[str, Any] | httpx.Response:
        result = super().get(f"/orders/{order_id}", expected_failure=expected_failure)
        if expected_failure or isinstance(result, httpx.Response):
            return result
        assert isinstance(result, dict)
        return Order.from_api_dict(result)

    def cancel(
        self,
        order_id: str,
        *,
        expected_failure: bool = False,
    ) -> Order | dict[str, Any] | httpx.Response:
        result = super().post(f"/orders/{order_id}/cancel", expected_failure=expected_failure)
        if expected_failure or isinstance(result, httpx.Response):
            return result
        assert isinstance(result, dict)
        return Order.from_api_dict(result)

    def set_status(
        self,
        order_id: str,
        status: str,
        *,
        expected_failure: bool = False,
    ) -> Order | dict[str, Any] | httpx.Response:
        result = super().patch(
            f"/orders/{order_id}/status",
            json={"status": status},
            expected_failure=expected_failure,
        )
        if expected_failure or isinstance(result, httpx.Response):
            return result
        assert isinstance(result, dict)
        return Order.from_api_dict(result)
