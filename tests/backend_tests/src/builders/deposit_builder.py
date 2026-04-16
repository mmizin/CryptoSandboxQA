"""
Fluent builders for deposit request payloads (aligned with DepositFiatDto / DepositCryptoDto).
"""

from __future__ import annotations

from typing import Any

from models.payments.deposit_models import (
    CryptoAddressRequest,
    DepositCryptoRequest,
    DepositFiatRequest,
)


class DepositBuilder:
    """Defaults: USD card deposit 100; crypto BTC 0.001 with a placeholder on-chain address."""

    def __init__(self) -> None:
        self._fiat_currency: str = "USD"
        self._fiat_amount: float = 100.0
        self._payment_method_id: str | None = None
        self._payment_method_type: str | None = "card"
        self._crypto_symbol: str = "BTC"
        self._crypto_amount: float = 0.001
        self._wallet_address: str = "bc1qtraining000000000000000000000000000000000000"
        self._tx_hash: str | None = None

    def usd(self) -> DepositBuilder:
        self._fiat_currency = "USD"
        return self

    def eur(self) -> DepositBuilder:
        self._fiat_currency = "EUR"
        return self

    def fiat_amount(self, amount: float) -> DepositBuilder:
        self._fiat_amount = amount
        return self

    def payment_method_type(self, value: str | None) -> DepositBuilder:
        self._payment_method_type = value
        return self

    def payment_method_id(self, value: str | None) -> DepositBuilder:
        self._payment_method_id = value
        return self

    def symbol(self, symbol: str) -> DepositBuilder:
        self._crypto_symbol = symbol
        return self

    def crypto_amount(self, amount: float) -> DepositBuilder:
        self._crypto_amount = amount
        return self

    def wallet_address(self, address: str) -> DepositBuilder:
        self._wallet_address = address
        return self

    def tx_hash(self, value: str | None) -> DepositBuilder:
        self._tx_hash = value
        return self

    def build_fiat(self) -> DepositFiatRequest:
        return DepositFiatRequest(
            fiat_currency=self._fiat_currency,
            amount=self._fiat_amount,
            payment_method_id=self._payment_method_id,
            payment_method_type=self._payment_method_type,
        )

    def build_fiat_dict(self) -> dict[str, Any]:
        return self.build_fiat().to_api_dict()

    def build_crypto(self) -> DepositCryptoRequest:
        return DepositCryptoRequest(
            symbol=self._crypto_symbol,
            amount=self._crypto_amount,
            wallet_address=self._wallet_address,
            tx_hash=self._tx_hash,
        )

    def build_crypto_dict(self) -> dict[str, Any]:
        return self.build_crypto().to_api_dict()

    def build_crypto_address_request(self) -> CryptoAddressRequest:
        return CryptoAddressRequest(symbol=self._crypto_symbol)
