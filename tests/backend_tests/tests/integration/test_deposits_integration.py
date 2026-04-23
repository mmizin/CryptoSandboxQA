"""
Deposits integration chains — KAN-69 / KAN-76, KAN-77.
"""

from __future__ import annotations

import time
from decimal import Decimal

from factories.user_factory import UserFactory
from models.payments.deposit_models import (
    CryptoDepositAddressResponse,
    CryptoDepositCreatedResponse,
    FiatDepositCreatedResponse,
)
from services.auth_client import AuthClient
from strategies.user.api_strategy import ApiUserCreationStrategy


def _make_user(display_suffix: str):
    strategy = ApiUserCreationStrategy(AuthClient())
    factory = UserFactory()
    ms = int(time.time() * 1000)
    return factory.create(
        strategy,
        lambda b: b.with_display_name(f"int-dep-{display_suffix}-{ms}").with_username(f"u_intdep_{ms}_{display_suffix}"),
    )


def _usd_available(wallets: list[dict]) -> Decimal:
    row = next((w for w in wallets if w.get("asset") == "USD"), None)
    if not row:
        return Decimal(0)
    return Decimal(str(row.get("balanceAvailable") or row.get("balance_available") or 0))


def _btc_available(wallets: list[dict]) -> Decimal:
    row = next((w for w in wallets if w.get("asset") == "BTC"), None)
    if not row:
        return Decimal(0)
    return Decimal(str(row.get("balanceAvailable") or row.get("balance_available") or 0))


class TestFiatDepositIntegration:
    """KAN-76"""

    def test_fiat_deposit_balance_list_transactions(self) -> None:
        user = _make_user("fiat")
        before = _usd_available(user.api.list_wallets())

        created = user.api.deposits.deposit_fiat(
            {"fiatCurrency": "USD", "amount": 100, "paymentMethodType": "card"},
        )
        assert isinstance(created, FiatDepositCreatedResponse)
        dep_id = created.deposit.id
        assert created.transaction.ref_type == "deposit_fiat"

        listed = user.api.deposits.list_fiat()
        assert any(d.id == dep_id for d in listed.data)
        detail = user.api.deposits.get_fiat(dep_id)
        assert detail.id == dep_id

        after = _usd_available(user.api.list_wallets())
        assert after == before + Decimal("100")

        tx_payload = user.api.list_transactions_deposits()
        assert isinstance(tx_payload, dict)
        rows = tx_payload.get("data") or []
        assert any(
            isinstance(r, dict) and r.get("refType") == "deposit_fiat" and r.get("refId") == dep_id for r in rows
        )


class TestCryptoDepositIntegration:
    """KAN-77"""

    def test_crypto_deposit_chain(self) -> None:
        user = _make_user("btc")
        before = _btc_available(user.api.list_wallets())

        addr = user.api.deposits.crypto_address({"symbol": "BTC"})
        assert isinstance(addr, CryptoDepositAddressResponse)

        created = user.api.deposits.deposit_crypto(
            {"symbol": "BTC", "amount": 0.02, "walletAddress": addr.wallet_address},
        )
        assert isinstance(created, CryptoDepositCreatedResponse)
        dep_id = created.deposit.id
        assert created.transaction.ref_type == "deposit_crypto"

        listed = user.api.deposits.list_crypto()
        assert any(d.id == dep_id for d in listed.data)
        detail = user.api.deposits.get_crypto(dep_id)
        assert detail.id == dep_id

        after = _btc_available(user.api.list_wallets())
        assert after == before + Decimal("0.02")

        tx_payload = user.api.list_transactions_deposits()
        assert isinstance(tx_payload, dict)
        rows = tx_payload.get("data") or []
        assert any(
            isinstance(r, dict) and r.get("refType") == "deposit_crypto" and r.get("refId") == dep_id for r in rows
        )
