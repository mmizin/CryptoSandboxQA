"""
Shared helpers for Orders API pytest modules (KAN-53): funding, uniqueness, assertions.
"""

from __future__ import annotations

import secrets
import time
from collections.abc import Callable

import httpx

from builders.deposit_builder import DepositBuilder
from builders.user_builder import UserBuilder
from models.trading.order_models import CreateOrderRequest
from services.user_client import UserClient
from utils.http_assertions import response_assert_detail


def unique_ms() -> int:
    return int(time.time() * 1000)


def configure_api_order_user(
    display_prefix: str = "API Orders",
) -> Callable[[UserBuilder], UserBuilder]:
    """Return a callback for ``fxt_regular_user`` / ``fxt_admin_user``: unique api-prefixed identity."""

    def _cb(builder: UserBuilder) -> UserBuilder:
        suffix = unique_ms()
        frag = secrets.token_hex(3)
        return (
            builder.with_unique_email()
            .with_display_name(f"{display_prefix} {suffix}-{frag}")
            .with_username(f"api_ord_{suffix}{frag}")
        )

    return _cb


def fund_user_for_trading(api: UserClient) -> None:
    """Large fiat + BTC deposits so spot/futures market/limit buy & sell paths can lock balances."""
    api.deposits.deposit_fiat(DepositBuilder().usd().fiat_amount(1_000_000.0).build_fiat())
    api.deposits.deposit_crypto(
        DepositBuilder()
        .symbol("BTC")
        .crypto_amount(500.0)
        .wallet_address(f"bc1qapi{secrets.token_hex(20)}")
        .build_crypto()
    )


def assert_response_contains(resp: object, *needles: str, context: str = "") -> None:
    """Assert at least one needle appears in the raw body (4xx/5xx JSON or Nest validation)."""
    text = (getattr(resp, "text", None) or "") if not isinstance(resp, str) else resp
    low = text.lower()
    ok = any(n.lower() in low for n in needles if n)
    if ok:
        return
    prefix = f"{context}: " if context else ""
    if isinstance(resp, httpx.Response):
        extra = response_assert_detail(resp)
    else:
        extra = f"body_excerpt={text[:2000]!r}"
    msg = f"{prefix}expected at least one of {needles!r} in response body; {extra}"
    raise AssertionError(msg)


def assert_create_order_201_and_shape(api: UserClient, body: CreateOrderRequest) -> None:
    """POST /orders returns 201 and JSON compatible with ``Order.from_api_dict``."""
    payload = body.to_api_dict()
    response = api.http_client.post("/orders", json=payload)
    assert response.status_code == 201, (
        f"assert_create_order_201: expected HTTP 201; {response_assert_detail(response)}"
    )
    data = response.json()
    assert data.get("id"), f"assert_create_order_201: expected id in body, got {data!r}"
    assert data.get("symbol") == body.symbol, (
        f"assert_create_order_201: expected symbol {body.symbol!r}, got {data.get('symbol')!r} body={data!r}"
    )
    assert data.get("userId") or data.get("user_id"), (
        f"assert_create_order_201: expected userId in body, got {data!r}"
    )
