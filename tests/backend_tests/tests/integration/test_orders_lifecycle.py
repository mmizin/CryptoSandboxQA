"""
Integration journeys: deposits → orders → portfolio balances (KAN-55 / KAN-63, KAN-64).

Each test uses an integration-prefixed identity and is independent for pytest-xdist.
"""

from __future__ import annotations

import time
from collections.abc import Callable
from typing import Any

import allure
import pytest

from builders.user_builder import UserBuilder
from factories.order_factory import OrderRequestFactory
from models.payments.deposit_models import DepositFiatRequest
from models.trading.order_models import Order
from models.user.registered_user import RegisteredTestUser

pytestmark = [pytest.mark.e2e, pytest.mark.merge_gate, pytest.mark.smoke]


def _int_user_configure(label: str) -> Callable[[UserBuilder], UserBuilder]:
    """Unique integration-layer user (email, display name, username)."""

    ms = int(time.time() * 1000)

    def _apply(builder: UserBuilder) -> UserBuilder:
        return (
            builder.with_email(f"int.orders.{label}.{ms}@test.com")
            .with_display_name(f"Integration Orders {label} {ms}")
            .with_username(f"io_{label}_{ms}")
        )

    return _apply


def _balances_map(portfolio: dict[str, Any]) -> dict[str, dict[str, str]]:
    out: dict[str, dict[str, str]] = {}
    for row in portfolio.get("balances") or []:
        if not isinstance(row, dict):
            continue
        asset = str(row.get("asset", ""))
        if asset:
            out[asset] = {
                "available": str(row.get("available", "0")),
                "locked": str(row.get("locked", "0")),
                "total": str(row.get("total", "0")),
            }
    return out


def _f(port: str) -> float:
    return float(port)


def _portfolio(user: RegisteredTestUser) -> dict[str, Any]:
    raw = user.api.get("/portfolio/balances")
    assert isinstance(raw, dict), f"expected dict from /portfolio/balances, got {type(raw).__name__!r}"
    return raw


@allure.epic("Trading")
@allure.feature("Orders integration")
@allure.story("TC-INT-01 deposit market buy balances")
def test_tc_int_01_deposit_market_buy_order_list_and_balances(
    fxt_regular_user: Callable[..., RegisteredTestUser],
) -> None:
    """
    TC-INT-01: Register → fiat deposit → spot market buy → order listed;
    USD available/locked consistent while the order stays open (no counterparty in an empty book).
    """
    with allure.step("Register user and fund via fiat deposit"):
        user = fxt_regular_user(_int_user_configure("tc01"), minimal=True)
        user.api.deposits.deposit_fiat(
            DepositFiatRequest(fiat_currency="USD", amount=50_000.0, payment_method_type="sepa"),
        )

    with allure.step("Snapshot balances after deposit"):
        after_deposit = _balances_map(_portfolio(user))
        assert "USD" in after_deposit, f"tc_int_01: expected USD in balances after deposit, got {list(after_deposit)!r}"
        usd_avail_before = _f(after_deposit["USD"]["available"])

    with allure.step("Place spot market buy"):
        req = OrderRequestFactory.spot_market_buy(symbol="BTC_USD", quantity=0.001)
        created = user.api.orders.create(req)
        assert isinstance(created, Order), f"expected Order, got {type(created).__name__!r}"
        assert created.symbol == "BTC_USD", f"expected symbol BTC_USD, got {created.symbol!r}"
        assert created.order_type == "market", f"expected market order, got {created.order_type!r}"
        assert created.status == "open", f"expected open status, got {created.status!r}"

    with allure.step("List orders and assert open order visible"):
        listed = user.api.orders.list(symbol="BTC_USD", limit=20)
        assert listed.total >= 1, f"list orders: expected total>=1, got {listed.total!r}"
        ids = {o.id for o in listed.data}
        assert created.id in ids, f"list orders: expected id {created.id!r} in {ids!r}"

    with allure.step("Assert USD locked vs available conservation"):
        after_order = _balances_map(_portfolio(user))
        assert "USD" in after_order, f"tc_int_01: expected USD in balances after order, got {list(after_order)!r}"
        locked = _f(after_order["USD"]["locked"])
        avail = _f(after_order["USD"]["available"])
        assert locked > 0, f"expected locked>0 for open order, got locked={locked!r} avail={avail!r}"
        assert avail + locked == pytest.approx(usd_avail_before, rel=1e-6, abs=1e-4), (
            f"tc_int_01: conservation expected avail+locked≈{usd_avail_before}, got {avail + locked!r} "
            f"(avail={avail!r} locked={locked!r})"
        )


@allure.epic("Trading")
@allure.feature("Orders integration")
@allure.story("TC-INT-02 limit buy cancel unlocks quote")
def test_tc_int_02_limit_buy_cancel_unlocks_quote(
    fxt_regular_user: Callable[..., RegisteredTestUser],
) -> None:
    """
    TC-INT-02: Fund user → limit buy far below market (stays open) → snapshot locked quote →
    cancel → status cancelled and locked USD released vs post-create snapshot.
    """
    with allure.step("Fund user for trading"):
        user = fxt_regular_user(_int_user_configure("tc02"), minimal=True)
        user.api.deposits.deposit_fiat(
            DepositFiatRequest(fiat_currency="USD", amount=50_000.0, payment_method_type="sepa"),
        )

    with allure.step("Place deep limit buy (stays open)"):
        # Price deliberately below typical last price so matching skips counterpart sell liquidity.
        req = OrderRequestFactory.spot_limit_buy(price=1.0, symbol="BTC_USD", quantity=0.001)
        created = user.api.orders.create(req)
        assert isinstance(created, Order), f"expected Order, got {type(created).__name__!r}"
        assert created.status == "open", f"expected open, got {created.status!r}"
        assert created.order_type == "limit", f"expected limit, got {created.order_type!r}"

    with allure.step("Snapshot locked quote after create"):
        after_create = _balances_map(_portfolio(user))
        locked_after_create = _f(after_create["USD"]["locked"])
        expected_reserve = 0.001 * 1.0
        assert locked_after_create == pytest.approx(expected_reserve, rel=0, abs=1e-2), (
            f"tc_int_02: expected locked≈{expected_reserve}, got {locked_after_create!r}"
        )

    with allure.step("Cancel order and assert locked released"):
        cancelled = user.api.orders.cancel(created.id)
        assert isinstance(cancelled, Order), f"expected Order from cancel, got {type(cancelled).__name__!r}"
        assert cancelled.status == "cancelled", f"expected cancelled, got {cancelled.status!r}"

        after_cancel = _balances_map(_portfolio(user))
        locked_end = _f(after_cancel["USD"]["locked"])
        assert locked_end == pytest.approx(0.0, abs=1e-6), (
            f"tc_int_02: expected locked≈0 after cancel, got {locked_end!r}"
        )
