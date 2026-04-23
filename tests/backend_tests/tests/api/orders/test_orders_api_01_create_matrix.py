"""
KAN-56 — TC-API-01: POST /orders positive matrix (8 rows).

spot/futures × market/limit × buy/sell via ``OrderRequestFactory``; users are funded before create.
"""

from __future__ import annotations

import allure
import pytest

from factories.order_factory import OrderRequestFactory
from models.trading.order_models import CreateOrderRequest
from utils.order_api_helpers import assert_create_order_201_and_shape, configure_api_order_user, fund_user_for_trading

_PX = 65_000.0

pytestmark = [pytest.mark.merge_gate, pytest.mark.smoke]

_TC_API_01_CASES: list[tuple[str, CreateOrderRequest]] = [
    ("spot_market_buy", OrderRequestFactory.spot_market_buy()),
    ("spot_market_sell", OrderRequestFactory.spot_market_sell()),
    ("spot_limit_buy", OrderRequestFactory.spot_limit_buy(price=_PX)),
    ("spot_limit_sell", OrderRequestFactory.spot_limit_sell(price=_PX)),
    ("futures_market_buy", OrderRequestFactory.futures_market_buy()),
    ("futures_market_sell", OrderRequestFactory.futures_market_sell()),
    ("futures_limit_buy", OrderRequestFactory.futures_limit_buy(price=_PX)),
    ("futures_limit_sell", OrderRequestFactory.futures_limit_sell(price=_PX)),
]


@allure.epic("Trading")
@allure.feature("Orders API")
@allure.story("TC-API-01 create order matrix")
class TestOrdersCreateMatrix:
    @pytest.mark.parametrize(
        "preset_name,body",
        _TC_API_01_CASES,
        ids=[x[0] for x in _TC_API_01_CASES],
    )
    def test_create_order_success(self, fxt_regular_user, preset_name, body) -> None:
        user = fxt_regular_user(configure_api_order_user("API TC-API-01"))
        fund_user_for_trading(user.api)
        assert_create_order_201_and_shape(user.api, body)
