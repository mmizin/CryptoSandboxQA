"""
Factory presets for create-order requests (spot vs futures matrix).

Delegates to ``OrderBuilder`` to avoid duplicating defaults.
"""

from __future__ import annotations

from models.trading.order_models import CreateOrderRequest

from builders.order_builder import OrderBuilder


class OrderRequestFactory:
    """Named presets for common spot/futures × market/limit × buy/sell combinations."""

    @staticmethod
    def spot_market_buy(
        symbol: str = "BTC_USD",
        quantity: float = 0.001,
    ) -> CreateOrderRequest:
        return OrderBuilder().spot().buy().market().symbol(symbol).quantity(quantity).build()

    @staticmethod
    def spot_market_sell(
        symbol: str = "BTC_USD",
        quantity: float = 0.001,
    ) -> CreateOrderRequest:
        return OrderBuilder().spot().sell().market().symbol(symbol).quantity(quantity).build()

    @staticmethod
    def spot_limit_buy(
        price: float,
        symbol: str = "BTC_USD",
        quantity: float = 0.001,
    ) -> CreateOrderRequest:
        return OrderBuilder().spot().buy().limit(price).symbol(symbol).quantity(quantity).build()

    @staticmethod
    def spot_limit_sell(
        price: float,
        symbol: str = "BTC_USD",
        quantity: float = 0.001,
    ) -> CreateOrderRequest:
        return OrderBuilder().spot().sell().limit(price).symbol(symbol).quantity(quantity).build()

    @staticmethod
    def futures_market_buy(
        symbol: str = "BTC_USD",
        quantity: float = 0.001,
    ) -> CreateOrderRequest:
        return OrderBuilder().futures().buy().market().symbol(symbol).quantity(quantity).build()

    @staticmethod
    def futures_market_sell(
        symbol: str = "BTC_USD",
        quantity: float = 0.001,
    ) -> CreateOrderRequest:
        return OrderBuilder().futures().sell().market().symbol(symbol).quantity(quantity).build()

    @staticmethod
    def futures_limit_buy(
        price: float,
        symbol: str = "BTC_USD",
        quantity: float = 0.001,
    ) -> CreateOrderRequest:
        return OrderBuilder().futures().buy().limit(price).symbol(symbol).quantity(quantity).build()

    @staticmethod
    def futures_limit_sell(
        price: float,
        symbol: str = "BTC_USD",
        quantity: float = 0.001,
    ) -> CreateOrderRequest:
        return OrderBuilder().futures().sell().limit(price).symbol(symbol).quantity(quantity).build()
