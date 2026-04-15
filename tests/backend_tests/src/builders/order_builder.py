"""
Fluent builder for order create payloads (aligned with CreateOrderDto).
"""

from __future__ import annotations

from typing import Any

from models.trading.order_models import CreateOrderRequest


class OrderBuilder:
    """Defaults: spot, market, buy, BTC_USD, small quantity."""

    def __init__(self) -> None:
        self._symbol: str = "BTC_USD"
        self._side: str = "buy"
        self._order_type: str = "market"
        self._quantity: float = 0.001
        self._price: float | None = None
        self._market_type: str | None = "spot"
        self._initial_status: str | None = None

    def spot(self) -> OrderBuilder:
        self._market_type = "spot"
        return self

    def futures(self) -> OrderBuilder:
        self._market_type = "futures"
        return self

    def buy(self) -> OrderBuilder:
        self._side = "buy"
        return self

    def sell(self) -> OrderBuilder:
        self._side = "sell"
        return self

    def market(self) -> OrderBuilder:
        self._order_type = "market"
        self._price = None
        return self

    def limit(self, price: float) -> OrderBuilder:
        self._order_type = "limit"
        self._price = price
        return self

    def symbol(self, symbol: str) -> OrderBuilder:
        self._symbol = symbol
        return self

    def quantity(self, quantity: float) -> OrderBuilder:
        self._quantity = quantity
        return self

    def market_type(self, market_type: str | None) -> OrderBuilder:
        self._market_type = market_type
        return self

    def initial_status(self, status: str | None) -> OrderBuilder:
        self._initial_status = status
        return self

    def build(self) -> CreateOrderRequest:
        return CreateOrderRequest(
            symbol=self._symbol,
            side=self._side,
            order_type=self._order_type,
            quantity=self._quantity,
            price=self._price,
            market_type=self._market_type,
            initial_status=self._initial_status,
        )

    def build_dict(self) -> dict[str, Any]:
        return self.build().to_api_dict()
