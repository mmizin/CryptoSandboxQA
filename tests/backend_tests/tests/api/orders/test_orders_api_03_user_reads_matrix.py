"""
KAN-58 — TC-API-03: user GET flows (7 rows) — ``GET /orders``, filters, ``/by-date``, ``/by-coin``,
``GET /{id}``, ``POST /{id}/cancel``, ``PATCH /{id}/status``.
"""

from __future__ import annotations

import allure
import pytest

from factories.order_factory import OrderRequestFactory
from models.trading.order_models import Order

from utils.order_api_helpers import configure_api_order_user, fund_user_for_trading

pytestmark = [pytest.mark.merge_gate, pytest.mark.smoke]


def _iso_wide_range() -> tuple[str, str]:
    return ("2020-01-01T00:00:00.000Z", "2035-12-31T23:59:59.999Z")


@allure.epic("Trading")
@allure.feature("Orders API")
@allure.story("TC-API-03 user reads")
class TestOrdersUserReads:
    def test_list_orders_includes_created_order(self, fxt_regular_user) -> None:
        user = fxt_regular_user(configure_api_order_user("API TC-API-03 list"))
        fund_user_for_trading(user.api)
        created = user.api.orders.create(OrderRequestFactory.spot_market_buy(quantity=0.001))
        assert isinstance(created, Order), f"expected Order, got {type(created).__name__!r}"
        listed = user.api.orders.list()
        ids = [o.id for o in listed.data]
        assert created.id in ids, f"list_orders: expected {created.id!r} in {ids!r}"
        assert listed.meta.total >= 1, f"list_orders: expected total>=1, got {listed.meta.total!r}"

    def test_list_filters_market_type_spot(self, fxt_regular_user) -> None:
        user = fxt_regular_user(configure_api_order_user("API TC-API-03 mtype"))
        fund_user_for_trading(user.api)
        user.api.orders.create(OrderRequestFactory.futures_market_buy(quantity=0.001))
        spot_o = user.api.orders.create(OrderRequestFactory.spot_market_buy(quantity=0.001))
        filtered = user.api.orders.list(market_type="spot")
        ids = [o.id for o in filtered.data]
        assert spot_o.id in ids, f"list_filter_spot: expected {spot_o.id!r} in {ids!r}"
        assert all(o.market_type == "spot" for o in filtered.data), (
            f"list_filter_spot: expected all spot, got {[o.market_type for o in filtered.data]!r}"
        )

    def test_orders_by_date_returns_created(self, fxt_regular_user) -> None:
        user = fxt_regular_user(configure_api_order_user("API TC-API-03 by-date"))
        fund_user_for_trading(user.api)
        created = user.api.orders.create(OrderRequestFactory.spot_limit_buy(price=60_000.0, quantity=0.001))
        frm, to = _iso_wide_range()
        byd = user.api.orders.list_by_date(from_date=frm, to_date=to, limit=50, offset=0)
        ids = [o.id for o in byd.data]
        assert created.id in ids, f"by_date: expected {created.id!r} in {ids!r}"

    def test_orders_by_coin_filters_symbol(self, fxt_regular_user) -> None:
        user = fxt_regular_user(configure_api_order_user("API TC-API-03 by-coin"))
        fund_user_for_trading(user.api)
        created = user.api.orders.create(OrderRequestFactory.spot_market_sell(quantity=0.001))
        byc = user.api.orders.list_by_coin("BTC_USD", limit=50, offset=0)
        assert all(o.symbol == "BTC_USD" for o in byc.data), (
            f"by_coin: expected symbol BTC_USD, got {[o.symbol for o in byc.data]!r}"
        )
        ids = [o.id for o in byc.data]
        assert created.id in ids, f"by_coin: expected {created.id!r} in {ids!r}"

    def test_get_order_by_id(self, fxt_regular_user) -> None:
        user = fxt_regular_user(configure_api_order_user("API TC-API-03 get"))
        fund_user_for_trading(user.api)
        created = user.api.orders.create(OrderRequestFactory.spot_market_buy(quantity=0.001))
        got = user.api.orders.get_order(created.id)
        assert got.id == created.id, f"get_order: id mismatch, got {got.id!r} expected {created.id!r}"
        assert got.user_id == created.user_id, (
            f"get_order: user_id mismatch, got {got.user_id!r} expected {created.user_id!r}"
        )

    def test_cancel_open_order(self, fxt_regular_user) -> None:
        user = fxt_regular_user(configure_api_order_user("API TC-API-03 cancel"))
        fund_user_for_trading(user.api)
        o = user.api.orders.create(OrderRequestFactory.spot_limit_buy(price=62_000.0, quantity=0.001))
        cancelled = user.api.orders.cancel(o.id)
        assert cancelled.status == "cancelled", f"cancel: expected status cancelled, got {cancelled.status!r}"

    def test_patch_status_to_filled(self, fxt_regular_user) -> None:
        user = fxt_regular_user(configure_api_order_user("API TC-API-03 patch"))
        fund_user_for_trading(user.api)
        o = user.api.orders.create(OrderRequestFactory.spot_limit_buy(price=63_000.0, quantity=0.002))
        assert o.status == "open", f"patch_status: expected open before patch, got {o.status!r}"
        filled = user.api.orders.set_status(o.id, "filled")
        assert filled.status == "filled", f"patch_status: expected filled, got {filled.status!r}"
