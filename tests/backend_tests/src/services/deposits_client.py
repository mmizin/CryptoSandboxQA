"""
HTTP client for /deposits routes (aligned with DepositsController).

Use via ``RegisteredTestUser.api.deposits`` — shares the same httpx client as ``UserClient``.
"""

from __future__ import annotations

from typing import Any
from urllib.parse import urlencode

import httpx

from models.payments.deposit_models import (
    CryptoAddressRequest,
    CryptoDepositAddressResponse,
    CryptoDepositCreatedResponse,
    CryptoDepositsListResponse,
    DepositCrypto,
    DepositCryptoRequest,
    DepositFiat,
    DepositFiatRequest,
    FiatDepositCreatedResponse,
    FiatDepositsListResponse,
)

from .base_client import BaseClient
from .user_client import UserClient


def _fiat_list_query_params(
    *,
    limit: int | None = None,
    offset: int | None = None,
    from_date: str | None = None,
    to_date: str | None = None,
) -> dict[str, str]:
    raw: dict[str, str | int] = {}
    if limit is not None:
        raw["limit"] = limit
    if offset is not None:
        raw["offset"] = offset
    if from_date is not None and from_date != "":
        raw["from"] = from_date
    if to_date is not None and to_date != "":
        raw["to"] = to_date
    return {k: str(v) for k, v in raw.items()}


def _crypto_list_query_params(
    *,
    limit: int | None = None,
    offset: int | None = None,
) -> dict[str, str]:
    raw: dict[str, str | int] = {}
    if limit is not None:
        raw["limit"] = limit
    if offset is not None:
        raw["offset"] = offset
    return {k: str(v) for k, v in raw.items()}


class DepositsClient(BaseClient):
    """User-scoped /deposits API; reuses the parent ``UserClient`` connection."""

    def __init__(self, user_client: UserClient) -> None:
        super().__init__(base_url=user_client.base_url, client=user_client.http_client)

    @classmethod
    def from_user_client(cls, user: UserClient) -> DepositsClient:
        return cls(user)

    def deposit_fiat(
        self,
        body: DepositFiatRequest | dict[str, Any],
        *,
        expected_failure: bool = False,
    ) -> FiatDepositCreatedResponse | dict[str, Any] | httpx.Response:
        payload = body.to_api_dict() if isinstance(body, DepositFiatRequest) else body
        result = super().post("/deposits/fiat", json=payload, expected_failure=expected_failure)
        if expected_failure or isinstance(result, httpx.Response):
            return result
        assert isinstance(result, dict)
        return FiatDepositCreatedResponse.from_api_dict(result)

    def list_fiat(
        self,
        *,
        limit: int | None = None,
        offset: int | None = None,
        from_date: str | None = None,
        to_date: str | None = None,
        expected_failure: bool = False,
    ) -> FiatDepositsListResponse | dict[str, Any] | httpx.Response:
        params = _fiat_list_query_params(
            limit=limit,
            offset=offset,
            from_date=from_date,
            to_date=to_date,
        )
        q = urlencode(params)
        path = f"/deposits/fiat?{q}" if q else "/deposits/fiat"
        result = super().get(path, expected_failure=expected_failure)
        if expected_failure or isinstance(result, httpx.Response):
            return result
        assert isinstance(result, dict)
        return FiatDepositsListResponse.from_api_dict(result)

    def get_fiat(
        self,
        deposit_id: str,
        *,
        expected_failure: bool = False,
    ) -> DepositFiat | dict[str, Any] | httpx.Response:
        result = super().get(f"/deposits/fiat/{deposit_id}", expected_failure=expected_failure)
        if expected_failure or isinstance(result, httpx.Response):
            return result
        assert isinstance(result, dict)
        return DepositFiat.from_api_dict(result)

    def crypto_address(
        self,
        body: CryptoAddressRequest | dict[str, Any],
        *,
        expected_failure: bool = False,
    ) -> CryptoDepositAddressResponse | dict[str, Any] | httpx.Response:
        payload = body.to_api_dict() if isinstance(body, CryptoAddressRequest) else body
        result = super().post("/deposits/crypto/address", json=payload, expected_failure=expected_failure)
        if expected_failure or isinstance(result, httpx.Response):
            return result
        assert isinstance(result, dict)
        return CryptoDepositAddressResponse.from_api_dict(result)

    def deposit_crypto(
        self,
        body: DepositCryptoRequest | dict[str, Any],
        *,
        expected_failure: bool = False,
    ) -> CryptoDepositCreatedResponse | dict[str, Any] | httpx.Response:
        payload = body.to_api_dict() if isinstance(body, DepositCryptoRequest) else body
        result = super().post("/deposits/crypto", json=payload, expected_failure=expected_failure)
        if expected_failure or isinstance(result, httpx.Response):
            return result
        assert isinstance(result, dict)
        return CryptoDepositCreatedResponse.from_api_dict(result)

    def list_crypto(
        self,
        *,
        limit: int | None = None,
        offset: int | None = None,
        expected_failure: bool = False,
    ) -> CryptoDepositsListResponse | dict[str, Any] | httpx.Response:
        params = _crypto_list_query_params(limit=limit, offset=offset)
        q = urlencode(params)
        path = f"/deposits/crypto?{q}" if q else "/deposits/crypto"
        result = super().get(path, expected_failure=expected_failure)
        if expected_failure or isinstance(result, httpx.Response):
            return result
        assert isinstance(result, dict)
        return CryptoDepositsListResponse.from_api_dict(result)

    def get_crypto(
        self,
        deposit_id: str,
        *,
        expected_failure: bool = False,
    ) -> DepositCrypto | dict[str, Any] | httpx.Response:
        result = super().get(f"/deposits/crypto/{deposit_id}", expected_failure=expected_failure)
        if expected_failure or isinstance(result, httpx.Response):
            return result
        assert isinstance(result, dict)
        return DepositCrypto.from_api_dict(result)
