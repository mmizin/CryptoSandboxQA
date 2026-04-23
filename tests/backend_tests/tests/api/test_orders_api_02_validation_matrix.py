"""
KAN-57 — TC-API-02: POST/GET orders negative matrix (14 rows): 401 + validation + insufficient balance.
"""

from __future__ import annotations

import httpx
import pytest

from factories.order_factory import OrderRequestFactory
from models.trading.order_models import CreateOrderRequest

from services.base_client import get_api_url
from utils.http_assertions import response_assert_detail
from utils.order_api_helpers import assert_response_contains, configure_api_order_user

pytestmark = [pytest.mark.merge_gate, pytest.mark.client_validation]


def _client_no_auth() -> httpx.Client:
    return httpx.Client(base_url=get_api_url(), timeout=30.0)


def test_tc_api_02_post_orders_without_bearer_returns_401() -> None:
    payload = OrderRequestFactory.spot_market_buy().to_api_dict()
    with _client_no_auth() as c:
        response = c.post("/orders", json=payload)
    assert response.status_code == 401, (
        f"post_orders_no_bearer: expected HTTP 401; {response_assert_detail(response)}"
    )
    assert_response_contains(
        response,
        "401",
        "Unauthorized",
        context="post_orders_no_bearer",
    )


def test_tc_api_02_insufficient_balance_buy_market(fxt_regular_user) -> None:
    user = fxt_regular_user(configure_api_order_user("API TC-API-02 ib buy"))
    payload = OrderRequestFactory.spot_market_buy(quantity=1000.0).to_api_dict()
    response = user.api.http_client.post("/orders", json=payload)
    assert response.status_code == 400, (
        f"tc_api_02: expected HTTP 400; {response_assert_detail(response)}"
    )
    assert_response_contains(
        response, "Insufficient balance")


def test_tc_api_02_insufficient_balance_sell_market(fxt_regular_user) -> None:
    user = fxt_regular_user(configure_api_order_user("API TC-API-02 ib sell"))
    payload = OrderRequestFactory.spot_market_sell(quantity=500.0).to_api_dict()
    response = user.api.http_client.post("/orders", json=payload)
    assert response.status_code == 400, (
        f"tc_api_02: expected HTTP 400; {response_assert_detail(response)}"
    )
    assert_response_contains(
        response, "Insufficient balance")


def test_tc_api_02_invalid_trading_pair_not_in_seed(fxt_regular_user) -> None:
    user = fxt_regular_user(configure_api_order_user("API TC-API-02 bad pair"))
    payload = CreateOrderRequest(
        symbol="ZZZ_USD",
        side="buy",
        order_type="market",
        quantity=0.001,
        market_type="spot",
    ).to_api_dict()
    response = user.api.http_client.post("/orders", json=payload)
    assert response.status_code == 400, (
        f"tc_api_02: expected HTTP 400; {response_assert_detail(response)}"
    )
    assert_response_contains(
        response, "Invalid symbol")


def test_tc_api_02_side_must_be_buy_or_sell(fxt_regular_user) -> None:
    user = fxt_regular_user(configure_api_order_user("API TC-API-02 side"))
    payload = OrderRequestFactory.spot_market_buy().to_api_dict()
    payload["side"] = "hold"
    response = user.api.http_client.post("/orders", json=payload)
    assert response.status_code == 400, (
        f"tc_api_02: expected HTTP 400; {response_assert_detail(response)}"
    )
    assert_response_contains(
        response, "side must be one of the following values")


def test_tc_api_02_type_must_be_limit_or_market(fxt_regular_user) -> None:
    user = fxt_regular_user(configure_api_order_user("API TC-API-02 type"))
    payload = OrderRequestFactory.spot_market_buy().to_api_dict()
    payload["type"] = "stop"
    response = user.api.http_client.post("/orders", json=payload)
    assert response.status_code == 400, (
        f"tc_api_02: expected HTTP 400; {response_assert_detail(response)}"
    )
    assert_response_contains(
        response, "type must be one of the following values")


def test_tc_api_02_quantity_must_be_positive(fxt_regular_user) -> None:
    user = fxt_regular_user(configure_api_order_user("API TC-API-02 qty"))
    payload = OrderRequestFactory.spot_market_buy().to_api_dict()
    payload["quantity"] = 0
    response = user.api.http_client.post("/orders", json=payload)
    assert response.status_code == 400, (
        f"tc_api_02: expected HTTP 400; {response_assert_detail(response)}"
    )
    assert_response_contains(
        response, "positive")


def test_tc_api_02_limit_requires_positive_price(fxt_regular_user) -> None:
    user = fxt_regular_user(configure_api_order_user("API TC-API-02 limit no px"))
    body = OrderRequestFactory.spot_limit_buy(price=65_000.0).to_api_dict()
    del body["price"]
    response = user.api.http_client.post("/orders", json=body)
    assert response.status_code == 400, (
        f"tc_api_02: expected HTTP 400; {response_assert_detail(response)}"
    )
    assert_response_contains(
        response, "price", "Limit")


def test_tc_api_02_limit_price_must_be_positive(fxt_regular_user) -> None:
    user = fxt_regular_user(configure_api_order_user("API TC-API-02 px 0"))
    payload = OrderRequestFactory.spot_limit_buy(price=65_000.0).to_api_dict()
    payload["price"] = 0
    response = user.api.http_client.post("/orders", json=payload)
    assert response.status_code == 400, (
        f"tc_api_02: expected HTTP 400; {response_assert_detail(response)}"
    )
    assert_response_contains(
        response, "price", "positive")


def test_tc_api_02_symbol_base_quote_format(fxt_regular_user) -> None:
    user = fxt_regular_user(configure_api_order_user("API TC-API-02 sym fmt"))
    payload = OrderRequestFactory.spot_market_buy().to_api_dict()
    payload["symbol"] = "btc_usd"
    response = user.api.http_client.post("/orders", json=payload)
    assert response.status_code == 400, (
        f"tc_api_02: expected HTTP 400; {response_assert_detail(response)}"
    )
    assert_response_contains(
        response, "Symbol", "BASE_QUOTE")


def test_tc_api_02_market_type_enumeration(fxt_regular_user) -> None:
    user = fxt_regular_user(configure_api_order_user("API TC-API-02 mkt"))
    payload = OrderRequestFactory.spot_market_buy().to_api_dict()
    payload["marketType"] = "fx"
    response = user.api.http_client.post("/orders", json=payload)
    assert response.status_code == 400, (
        f"tc_api_02: expected HTTP 400; {response_assert_detail(response)}"
    )
    assert_response_contains(
        response, "marketType")


def test_tc_api_02_initial_status_enumeration(fxt_regular_user) -> None:
    user = fxt_regular_user(configure_api_order_user("API TC-API-02 init"))
    payload = OrderRequestFactory.spot_market_buy().to_api_dict()
    payload["initialStatus"] = "pending"
    response = user.api.http_client.post("/orders", json=payload)
    assert response.status_code == 400, (
        f"tc_api_02: expected HTTP 400; {response_assert_detail(response)}"
    )
    assert_response_contains(
        response, "initialStatus")


def test_tc_api_02_get_orders_without_bearer_returns_401() -> None:
    with _client_no_auth() as c:
        response = c.get("/orders")
    assert response.status_code == 401, (
        f"get_orders_no_bearer: expected HTTP 401; {response_assert_detail(response)}"
    )
    assert_response_contains(
        response, "401", "Unauthorized", context="get_orders_no_bearer"
    )


def test_tc_api_02_get_order_by_id_without_bearer_returns_401() -> None:
    with _client_no_auth() as c:
        response = c.get("/orders/00000000-0000-4000-8000-000000000001")
    assert response.status_code == 401, (
        f"get_order_by_id_no_bearer: expected HTTP 401; {response_assert_detail(response)}"
    )
    assert_response_contains(
        response, "401", "Unauthorized", context="get_order_by_id_no_bearer"
    )
