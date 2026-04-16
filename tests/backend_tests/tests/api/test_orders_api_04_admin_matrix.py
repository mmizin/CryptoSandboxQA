"""
KAN-59 — TC-API-04: admin ``GET /admin/users/{userId}/orders`` and ``GET .../orders/{orderId}`` (6 rows).
"""

from __future__ import annotations

import uuid

from factories.order_factory import OrderRequestFactory

from utils.order_api_helpers import configure_api_order_user, fund_user_for_trading


def _uid(user) -> str:
    return str(user.data["id"])


def test_tc_api_04_admin_list_orders_returns_200(fxt_admin_user, fxt_regular_user) -> None:
    target = fxt_regular_user(configure_api_order_user("API TC-API-04 tgt list"))
    admin = fxt_admin_user(configure_api_order_user("API TC-API-04 adm list"))
    fund_user_for_trading(target.api)
    created = target.api.orders.create(OrderRequestFactory.spot_market_buy(quantity=0.001))
    listed = admin.api.admin_list_orders(_uid(target))
    assert created.id in [o.id for o in listed.data]


def test_tc_api_04_admin_get_order_returns_200(fxt_admin_user, fxt_regular_user) -> None:
    target = fxt_regular_user(configure_api_order_user("API TC-API-04 tgt get"))
    admin = fxt_admin_user(configure_api_order_user("API TC-API-04 adm get"))
    fund_user_for_trading(target.api)
    created = target.api.orders.create(OrderRequestFactory.spot_limit_sell(price=58_000.0, quantity=0.001))
    got = admin.api.admin_get_order(_uid(target), created.id)
    assert got.id == created.id


def test_tc_api_04_admin_list_unknown_user_returns_404(fxt_admin_user) -> None:
    admin = fxt_admin_user(configure_api_order_user("API TC-API-04 404 usr"))
    fake = str(uuid.uuid4())
    r = admin.api.get(f"/admin/users/{fake}/orders", expected_failure=True)
    assert r.status_code == 404


def test_tc_api_04_admin_get_unknown_order_returns_404(fxt_admin_user, fxt_regular_user) -> None:
    target = fxt_regular_user(configure_api_order_user("API TC-API-04 404 ord"))
    admin = fxt_admin_user(configure_api_order_user("API TC-API-04 adm 404"))
    fund_user_for_trading(target.api)
    target.api.orders.create(OrderRequestFactory.spot_market_buy(quantity=0.001))
    r = admin.api.admin_get_order(_uid(target), str(uuid.uuid4()), expected_failure=True)
    assert r.status_code == 404


def test_tc_api_04_regular_user_cannot_list_admin_orders_forbidden(fxt_regular_user) -> None:
    victim = fxt_regular_user(configure_api_order_user("API TC-API-04 vict"))
    caller = fxt_regular_user(configure_api_order_user("API TC-API-04 caller"))
    r = caller.api.get(f"/admin/users/{_uid(victim)}/orders", expected_failure=True)
    assert r.status_code == 403


def test_tc_api_04_regular_user_cannot_get_admin_order_forbidden(fxt_regular_user) -> None:
    victim = fxt_regular_user(configure_api_order_user("API TC-API-04 vict2"))
    caller = fxt_regular_user(configure_api_order_user("API TC-API-04 caller2"))
    fund_user_for_trading(victim.api)
    o = victim.api.orders.create(OrderRequestFactory.spot_market_buy(quantity=0.001))
    r = caller.api.get(f"/admin/users/{_uid(victim)}/orders/{o.id}", expected_failure=True)
    assert r.status_code == 403
