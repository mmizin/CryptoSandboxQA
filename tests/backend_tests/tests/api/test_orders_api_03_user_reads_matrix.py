"""
KAN-58 — TC-API-03: user GET flows (7 rows) — ``GET /orders``, filters, ``/by-date``, ``/by-coin``,
``GET /{id}``, ``POST /{id}/cancel``, ``PATCH /{id}/status``.
"""

from __future__ import annotations

from factories.order_factory import OrderRequestFactory
from models.trading.order_models import Order

from utils.order_api_helpers import configure_api_order_user, fund_user_for_trading


def _iso_wide_range() -> tuple[str, str]:
    return ("2020-01-01T00:00:00.000Z", "2035-12-31T23:59:59.999Z")


def test_tc_api_03_list_orders_includes_created_order(fxt_regular_user) -> None:
    user = fxt_regular_user(configure_api_order_user("API TC-API-03 list"))
    fund_user_for_trading(user.api)
    created = user.api.orders.create(OrderRequestFactory.spot_market_buy(quantity=0.001))
    assert isinstance(created, Order)
    listed = user.api.orders.list()
    ids = [o.id for o in listed.data]
    assert created.id in ids
    assert listed.meta.total >= 1


def test_tc_api_03_list_filters_market_type_spot(fxt_regular_user) -> None:
    user = fxt_regular_user(configure_api_order_user("API TC-API-03 mtype"))
    fund_user_for_trading(user.api)
    user.api.orders.create(OrderRequestFactory.futures_market_buy(quantity=0.001))
    spot_o = user.api.orders.create(OrderRequestFactory.spot_market_buy(quantity=0.001))
    filtered = user.api.orders.list(market_type="spot")
    ids = [o.id for o in filtered.data]
    assert spot_o.id in ids
    assert all(o.market_type == "spot" for o in filtered.data)


def test_tc_api_03_orders_by_date_returns_created(fxt_regular_user) -> None:
    user = fxt_regular_user(configure_api_order_user("API TC-API-03 by-date"))
    fund_user_for_trading(user.api)
    created = user.api.orders.create(OrderRequestFactory.spot_limit_buy(price=60_000.0, quantity=0.001))
    frm, to = _iso_wide_range()
    byd = user.api.orders.list_by_date(from_date=frm, to_date=to, limit=50, offset=0)
    ids = [o.id for o in byd.data]
    assert created.id in ids


def test_tc_api_03_orders_by_coin_filters_symbol(fxt_regular_user) -> None:
    user = fxt_regular_user(configure_api_order_user("API TC-API-03 by-coin"))
    fund_user_for_trading(user.api)
    created = user.api.orders.create(OrderRequestFactory.spot_market_sell(quantity=0.001))
    byc = user.api.orders.list_by_coin("BTC_USD", limit=50, offset=0)
    assert all(o.symbol == "BTC_USD" for o in byc.data)
    ids = [o.id for o in byc.data]
    assert created.id in ids


def test_tc_api_03_get_order_by_id(fxt_regular_user) -> None:
    user = fxt_regular_user(configure_api_order_user("API TC-API-03 get"))
    fund_user_for_trading(user.api)
    created = user.api.orders.create(OrderRequestFactory.spot_market_buy(quantity=0.001))
    got = user.api.orders.get_order(created.id)
    assert got.id == created.id
    assert got.user_id == created.user_id


def test_tc_api_03_cancel_open_order(fxt_regular_user) -> None:
    user = fxt_regular_user(configure_api_order_user("API TC-API-03 cancel"))
    fund_user_for_trading(user.api)
    o = user.api.orders.create(OrderRequestFactory.spot_limit_buy(price=62_000.0, quantity=0.001))
    cancelled = user.api.orders.cancel(o.id)
    assert cancelled.status == "cancelled"


def test_tc_api_03_patch_status_to_filled(fxt_regular_user) -> None:
    user = fxt_regular_user(configure_api_order_user("API TC-API-03 patch"))
    fund_user_for_trading(user.api)
    o = user.api.orders.create(OrderRequestFactory.spot_limit_buy(price=63_000.0, quantity=0.002))
    assert o.status == "open"
    filled = user.api.orders.set_status(o.id, "filled")
    assert filled.status == "filled"
