"""
Factory presets for deposit requests (fiat card / SEPA, crypto BTC).

Delegates to ``DepositBuilder`` to avoid duplicating defaults.
"""

from __future__ import annotations

from models.payments.deposit_models import CryptoAddressRequest, DepositCryptoRequest, DepositFiatRequest

from builders.deposit_builder import DepositBuilder


class DepositRequestFactory:
    """Named presets for common fiat and crypto deposit bodies."""

    @staticmethod
    def usd_card(amount: float = 100.0) -> DepositFiatRequest:
        return DepositBuilder().usd().fiat_amount(amount).payment_method_type("card").build_fiat()

    @staticmethod
    def eur_sepa(amount: float = 100.0) -> DepositFiatRequest:
        return DepositBuilder().eur().fiat_amount(amount).payment_method_type("sepa").build_fiat()

    @staticmethod
    def eur_card(amount: float = 50.0) -> DepositFiatRequest:
        return DepositBuilder().eur().fiat_amount(amount).payment_method_type("card").build_fiat()

    @staticmethod
    def btc_deposit(
        amount: float = 0.001,
        wallet_address: str | None = None,
    ) -> DepositCryptoRequest:
        b = DepositBuilder().symbol("BTC").crypto_amount(amount)
        if wallet_address is not None:
            b = b.wallet_address(wallet_address)
        return b.build_crypto()

    @staticmethod
    def crypto_address_for_symbol(symbol: str = "BTC") -> CryptoAddressRequest:
        return CryptoAddressRequest(symbol=symbol)
