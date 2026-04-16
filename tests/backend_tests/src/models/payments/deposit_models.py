"""
Deposit API types (aligned with DepositFiatDto, DepositCryptoDto, DepositsService mappers;
mirrors tests/ui-tests/src/models/payments/deposit-withdrawal.types.ts).
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any


def _optional_ts(value: Any) -> str | None:
    return str(value) if value is not None else None


@dataclass
class DepositFiatRequest:
    """POST /deposits/fiat body (camelCase for Nest)."""

    fiat_currency: str
    amount: float
    payment_method_id: str | None = None
    payment_method_type: str | None = None  # card | sepa | applepay

    def to_api_dict(self) -> dict[str, Any]:
        body: dict[str, Any] = {
            "fiatCurrency": self.fiat_currency,
            "amount": self.amount,
        }
        if self.payment_method_id is not None:
            body["paymentMethodId"] = self.payment_method_id
        if self.payment_method_type is not None:
            body["paymentMethodType"] = self.payment_method_type
        return body


@dataclass
class DepositCryptoRequest:
    """POST /deposits/crypto body."""

    symbol: str
    amount: float
    wallet_address: str
    tx_hash: str | None = None

    def to_api_dict(self) -> dict[str, Any]:
        body: dict[str, Any] = {
            "symbol": self.symbol,
            "amount": self.amount,
            "walletAddress": self.wallet_address,
        }
        if self.tx_hash is not None:
            body["txHash"] = self.tx_hash
        return body


@dataclass
class CryptoAddressRequest:
    """POST /deposits/crypto/address body."""

    symbol: str

    def to_api_dict(self) -> dict[str, Any]:
        return {"symbol": self.symbol}


@dataclass
class DepositFiat:
    """Single fiat deposit row (`mapDepositFiat`)."""

    id: str
    user_id: str
    fiat_currency: str
    amount: str
    fee: str
    status: str
    payment_method_id: str | None
    payment_method_type: str | None
    created_at: str
    completed_at: str | None

    @classmethod
    def from_api_dict(cls, data: dict[str, Any]) -> DepositFiat:
        return cls(
            id=str(data["id"]),
            user_id=str(data.get("userId") or data.get("user_id", "")),
            fiat_currency=str(data.get("fiatCurrency") or data.get("fiat_currency", "")),
            amount=str(data.get("amount", "")),
            fee=str(data.get("fee", "")),
            status=str(data.get("status", "")),
            payment_method_id=data.get("paymentMethodId") if data.get("paymentMethodId") is not None else data.get("payment_method_id"),
            payment_method_type=data.get("paymentMethodType") if data.get("paymentMethodType") is not None else data.get("payment_method_type"),
            created_at=str(data.get("createdAt") or data.get("created_at", "")),
            completed_at=_optional_ts(data.get("completedAt", data.get("completed_at"))),
        )


@dataclass
class DepositCrypto:
    """Single crypto deposit row (`mapDepositCryptoWithAsset`)."""

    id: str
    user_id: str
    amount: str
    wallet_address: str
    status: str
    created_at: str
    symbol: str

    @classmethod
    def from_api_dict(cls, data: dict[str, Any]) -> DepositCrypto:
        return cls(
            id=str(data["id"]),
            user_id=str(data.get("userId") or data.get("user_id", "")),
            amount=str(data.get("amount", "")),
            wallet_address=str(data.get("walletAddress") or data.get("wallet_address", "")),
            status=str(data.get("status", "")),
            created_at=str(data.get("createdAt") or data.get("created_at", "")),
            symbol=str(data.get("symbol", "")),
        )


@dataclass
class DepositsListMeta:
    total: int
    limit: int
    offset: int

    @classmethod
    def from_api_dict(cls, data: dict[str, Any]) -> DepositsListMeta:
        return cls(
            total=int(data.get("total", 0)),
            limit=int(data.get("limit", 0)),
            offset=int(data.get("offset", 0)),
        )


@dataclass
class FiatDepositsListResponse:
    data: list[DepositFiat]
    total: int
    meta: DepositsListMeta

    @classmethod
    def from_api_dict(cls, payload: dict[str, Any]) -> FiatDepositsListResponse:
        raw_list = payload.get("data") or []
        rows = [DepositFiat.from_api_dict(o) for o in raw_list if isinstance(o, dict)]
        meta_raw = payload.get("meta") or {}
        return cls(
            data=rows,
            total=int(payload.get("total", 0)),
            meta=DepositsListMeta.from_api_dict(meta_raw if isinstance(meta_raw, dict) else {}),
        )


@dataclass
class CryptoDepositsListResponse:
    data: list[DepositCrypto]
    total: int
    meta: DepositsListMeta

    @classmethod
    def from_api_dict(cls, payload: dict[str, Any]) -> CryptoDepositsListResponse:
        raw_list = payload.get("data") or []
        rows = [DepositCrypto.from_api_dict(o) for o in raw_list if isinstance(o, dict)]
        meta_raw = payload.get("meta") or {}
        return cls(
            data=rows,
            total=int(payload.get("total", 0)),
            meta=DepositsListMeta.from_api_dict(meta_raw if isinstance(meta_raw, dict) else {}),
        )


@dataclass
class WalletBalanceRow:
    """Balance slice from `credit` / deposit create response."""

    id: str
    asset: str
    balance: str
    balance_available: str
    balance_locked: str

    @classmethod
    def from_api_dict(cls, data: dict[str, Any]) -> WalletBalanceRow:
        return cls(
            id=str(data.get("id", "")),
            asset=str(data.get("asset", "")),
            balance=str(data.get("balance", "")),
            balance_available=str(data.get("balanceAvailable") or data.get("balance_available", "")),
            balance_locked=str(data.get("balanceLocked") or data.get("balance_locked", "")),
        )


@dataclass
class BalanceTransactionRow:
    """Ledger row returned with deposit create."""

    id: str
    type: str
    amount: str
    balance_before: str
    balance_after: str
    ref_type: str
    ref_id: str
    created_at: str

    @classmethod
    def from_api_dict(cls, data: dict[str, Any]) -> BalanceTransactionRow:
        return cls(
            id=str(data.get("id", "")),
            type=str(data.get("type", "")),
            amount=str(data.get("amount", "")),
            balance_before=str(data.get("balanceBefore") or data.get("balance_before", "")),
            balance_after=str(data.get("balanceAfter") or data.get("balance_after", "")),
            ref_type=str(data.get("refType") or data.get("ref_type", "")),
            ref_id=str(data.get("refId") or data.get("ref_id", "")),
            created_at=str(data.get("createdAt") or data.get("created_at", "")),
        )


@dataclass
class DepositCreatedMeta:
    user_id: str

    @classmethod
    def from_api_dict(cls, data: dict[str, Any]) -> DepositCreatedMeta:
        return cls(user_id=str(data.get("userId") or data.get("user_id", "")))


@dataclass
class FiatDepositCreatedResponse:
    deposit: DepositFiat
    balance: WalletBalanceRow
    transaction: BalanceTransactionRow
    meta: DepositCreatedMeta

    @classmethod
    def from_api_dict(cls, payload: dict[str, Any]) -> FiatDepositCreatedResponse:
        dep = payload.get("deposit") or {}
        bal = payload.get("balance") or {}
        tx = payload.get("transaction") or {}
        meta = payload.get("meta") or {}
        assert isinstance(dep, dict) and isinstance(bal, dict) and isinstance(tx, dict)
        return cls(
            deposit=DepositFiat.from_api_dict(dep),
            balance=WalletBalanceRow.from_api_dict(bal),
            transaction=BalanceTransactionRow.from_api_dict(tx),
            meta=DepositCreatedMeta.from_api_dict(meta if isinstance(meta, dict) else {}),
        )


@dataclass
class CryptoDepositCreatedResponse:
    deposit: DepositCrypto
    balance: WalletBalanceRow
    transaction: BalanceTransactionRow
    meta: DepositCreatedMeta

    @classmethod
    def from_api_dict(cls, payload: dict[str, Any]) -> CryptoDepositCreatedResponse:
        dep = payload.get("deposit") or {}
        bal = payload.get("balance") or {}
        tx = payload.get("transaction") or {}
        meta = payload.get("meta") or {}
        assert isinstance(dep, dict) and isinstance(bal, dict) and isinstance(tx, dict)
        return cls(
            deposit=DepositCrypto.from_api_dict(dep),
            balance=WalletBalanceRow.from_api_dict(bal),
            transaction=BalanceTransactionRow.from_api_dict(tx),
            meta=DepositCreatedMeta.from_api_dict(meta if isinstance(meta, dict) else {}),
        )


@dataclass
class CryptoDepositAddressResponse:
    user_id: str
    symbol: str
    wallet_address: str
    expires_at: str | None

    @classmethod
    def from_api_dict(cls, data: dict[str, Any]) -> CryptoDepositAddressResponse:
        return cls(
            user_id=str(data.get("userId") or data.get("user_id", "")),
            symbol=str(data.get("symbol", "")),
            wallet_address=str(data.get("walletAddress") or data.get("wallet_address", "")),
            expires_at=_optional_ts(data.get("expiresAt", data.get("expires_at"))),
        )
