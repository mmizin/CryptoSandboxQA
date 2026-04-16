"""
HTTP client for admin-only routes (aligned with tests/ui-tests/src/services/admin.api.ts).

``AdminRegisteredTestUser.api`` is a lazy alias: same client as ``admin_client_from_registered(user)``.

Includes ``GET /admin/users/:userId/...`` helpers (orders, deposits, wallets, payment-methods,
portfolio, transactions) alongside ``GET /users`` (list).
"""

from __future__ import annotations

from typing import Any
from urllib.parse import quote

import httpx

from models.payments.deposit_models import (
    CryptoDepositsListResponse,
    DepositCrypto,
    DepositFiat,
    FiatDepositsListResponse,
)
from models.trading.order_models import Order, OrdersListResponse
from models.user.admin_registered_user import AdminRegisteredTestUser

from .deposits_client import _crypto_list_query_params, _fiat_list_query_params
from .orders_client import _orders_query_params
from .user_client import UserClient


def _transactions_unified_query_params(
    *,
    tx_type: str | None = None,
    from_date: str | None = None,
    to_date: str | None = None,
    limit: int | None = None,
    offset: int | None = None,
) -> dict[str, str]:
    raw: dict[str, str | int] = {}
    if tx_type is not None and tx_type != "":
        raw["type"] = tx_type
    if from_date is not None and from_date != "":
        raw["from"] = from_date
    if to_date is not None and to_date != "":
        raw["to"] = to_date
    if limit is not None:
        raw["limit"] = limit
    if offset is not None:
        raw["offset"] = offset
    return {k: str(v) for k, v in raw.items()}


def _transactions_range_query_params(
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


def _withdrawals_query_params(
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


class AdminClient(UserClient):
    """Extends ``UserClient`` with methods for routes guarded by ``AdminGuard``."""

    def __enter__(self) -> AdminClient:
        return self

    def list_users(
        self,
        *,
        search: str | None = None,
        expected_failure: bool = False,
    ) -> dict[str, Any] | list[Any] | httpx.Response:
        params = {"search": search} if search is not None else None
        return self.get(
            "/users",
            params=params,
            expected_failure=expected_failure,
        )

    # --- Admin orders (GET /admin/users/:userId/orders) ---

    def admin_list_orders(
        self,
        user_id: str,
        *,
        market_type: str | None = None,
        status: str | None = None,
        symbol: str | None = None,
        from_date: str | None = None,
        to_date: str | None = None,
        limit: int | None = None,
        offset: int | None = None,
        expected_failure: bool = False,
    ) -> OrdersListResponse | dict[str, Any] | httpx.Response:
        params = _orders_query_params(
            market_type=market_type,
            status=status,
            symbol=symbol,
            from_date=from_date,
            to_date=to_date,
            limit=limit,
            offset=offset,
        )
        result = self.get(
            f"/admin/users/{user_id}/orders",
            params=params if params else None,
            expected_failure=expected_failure,
        )
        if expected_failure or isinstance(result, httpx.Response):
            return result
        assert isinstance(result, dict)
        return OrdersListResponse.from_api_dict(result)

    def admin_get_order(
        self,
        user_id: str,
        order_id: str,
        *,
        expected_failure: bool = False,
    ) -> Order | dict[str, Any] | httpx.Response:
        result = self.get(
            f"/admin/users/{user_id}/orders/{order_id}",
            expected_failure=expected_failure,
        )
        if expected_failure or isinstance(result, httpx.Response):
            return result
        assert isinstance(result, dict)
        return Order.from_api_dict(result)

    # --- Admin deposits (GET /admin/users/:userId/deposits/...) ---

    def admin_list_fiat_deposits(
        self,
        user_id: str,
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
        result = self.get(
            f"/admin/users/{user_id}/deposits/fiat",
            params=params if params else None,
            expected_failure=expected_failure,
        )
        if expected_failure or isinstance(result, httpx.Response):
            return result
        assert isinstance(result, dict)
        return FiatDepositsListResponse.from_api_dict(result)

    def admin_get_fiat_deposit(
        self,
        user_id: str,
        deposit_id: str,
        *,
        expected_failure: bool = False,
    ) -> DepositFiat | dict[str, Any] | httpx.Response:
        result = self.get(
            f"/admin/users/{user_id}/deposits/fiat/{deposit_id}",
            expected_failure=expected_failure,
        )
        if expected_failure or isinstance(result, httpx.Response):
            return result
        assert isinstance(result, dict)
        return DepositFiat.from_api_dict(result)

    def admin_list_crypto_deposits(
        self,
        user_id: str,
        *,
        limit: int | None = None,
        offset: int | None = None,
        expected_failure: bool = False,
    ) -> CryptoDepositsListResponse | dict[str, Any] | httpx.Response:
        params = _crypto_list_query_params(limit=limit, offset=offset)
        result = self.get(
            f"/admin/users/{user_id}/deposits/crypto",
            params=params if params else None,
            expected_failure=expected_failure,
        )
        if expected_failure or isinstance(result, httpx.Response):
            return result
        assert isinstance(result, dict)
        return CryptoDepositsListResponse.from_api_dict(result)

    def admin_get_crypto_deposit(
        self,
        user_id: str,
        deposit_id: str,
        *,
        expected_failure: bool = False,
    ) -> DepositCrypto | dict[str, Any] | httpx.Response:
        result = self.get(
            f"/admin/users/{user_id}/deposits/crypto/{deposit_id}",
            expected_failure=expected_failure,
        )
        if expected_failure or isinstance(result, httpx.Response):
            return result
        assert isinstance(result, dict)
        return DepositCrypto.from_api_dict(result)

    # --- Admin wallets ---

    def admin_list_wallets(
        self,
        user_id: str,
        *,
        expected_failure: bool = False,
    ) -> dict[str, Any] | list[Any] | httpx.Response:
        return self.get(
            f"/admin/users/{user_id}/wallets",
            expected_failure=expected_failure,
        )

    def admin_get_wallet(
        self,
        user_id: str,
        asset: str,
        *,
        expected_failure: bool = False,
    ) -> dict[str, Any] | httpx.Response:
        enc = quote(asset, safe="")
        return self.get(
            f"/admin/users/{user_id}/wallets/{enc}",
            expected_failure=expected_failure,
        )

    # --- Admin payment methods ---

    def admin_list_payment_methods(
        self,
        user_id: str,
        *,
        expected_failure: bool = False,
    ) -> dict[str, Any] | list[Any] | httpx.Response:
        return self.get(
            f"/admin/users/{user_id}/payment-methods",
            expected_failure=expected_failure,
        )

    def admin_get_payment_method(
        self,
        user_id: str,
        payment_method_id: str,
        *,
        expected_failure: bool = False,
    ) -> dict[str, Any] | httpx.Response:
        return self.get(
            f"/admin/users/{user_id}/payment-methods/{payment_method_id}",
            expected_failure=expected_failure,
        )

    # --- Admin portfolio ---

    def admin_get_portfolio_balances(
        self,
        user_id: str,
        *,
        expected_failure: bool = False,
    ) -> dict[str, Any] | httpx.Response:
        return self.get(
            f"/admin/users/{user_id}/portfolio/balances",
            expected_failure=expected_failure,
        )

    def admin_get_portfolio_summary(
        self,
        user_id: str,
        *,
        expected_failure: bool = False,
    ) -> dict[str, Any] | httpx.Response:
        return self.get(
            f"/admin/users/{user_id}/portfolio/summary",
            expected_failure=expected_failure,
        )

    def admin_get_portfolio_allocation(
        self,
        user_id: str,
        *,
        expected_failure: bool = False,
    ) -> dict[str, Any] | httpx.Response:
        return self.get(
            f"/admin/users/{user_id}/portfolio/allocation",
            expected_failure=expected_failure,
        )

    # --- Admin transactions ---

    def admin_list_transactions(
        self,
        user_id: str,
        *,
        tx_type: str | None = None,
        from_date: str | None = None,
        to_date: str | None = None,
        limit: int | None = None,
        offset: int | None = None,
        expected_failure: bool = False,
    ) -> dict[str, Any] | list[Any] | httpx.Response:
        params = _transactions_unified_query_params(
            tx_type=tx_type,
            from_date=from_date,
            to_date=to_date,
            limit=limit,
            offset=offset,
        )
        return self.get(
            f"/admin/users/{user_id}/transactions",
            params=params if params else None,
            expected_failure=expected_failure,
        )

    def admin_list_transaction_deposits(
        self,
        user_id: str,
        *,
        limit: int | None = None,
        offset: int | None = None,
        from_date: str | None = None,
        to_date: str | None = None,
        expected_failure: bool = False,
    ) -> dict[str, Any] | list[Any] | httpx.Response:
        params = _transactions_range_query_params(
            limit=limit,
            offset=offset,
            from_date=from_date,
            to_date=to_date,
        )
        return self.get(
            f"/admin/users/{user_id}/transactions/deposits",
            params=params if params else None,
            expected_failure=expected_failure,
        )

    def admin_list_transaction_trades(
        self,
        user_id: str,
        *,
        limit: int | None = None,
        offset: int | None = None,
        from_date: str | None = None,
        to_date: str | None = None,
        expected_failure: bool = False,
    ) -> dict[str, Any] | list[Any] | httpx.Response:
        params = _transactions_range_query_params(
            limit=limit,
            offset=offset,
            from_date=from_date,
            to_date=to_date,
        )
        return self.get(
            f"/admin/users/{user_id}/transactions/trades",
            params=params if params else None,
            expected_failure=expected_failure,
        )

    def admin_list_transaction_withdrawals(
        self,
        user_id: str,
        *,
        limit: int | None = None,
        offset: int | None = None,
        expected_failure: bool = False,
    ) -> dict[str, Any] | list[Any] | httpx.Response:
        params = _withdrawals_query_params(limit=limit, offset=offset)
        return self.get(
            f"/admin/users/{user_id}/transactions/withdrawals",
            params=params if params else None,
            expected_failure=expected_failure,
        )


def admin_client_from_registered(
    user: AdminRegisteredTestUser,
    **kwargs: Any,
) -> AdminClient:
    """Factory: build an ``AdminClient`` from an admin bootstrap result."""
    return AdminClient(user.access_token, **kwargs)
