"""
KAN-59 — TC-API-04: admin ``GET /admin/users/{userId}/orders`` and ``GET .../orders/{orderId}`` (6 rows).
"""

from __future__ import annotations

import uuid

import allure
import pytest

from factories.order_factory import OrderRequestFactory

from utils.http_assertions import response_assert_detail
from utils.order_api_helpers import configure_api_order_user, fund_user_for_trading

pytestmark = [pytest.mark.merge_gate]


def _uid(user) -> str:
    return str(user.data["id"])


@allure.epic("Trading")
@allure.feature("Orders API")
@allure.story("TC-API-04 admin orders")
def test_tc_api_04_admin_list_orders_returns_200(fxt_admin_user, fxt_regular_user) -> None:
    target = fxt_regular_user(configure_api_order_user("API TC-API-04 tgt list"))
    admin = fxt_admin_user(configure_api_order_user("API TC-API-04 adm list"))
    fund_user_for_trading(target.api)
    created = target.api.orders.create(OrderRequestFactory.spot_market_buy(quantity=0.001))
    listed = admin.api.admin_list_orders(_uid(target))
    order_ids = [o.id for o in listed.data]
    assert created.id in order_ids, (
        f"admin_list_orders: expected created id {created.id!r} in {order_ids!r}"
    )


@allure.epic("Trading")
@allure.feature("Orders API")
@allure.story("TC-API-04 admin orders")
def test_tc_api_04_admin_get_order_returns_200(fxt_admin_user, fxt_regular_user) -> None:
    target = fxt_regular_user(configure_api_order_user("API TC-API-04 tgt get"))
    admin = fxt_admin_user(configure_api_order_user("API TC-API-04 adm get"))
    fund_user_for_trading(target.api)
    created = target.api.orders.create(OrderRequestFactory.spot_limit_sell(price=58_000.0, quantity=0.001))
    got = admin.api.admin_get_order(_uid(target), created.id)
    assert got.id == created.id, (
        f"admin_get_order: expected id {created.id!r}, got {got.id!r}"
    )


@allure.epic("Trading")
@allure.feature("Orders API")
@allure.story("TC-API-04 admin orders")
def test_tc_api_04_admin_list_unknown_user_returns_404(fxt_admin_user) -> None:
    admin = fxt_admin_user(configure_api_order_user("API TC-API-04 404 usr"))
    fake = str(uuid.uuid4())
    response = admin.api.get(f"/admin/users/{fake}/orders", expected_failure=True)
    assert response.status_code == 404, (
        f"admin_list_unknown_user: expected HTTP 404; {response_assert_detail(response)}"
    )


@allure.epic("Trading")
@allure.feature("Orders API")
@allure.story("TC-API-04 admin orders")
def test_tc_api_04_admin_get_unknown_order_returns_404(fxt_admin_user, fxt_regular_user) -> None:
    target = fxt_regular_user(configure_api_order_user("API TC-API-04 404 ord"))
    admin = fxt_admin_user(configure_api_order_user("API TC-API-04 adm 404"))
    fund_user_for_trading(target.api)
    target.api.orders.create(OrderRequestFactory.spot_market_buy(quantity=0.001))
    response = admin.api.admin_get_order(_uid(target), str(uuid.uuid4()), expected_failure=True)
    assert response.status_code == 404, (
        f"admin_get_unknown_order: expected HTTP 404; {response_assert_detail(response)}"
    )


@allure.epic("Trading")
@allure.feature("Orders API")
@allure.story("TC-API-04 admin orders")
def test_tc_api_04_regular_user_cannot_list_admin_orders_forbidden(fxt_regular_user) -> None:
    victim = fxt_regular_user(configure_api_order_user("API TC-API-04 vict"))
    caller = fxt_regular_user(configure_api_order_user("API TC-API-04 caller"))
    response = caller.api.get(f"/admin/users/{_uid(victim)}/orders", expected_failure=True)
    assert response.status_code == 403, (
        f"user_cannot_list_admin_orders: expected HTTP 403; {response_assert_detail(response)}"
    )


@allure.epic("Trading")
@allure.feature("Orders API")
@allure.story("TC-API-04 admin orders")
def test_tc_api_04_regular_user_cannot_get_admin_order_forbidden(fxt_regular_user) -> None:
    victim = fxt_regular_user(configure_api_order_user("API TC-API-04 vict2"))
    caller = fxt_regular_user(configure_api_order_user("API TC-API-04 caller2"))
    fund_user_for_trading(victim.api)
    o = victim.api.orders.create(OrderRequestFactory.spot_market_buy(quantity=0.001))
    response = caller.api.get(f"/admin/users/{_uid(victim)}/orders/{o.id}", expected_failure=True)
    assert response.status_code == 403, (
        f"user_cannot_get_admin_order: expected HTTP 403; {response_assert_detail(response)}"
    )
