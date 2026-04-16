"""
KAN-60 — TC-API-05: cancel / set-status negative paths (4 rows).
"""

from __future__ import annotations

import uuid

from builders.order_builder import OrderBuilder
from factories.order_factory import OrderRequestFactory

from utils.order_api_helpers import assert_response_contains, configure_api_order_user, fund_user_for_trading


def test_tc_api_05_cancel_unknown_order_returns_400(fxt_regular_user) -> None:
    user = fxt_regular_user(configure_api_order_user("API TC-API-05 canc id"))
    r = user.api.http_client.post(f"/orders/{uuid.uuid4()}/cancel")
    assert r.status_code == 400
    assert_response_contains(r, "not found")


def test_tc_api_05_cancel_filled_order_rejected(fxt_regular_user) -> None:
    user = fxt_regular_user(configure_api_order_user("API TC-API-05 canc fill"))
    fund_user_for_trading(user.api)
    filled_body = (
        OrderBuilder()
        .spot()
        .buy()
        .limit(55_000.0)
        .quantity(0.001)
        .initial_status("filled")
        .build()
    )
    o = user.api.orders.create(filled_body)
    assert o.status == "filled"
    r = user.api.http_client.post(f"/orders/{o.id}/cancel")
    assert r.status_code == 400
    assert_response_contains(r, "Only open orders")


def test_tc_api_05_set_status_unknown_order_returns_400(fxt_regular_user) -> None:
    user = fxt_regular_user(configure_api_order_user("API TC-API-05 st id"))
    r = user.api.http_client.patch(
        f"/orders/{uuid.uuid4()}/status",
        json={"status": "filled"},
    )
    assert r.status_code == 400
    assert_response_contains(r, "not found")


def test_tc_api_05_set_status_invalid_enum_returns_400(fxt_regular_user) -> None:
    user = fxt_regular_user(configure_api_order_user("API TC-API-05 st bad"))
    fund_user_for_trading(user.api)
    o = user.api.orders.create(OrderRequestFactory.spot_limit_buy(price=57_000.0, quantity=0.001))
    r = user.api.http_client.patch(
        f"/orders/{o.id}/status",
        json={"status": "pending"},
    )
    assert r.status_code == 400
    assert_response_contains(r, "Status must be")
