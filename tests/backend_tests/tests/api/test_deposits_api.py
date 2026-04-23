"""
Deposits HTTP API — KAN-67 / KAN-70–KAN-73.

Each test uses an isolated registered user (parallel-safe).
"""

from __future__ import annotations

import time

import httpx

from models.payments.deposit_models import (
    CryptoDepositAddressResponse,
    CryptoDepositCreatedResponse,
    FiatDepositCreatedResponse,
)
from services.auth_client import AuthClient
from services.base_client import get_api_url
from strategies.user.api_strategy import ApiUserCreationStrategy


def _error_text(resp: httpx.Response) -> str:
    try:
        body = resp.json()
        if isinstance(body, dict):
            msg = body.get("message")
            if isinstance(msg, list):
                return " ".join(str(x) for x in msg)
            if isinstance(msg, str):
                return msg
    except Exception:
        pass
    return (resp.text or "")[:2000]


def _make_user(display_suffix: str):
    strategy = ApiUserCreationStrategy(AuthClient())
    from factories.user_factory import UserFactory  # local import avoids circular hints in tooling

    factory = UserFactory()
    ms = int(time.time() * 1000)
    return factory.create(
        strategy,
        lambda b: b.with_display_name(f"api-dep-{display_suffix}-{ms}").with_username(f"u_dep_{ms}_{display_suffix}"),
    )


class TestDepositsFiatSuccess:
    """KAN-70 TC-API-01"""

    def test_usd_card_omits_payment_method_type_defaults_card(self) -> None:
        user = _make_user("kan70usd")
        raw = user.api.deposits.deposit_fiat({"fiatCurrency": "USD", "amount": 100})
        assert isinstance(raw, FiatDepositCreatedResponse)
        assert raw.deposit.fiat_currency == "USD"
        assert raw.deposit.payment_method_type == "card"
        assert raw.deposit.payment_method_id is None
        assert raw.deposit.status == "completed"
        assert raw.balance.asset == "USD"
        assert raw.transaction.ref_type == "deposit_fiat"

    def test_eur_sepa_fee_zero(self) -> None:
        user = _make_user("kan70eur")
        raw = user.api.deposits.deposit_fiat(
            {"fiatCurrency": "EUR", "amount": 50, "paymentMethodType": "sepa"},
        )
        assert isinstance(raw, FiatDepositCreatedResponse)
        assert raw.deposit.fiat_currency == "EUR"
        assert raw.deposit.payment_method_type == "sepa"
        assert raw.deposit.fee in ("0", "0.00")
        assert raw.transaction.ref_type == "deposit_fiat"

    def test_usd_applepay(self) -> None:
        user = _make_user("kan70apple")
        raw = user.api.deposits.deposit_fiat(
            {"fiatCurrency": "USD", "amount": 25, "paymentMethodType": "applepay"},
        )
        assert isinstance(raw, FiatDepositCreatedResponse)
        assert raw.deposit.payment_method_type == "applepay"
        assert raw.transaction.ref_type == "deposit_fiat"


class TestDepositsFiatValidation:
    """KAN-71 TC-API-02"""

    def test_bad_fiat_currency(self) -> None:
        user = _make_user("gbp")
        r = user.api.deposits.deposit_fiat(
            {"fiatCurrency": "GBP", "amount": 10},
            expected_failure=True,
        )
        assert isinstance(r, httpx.Response)
        assert r.status_code == 400

    def test_amount_below_dto_min(self) -> None:
        user = _make_user("minamt")
        r = user.api.deposits.deposit_fiat(
            {"fiatCurrency": "USD", "amount": 0.009},
            expected_failure=True,
        )
        assert isinstance(r, httpx.Response)
        assert r.status_code == 400

    def test_zero_amount(self) -> None:
        user = _make_user("zero")
        r = user.api.deposits.deposit_fiat(
            {"fiatCurrency": "USD", "amount": 0},
            expected_failure=True,
        )
        assert isinstance(r, httpx.Response)
        assert r.status_code == 400

    def test_invalid_payment_method_type(self) -> None:
        user = _make_user("wire")
        r = user.api.deposits.deposit_fiat(
            {"fiatCurrency": "USD", "amount": 10, "paymentMethodType": "wire"},
            expected_failure=True,
        )
        assert isinstance(r, httpx.Response)
        assert r.status_code == 400

    def test_malformed_payment_method_id(self) -> None:
        user = _make_user("baduuid")
        r = user.api.deposits.deposit_fiat(
            {
                "fiatCurrency": "USD",
                "amount": 10,
                "paymentMethodId": "not-a-uuid",
            },
            expected_failure=True,
        )
        assert isinstance(r, httpx.Response)
        assert r.status_code == 400

    def test_unknown_payment_method_id(self) -> None:
        user = _make_user("nopm")
        r = user.api.deposits.deposit_fiat(
            {
                "fiatCurrency": "USD",
                "amount": 10,
                "paymentMethodId": "00000000-0000-4000-8000-000000000001",
            },
            expected_failure=True,
        )
        assert isinstance(r, httpx.Response)
        assert r.status_code == 404
        assert "Payment method not found" in _error_text(r)


class TestDepositsCryptoMatrix:
    """KAN-72 TC-API-03"""

    def test_address_invalid_symbol(self) -> None:
        user = _make_user("addrbad")
        r = user.api.deposits.crypto_address({"symbol": "NOPE"}, expected_failure=True)
        assert isinstance(r, httpx.Response)
        assert r.status_code == 400
        assert "Invalid crypto symbol" in _error_text(r)

    def test_deposit_invalid_symbol(self) -> None:
        user = _make_user("cryptobad")
        r = user.api.deposits.deposit_crypto(
            {"symbol": "NOPE", "amount": 0.01, "walletAddress": "bc1qtest"},
            expected_failure=True,
        )
        assert isinstance(r, httpx.Response)
        assert r.status_code == 400
        assert "Invalid crypto symbol" in _error_text(r)

    def test_deposit_amount_below_min(self) -> None:
        user = _make_user("cryptomin")
        r = user.api.deposits.deposit_crypto(
            {"symbol": "BTC", "amount": 0.000001, "walletAddress": "bc1qtest"},
            expected_failure=True,
        )
        assert isinstance(r, httpx.Response)
        assert r.status_code == 400

    def test_happy_path_address_then_deposit(self) -> None:
        user = _make_user("happy")
        addr = user.api.deposits.crypto_address({"symbol": "BTC"})
        assert isinstance(addr, CryptoDepositAddressResponse)
        assert addr.symbol == "BTC"
        assert addr.wallet_address
        created = user.api.deposits.deposit_crypto(
            {"symbol": "BTC", "amount": 0.05, "walletAddress": addr.wallet_address},
        )
        assert isinstance(created, CryptoDepositCreatedResponse)
        assert created.deposit.symbol == "BTC"
        assert created.transaction.ref_type == "deposit_crypto"


class TestDepositsAuthAndList:
    """KAN-73 TC-API-04"""

    def test_list_fiat_unauthenticated(self) -> None:
        with httpx.Client(base_url=get_api_url(), timeout=30.0) as c:
            r = c.get("/deposits/fiat")
            assert r.status_code == 401

    def test_list_fiat_limit_meta(self) -> None:
        user = _make_user("listlim")
        listed = user.api.deposits.list_fiat(limit=5)
        assert listed.meta.limit == 5
        assert len(listed.data) <= 5

    def test_get_fiat_unknown_id(self) -> None:
        user = _make_user("fiat404")
        r = user.api.deposits.get_fiat("00000000-0000-4000-8000-000000000099", expected_failure=True)
        assert isinstance(r, httpx.Response)
        assert r.status_code == 404
        assert "Deposit not found" in _error_text(r)

    def test_get_crypto_unknown_id(self) -> None:
        user = _make_user("cry404")
        r = user.api.deposits.get_crypto("00000000-0000-4000-8000-000000000099", expected_failure=True)
        assert isinstance(r, httpx.Response)
        assert r.status_code == 404
        assert "Deposit not found" in _error_text(r)
