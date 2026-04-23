"""
KAN-60 — TC-API-05: cancel / set-status negative paths (4 rows).
"""

from __future__ import annotations

import uuid

import allure
import pytest

from builders.order_builder import OrderBuilder
from factories.order_factory import OrderRequestFactory

from utils.http_assertions import response_assert_detail
from utils.order_api_helpers import assert_response_contains, configure_api_order_user, fund_user_for_trading

pytestmark = [pytest.mark.merge_gate, pytest.mark.client_validation]


@allure.epic("Trading")
@allure.feature("Orders API")
@allure.story("TC-API-05 lifecycle negative")
def test_tc_api_05_cancel_unknown_order_returns_400(fxt_regular_user) -> None:
    user = fxt_regular_user(configure_api_order_user("API TC-API-05 canc id"))
    response = user.api.http_client.post(f"/orders/{uuid.uuid4()}/cancel")
    assert response.status_code == 400, (
        f"cancel_unknown_order: expected HTTP 400; {response_assert_detail(response)}"
    )
    assert_response_contains(
        response, "not found", context="cancel_unknown_order"
    )


@allure.epic("Trading")
@allure.feature("Orders API")
@allure.story("TC-API-05 lifecycle negative")
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
    assert o.status == "filled", f"expected filled order, got {o.status!r}"
    response = user.api.http_client.post(f"/orders/{o.id}/cancel")
    assert response.status_code == 400, (
        f"cancel_filled_order: expected HTTP 400; {response_assert_detail(response)}"
    )
    assert_response_contains(
        response, "Only open orders", context="cancel_filled_order"
    )


@allure.epic("Trading")
@allure.feature("Orders API")
@allure.story("TC-API-05 lifecycle negative")
def test_tc_api_05_set_status_unknown_order_returns_400(fxt_regular_user) -> None:
    user = fxt_regular_user(configure_api_order_user("API TC-API-05 st id"))
    response = user.api.http_client.patch(
        f"/orders/{uuid.uuid4()}/status",
        json={"status": "filled"},
    )
    assert response.status_code == 400, (
        f"set_status_unknown_order: expected HTTP 400; {response_assert_detail(response)}"
    )
    assert_response_contains(
        response, "not found", context="set_status_unknown_order"
    )


@allure.epic("Trading")
@allure.feature("Orders API")
@allure.story("TC-API-05 lifecycle negative")
def test_tc_api_05_set_status_invalid_enum_returns_400(fxt_regular_user) -> None:
    user = fxt_regular_user(configure_api_order_user("API TC-API-05 st bad"))
    fund_user_for_trading(user.api)
    o = user.api.orders.create(OrderRequestFactory.spot_limit_buy(price=57_000.0, quantity=0.001))
    response = user.api.http_client.patch(
        f"/orders/{o.id}/status",
        json={"status": "pending"},
    )
    assert response.status_code == 400, (
        f"set_status_invalid_enum: expected HTTP 400; {response_assert_detail(response)}"
    )
    assert_response_contains(
        response, "Status must be", context="set_status_invalid_enum"
    )
