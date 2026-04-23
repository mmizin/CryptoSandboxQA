"""
Deposits HTTP API — KAN-67 / KAN-70–KAN-73.

Each test uses an isolated registered user (parallel-safe).
"""

from __future__ import annotations


import time

import allure
import httpx
import pytest

from models.payments.deposit_models import (
    CryptoDepositAddressResponse,
    CryptoDepositCreatedResponse,
    FiatDepositCreatedResponse,
)
from services.base_client import get_api_url
from utils.http_assertions import (
    error_text_from_response as _error_text,
    response_assert_detail as _response_assert_detail,
)


def _configure_deposits_api_user(display_suffix: str):
    ms = int(time.time() * 1000)
    return lambda b: (
        b.with_unique_email()
        .with_display_name(f"api-dep-{display_suffix}-{ms}")
        .with_username(f"u_dep_{ms}_{display_suffix}")
    )


@allure.epic("Payments")
@allure.feature("Deposits API")
@allure.story("Fiat deposit success")
@pytest.mark.merge_gate
@pytest.mark.smoke
class TestDepositsFiatSuccess:
    """KAN-70 TC-API-01"""

    def test_usd_card_omits_payment_method_type_defaults_card(self, fxt_regular_user) -> None:
        user = fxt_regular_user(_configure_deposits_api_user("kan70usd"))
        raw = user.api.deposits.deposit_fiat({"fiatCurrency": "USD", "amount": 100})
        assert isinstance(raw, FiatDepositCreatedResponse), (
            f"expected FiatDepositCreatedResponse, got {type(raw).__name__!r}"
        )
        assert raw.deposit.fiat_currency == "USD", (
            f"expected deposit.fiat_currency 'USD', got {raw.deposit.fiat_currency!r}"
        )
        assert raw.deposit.payment_method_type == "card", (
            f"expected payment_method_type 'card', got {raw.deposit.payment_method_type!r}"
        )
        assert raw.deposit.payment_method_id is None, (
            f"expected payment_method_id None, got {raw.deposit.payment_method_id!r}"
        )
        assert raw.deposit.status == "completed", (
            f"expected deposit.status 'completed', got {raw.deposit.status!r}"
        )
        assert raw.balance.asset == "USD", f"expected balance.asset 'USD', got {raw.balance.asset!r}"
        assert raw.transaction.ref_type == "deposit_fiat", (
            f"expected transaction.ref_type 'deposit_fiat', got {raw.transaction.ref_type!r}"
        )

    def test_eur_sepa_fee_zero(self, fxt_regular_user) -> None:
        user = fxt_regular_user(_configure_deposits_api_user("kan70eur"))
        raw = user.api.deposits.deposit_fiat(
            {"fiatCurrency": "EUR", "amount": 50, "paymentMethodType": "sepa"},
        )
        assert isinstance(raw, FiatDepositCreatedResponse), (
            f"expected FiatDepositCreatedResponse, got {type(raw).__name__!r}"
        )
        assert raw.deposit.fiat_currency == "EUR", (
            f"expected deposit.fiat_currency 'EUR', got {raw.deposit.fiat_currency!r}"
        )
        assert raw.deposit.payment_method_type == "sepa", (
            f"expected payment_method_type 'sepa', got {raw.deposit.payment_method_type!r}"
        )
        assert raw.deposit.fee in ("0", "0.00"), (
            f"expected fee in ('0', '0.00'), got {raw.deposit.fee!r}"
        )
        assert raw.transaction.ref_type == "deposit_fiat", (
            f"expected transaction.ref_type 'deposit_fiat', got {raw.transaction.ref_type!r}"
        )

    def test_usd_applepay(self, fxt_regular_user) -> None:
        user = fxt_regular_user(_configure_deposits_api_user("kan70apple"))
        raw = user.api.deposits.deposit_fiat(
            {"fiatCurrency": "USD", "amount": 25, "paymentMethodType": "applepay"},
        )
        assert isinstance(raw, FiatDepositCreatedResponse), (
            f"expected FiatDepositCreatedResponse, got {type(raw).__name__!r}"
        )
        assert raw.deposit.payment_method_type == "applepay", (
            f"expected payment_method_type 'applepay', got {raw.deposit.payment_method_type!r}"
        )
        assert raw.transaction.ref_type == "deposit_fiat", (
            f"expected transaction.ref_type 'deposit_fiat', got {raw.transaction.ref_type!r}"
        )


@allure.epic("Payments")
@allure.feature("Deposits API")
@allure.story("Fiat validation matrix")
@pytest.mark.merge_gate
@pytest.mark.client_validation
class TestDepositsFiatValidation:
    """KAN-71 TC-API-02"""

    def test_bad_fiat_currency(self, fxt_regular_user) -> None:
        user = fxt_regular_user(_configure_deposits_api_user("gbp"))
        response = user.api.deposits.deposit_fiat(
            {"fiatCurrency": "GBP", "amount": 10},
            expected_failure=True,
        )
        assert isinstance(response, httpx.Response), (
            f"expected httpx.Response, got {type(response).__name__!r} value={response!r}"
        )
        assert response.status_code == 400, (
            f"bad_fiat_currency: expected HTTP 400; {_response_assert_detail(response)}"
        )

    def test_amount_below_dto_min(self, fxt_regular_user) -> None:
        user = fxt_regular_user(_configure_deposits_api_user("minamt"))
        response = user.api.deposits.deposit_fiat(
            {"fiatCurrency": "USD", "amount": 0.009},
            expected_failure=True,
        )
        assert isinstance(response, httpx.Response), (
            f"expected httpx.Response, got {type(response).__name__!r} value={response!r}"
        )
        assert response.status_code == 400, (
            f"amount_below_dto_min: expected HTTP 400; {_response_assert_detail(response)}"
        )

    def test_zero_amount(self, fxt_regular_user) -> None:
        user = fxt_regular_user(_configure_deposits_api_user("zero"))
        response = user.api.deposits.deposit_fiat(
            {"fiatCurrency": "USD", "amount": 0},
            expected_failure=True,
        )
        assert isinstance(response, httpx.Response), (
            f"expected httpx.Response, got {type(response).__name__!r} value={response!r}"
        )
        assert response.status_code == 400, (
            f"zero_amount: expected HTTP 400; {_response_assert_detail(response)}"
        )

    def test_invalid_payment_method_type(self, fxt_regular_user) -> None:
        user = fxt_regular_user(_configure_deposits_api_user("wire"))
        response = user.api.deposits.deposit_fiat(
            {"fiatCurrency": "USD", "amount": 10, "paymentMethodType": "wire"},
            expected_failure=True,
        )
        assert isinstance(response, httpx.Response), (
            f"expected httpx.Response, got {type(response).__name__!r} value={response!r}"
        )
        assert response.status_code == 400, (
            f"invalid_payment_method_type: expected HTTP 400; {_response_assert_detail(response)}"
        )

    def test_malformed_payment_method_id(self, fxt_regular_user) -> None:
        user = fxt_regular_user(_configure_deposits_api_user("baduuid"))
        fiat_deposit_request = {
            "fiatCurrency": "USD",
            "amount": 10,
            "paymentMethodId": "not-a-uuid",
        }
        response = user.api.deposits.deposit_fiat(
            fiat_deposit_request,
            expected_failure=True,
        )
        assert isinstance(response, httpx.Response), (
            f"expected httpx.Response, got {type(response).__name__!r} value={response!r}"
        )
        assert response.status_code == 400, (
            f"malformed_payment_method_id: expected HTTP 400; {_response_assert_detail(response)}"
        )

    def test_unknown_payment_method_id(self, fxt_regular_user) -> None:
        user = fxt_regular_user(_configure_deposits_api_user("nopm"))
        response = user.api.deposits.deposit_fiat(
            {
                "fiatCurrency": "USD",
                "amount": 10,
                "paymentMethodId": "00000000-0000-4000-8000-000000000001",
            },
            expected_failure=True,
        )
        assert isinstance(response, httpx.Response), (
            f"expected httpx.Response, got {type(response).__name__!r} value={response!r}"
        )
        assert response.status_code == 404, (
            f"unknown_payment_method_id: expected HTTP 404; {_response_assert_detail(response)}"
        )
        err = _error_text(response)
        assert "Payment method not found" in err, (
            f"unknown_payment_method_id: expected 'Payment method not found' in error text, "
            f"got {err!r}; {_response_assert_detail(response)}"
        )


@allure.epic("Payments")
@allure.feature("Deposits API")
@allure.story("Crypto deposit matrix")
@pytest.mark.merge_gate
@pytest.mark.client_validation
class TestDepositsCryptoMatrix:
    """KAN-72 TC-API-03"""

    def test_address_invalid_symbol(self, fxt_regular_user) -> None:
        user = fxt_regular_user(_configure_deposits_api_user("addrbad"))
        response = user.api.deposits.crypto_address({"symbol": "NOPE"}, expected_failure=True)
        assert isinstance(response, httpx.Response), (
            f"expected httpx.Response, got {type(response).__name__!r} value={response!r}"
        )
        assert response.status_code == 400, (
            f"address_invalid_symbol: expected HTTP 400; {_response_assert_detail(response)}"
        )
        err = _error_text(response)
        assert "Invalid crypto symbol" in err, (
            f"address_invalid_symbol: expected 'Invalid crypto symbol' in error, "
            f"got {err!r}; {_response_assert_detail(response)}"
        )

    def test_deposit_invalid_symbol(self, fxt_regular_user) -> None:
        user = fxt_regular_user(_configure_deposits_api_user("cryptobad"))
        response = user.api.deposits.deposit_crypto(
            {"symbol": "NOPE", "amount": 0.01, "walletAddress": "bc1qtest"},
            expected_failure=True,
        )
        assert isinstance(response, httpx.Response), (
            f"expected httpx.Response, got {type(response).__name__!r} value={response!r}"
        )
        assert response.status_code == 400, (
            f"deposit_invalid_symbol: expected HTTP 400; {_response_assert_detail(response)}"
        )
        err = _error_text(response)
        assert "Invalid crypto symbol" in err, (
            f"deposit_invalid_symbol: expected 'Invalid crypto symbol' in error, "
            f"got {err!r}; {_response_assert_detail(response)}"
        )

    def test_deposit_amount_below_min(self, fxt_regular_user) -> None:
        user = fxt_regular_user(_configure_deposits_api_user("cryptomin"))
        response = user.api.deposits.deposit_crypto(
            {"symbol": "BTC", "amount": 0.000001, "walletAddress": "bc1qtest"},
            expected_failure=True,
        )
        assert isinstance(response, httpx.Response), (
            f"expected httpx.Response, got {type(response).__name__!r} value={response!r}"
        )
        assert response.status_code == 400, (
            f"deposit_amount_below_min: expected HTTP 400; {_response_assert_detail(response)}"
        )

    @pytest.mark.smoke
    def test_happy_path_address_then_deposit(self, fxt_regular_user) -> None:
        user = fxt_regular_user(_configure_deposits_api_user("happy"))
        addr = user.api.deposits.crypto_address({"symbol": "BTC"})
        assert isinstance(addr, CryptoDepositAddressResponse), (
            f"expected CryptoDepositAddressResponse, got {type(addr).__name__!r}"
        )
        assert addr.symbol == "BTC", f"expected address.symbol 'BTC', got {addr.symbol!r}"
        assert addr.wallet_address, f"expected non-empty addr.wallet_address, got {addr.wallet_address!r}"
        created = user.api.deposits.deposit_crypto(
            {"symbol": "BTC", "amount": 0.05, "walletAddress": addr.wallet_address},
        )
        assert isinstance(created, CryptoDepositCreatedResponse), (
            f"expected CryptoDepositCreatedResponse, got {type(created).__name__!r}"
        )
        assert created.deposit.symbol == "BTC", (
            f"expected deposit.symbol 'BTC', got {created.deposit.symbol!r}"
        )
        assert created.transaction.ref_type == "deposit_crypto", (
            f"expected transaction.ref_type 'deposit_crypto', got {created.transaction.ref_type!r}"
        )


@allure.epic("Payments")
@allure.feature("Deposits API")
@allure.story("Auth and list endpoints")
@pytest.mark.merge_gate
@pytest.mark.smoke
class TestDepositsAuthAndList:
    """KAN-73 TC-API-04"""

    def test_list_fiat_unauthenticated(self) -> None:
        with httpx.Client(base_url=get_api_url(), timeout=30.0) as c:
            response = c.get("/deposits/fiat")
            assert response.status_code == 401, (
                f"list_fiat_unauthenticated: expected HTTP 401; {_response_assert_detail(response)}"
            )

    def test_list_fiat_limit_meta(self, fxt_regular_user) -> None:
        user = fxt_regular_user(_configure_deposits_api_user("listlim"))
        listed = user.api.deposits.list_fiat(limit=5)
        assert listed.meta.limit == 5, (
            f"list_fiat_limit_meta: expected meta.limit 5, got {listed.meta.limit!r}"
        )
        assert len(listed.data) <= 5, (
            f"list_fiat_limit_meta: expected at most 5 rows, got {len(listed.data)} (limit was 5)"
        )

    def test_get_fiat_unknown_id(self, fxt_regular_user) -> None:
        user = fxt_regular_user(_configure_deposits_api_user("fiat404"))
        response = user.api.deposits.get_fiat("00000000-0000-4000-8000-000000000099", expected_failure=True)
        assert isinstance(response, httpx.Response), (
            f"expected httpx.Response, got {type(response).__name__!r} value={response!r}"
        )
        assert response.status_code == 404, (
            f"get_fiat_unknown_id: expected HTTP 404; {_response_assert_detail(response)}"
        )
        err = _error_text(response)
        assert "Deposit not found" in err, (
            f"get_fiat_unknown_id: expected 'Deposit not found' in error, got {err!r}; "
            f"{_response_assert_detail(response)}"
        )

    def test_get_crypto_unknown_id(self, fxt_regular_user) -> None:
        user = fxt_regular_user(_configure_deposits_api_user("cry404"))
        response = user.api.deposits.get_crypto("00000000-0000-4000-8000-000000000099", expected_failure=True)
        assert isinstance(response, httpx.Response), (
            f"expected httpx.Response, got {type(response).__name__!r} value={response!r}"
        )
        assert response.status_code == 404, (
            f"get_crypto_unknown_id: expected HTTP 404; {_response_assert_detail(response)}"
        )
        err = _error_text(response)
        assert "Deposit not found" in err, (
            f"get_crypto_unknown_id: expected 'Deposit not found' in error, got {err!r}; "
            f"{_response_assert_detail(response)}"
        )
