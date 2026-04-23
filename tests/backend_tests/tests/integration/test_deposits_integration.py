"""
Deposits integration chains — KAN-69 / KAN-76, KAN-77.
"""

from __future__ import annotations

import time

import allure
import pytest
from decimal import Decimal

from models.payments.deposit_models import (
    CryptoDepositAddressResponse,
    CryptoDepositCreatedResponse,
    FiatDepositCreatedResponse,
)

pytestmark = [pytest.mark.e2e, pytest.mark.merge_gate, pytest.mark.smoke]


def _configure_deposits_integration_user(display_suffix: str):
    ms = int(time.time() * 1000)
    return lambda b: (
        b.with_unique_email()
        .with_display_name(f"int-dep-{display_suffix}-{ms}")
        .with_username(f"u_intdep_{ms}_{display_suffix}")
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


@allure.epic("Payments")
@allure.feature("Deposits integration")
@allure.story("Fiat deposit journey")
class TestFiatDepositIntegration:
    """KAN-76"""

    def test_fiat_deposit_balance_list_transactions(self, fxt_regular_user) -> None:
        with allure.step("Arrange user and baseline USD balance"):
            user = fxt_regular_user(_configure_deposits_integration_user("fiat"))
            before = _usd_available(user.api.list_wallets())

        with allure.step("Create fiat card deposit"):
            fiat_deposit_request = {
                "fiatCurrency": "USD",
                "amount": 100,
                "paymentMethodType": "card",
            }
            created = user.api.deposits.deposit_fiat(fiat_deposit_request)
            assert isinstance(created, FiatDepositCreatedResponse), (
                f"expected FiatDepositCreatedResponse, got {type(created).__name__!r}"
            )
            dep_id = created.deposit.id
            assert created.transaction.ref_type == "deposit_fiat", (
                f"expected ref_type deposit_fiat, got {created.transaction.ref_type!r}"
            )

        with allure.step("List and fetch fiat deposit detail"):
            listed = user.api.deposits.list_fiat()
            assert any(d.id == dep_id for d in listed.data), (
                f"list_fiat: expected deposit {dep_id!r} in listed data ids={[d.id for d in listed.data]!r}"
            )
            detail = user.api.deposits.get_fiat(dep_id)
            assert detail.id == dep_id, f"get_fiat: expected id {dep_id!r}, got {detail.id!r}"

        with allure.step("Assert wallet and transaction history"):
            after = _usd_available(user.api.list_wallets())
            assert after == before + Decimal("100"), (
                f"wallet USD: expected before+100 = {before + Decimal('100')!r}, got {after!r} (before was {before!r})"
            )

            tx_payload = user.api.list_transactions_deposits()
            assert isinstance(tx_payload, dict), f"expected dict tx list, got {type(tx_payload).__name__!r}"
            rows = tx_payload.get("data") or []
            assert any(
                isinstance(r, dict) and r.get("refType") == "deposit_fiat" and r.get("refId") == dep_id
                for r in rows
            ), (
                f"transactions: expected deposit_fiat ref for {dep_id!r}; sample rows refTypes={[r.get('refType') for r in rows if isinstance(r, dict)]!r}"
            )


@allure.epic("Payments")
@allure.feature("Deposits integration")
@allure.story("Crypto deposit journey")
class TestCryptoDepositIntegration:
    """KAN-77"""

    def test_crypto_deposit_chain(self, fxt_regular_user) -> None:
        with allure.step("Arrange user and baseline BTC balance"):
            user = fxt_regular_user(_configure_deposits_integration_user("btc"))
            before = _btc_available(user.api.list_wallets())

        with allure.step("Reserve crypto deposit address"):
            crypto_address_request = {"symbol": "BTC"}
            addr = user.api.deposits.crypto_address(crypto_address_request)
            assert isinstance(addr, CryptoDepositAddressResponse), (
                f"expected CryptoDepositAddressResponse, got {type(addr).__name__!r}"
            )

        with allure.step("Submit on-chain crypto deposit"):
            crypto_deposit_request = {
                "symbol": "BTC",
                "amount": 0.02,
                "walletAddress": addr.wallet_address,
            }
            created = user.api.deposits.deposit_crypto(crypto_deposit_request)
            assert isinstance(created, CryptoDepositCreatedResponse), (
                f"expected CryptoDepositCreatedResponse, got {type(created).__name__!r}"
            )
            dep_id = created.deposit.id
            assert created.transaction.ref_type == "deposit_crypto", (
                f"expected ref_type deposit_crypto, got {created.transaction.ref_type!r}"
            )

        with allure.step("List and fetch crypto deposit detail"):
            listed = user.api.deposits.list_crypto()
            assert any(d.id == dep_id for d in listed.data), (
                f"list_crypto: expected {dep_id!r} in listed ids {[d.id for d in listed.data]!r}"
            )
            detail = user.api.deposits.get_crypto(dep_id)
            assert detail.id == dep_id, f"get_crypto: expected id {dep_id!r}, got {detail.id!r}"

        with allure.step("Assert wallet and transaction history"):
            after = _btc_available(user.api.list_wallets())
            assert after == before + Decimal("0.02"), (
                f"wallet BTC: expected +0.02 from {before!r}, got {after!r}"
            )

            tx_payload = user.api.list_transactions_deposits()
            assert isinstance(tx_payload, dict), f"expected dict tx list, got {type(tx_payload).__name__!r}"
            rows = tx_payload.get("data") or []
            assert any(
                isinstance(r, dict) and r.get("refType") == "deposit_crypto" and r.get("refId") == dep_id
                for r in rows
            ), (
                f"transactions: expected deposit_crypto ref for {dep_id!r}; sample refTypes="
                f"{[r.get('refType') for r in rows if isinstance(r, dict)]!r}"
            )
