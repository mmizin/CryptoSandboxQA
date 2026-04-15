"""
Order API types (aligned with CreateOrderDto and mapOrderForResponse; mirrors ui-tests order.types).
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any


def _optional_ts(value: Any) -> str | None:
    return str(value) if value is not None else None


@dataclass
class CreateOrderRequest:
    """POST /orders body; serialized with camelCase keys for the Nest API."""

    symbol: str
    side: str  # buy | sell
    order_type: str  # limit | market (JSON key: type)
    quantity: float
    price: float | None = None
    market_type: str | None = "spot"  # spot | futures (JSON: marketType)
    initial_status: str | None = None  # open | filled | cancelled (JSON: initialStatus)

    def to_api_dict(self) -> dict[str, Any]:
        body: dict[str, Any] = {
            "symbol": self.symbol,
            "side": self.side,
            "type": self.order_type,
            "quantity": self.quantity,
        }
        if self.price is not None:
            body["price"] = self.price
        if self.market_type is not None:
            body["marketType"] = self.market_type
        if self.initial_status is not None:
            body["initialStatus"] = self.initial_status
        return body


@dataclass
class Order:
    """Single order after mapOrderForResponse (type/status, merged trades)."""

    id: str
    user_id: str
    market_type: str
    symbol: str
    side: str
    order_type: str
    quantity: str
    price: str | None
    filled_quantity: str
    status: str
    failure_reason: str | None
    created_at: str
    updated_at: str
    completed_at: str | None
    trades: list[dict[str, Any]] = field(default_factory=list)

    @classmethod
    def from_api_dict(cls, data: dict[str, Any]) -> Order:
        return cls(
            id=str(data["id"]),
            user_id=str(data.get("userId") or data.get("user_id", "")),
            market_type=str(data.get("marketType") or data.get("market_type", "spot")),
            symbol=str(data["symbol"]),
            side=str(data["side"]),
            order_type=str(data.get("type") or data.get("orderType", "")),
            quantity=str(data.get("quantity", "")),
            price=str(data["price"]) if data.get("price") is not None else None,
            filled_quantity=str(data.get("filledQuantity") or data.get("filled_quantity", "0")),
            status=str(data.get("status") or data.get("orderStatus", "")),
            failure_reason=data.get("failureReason") if data.get("failureReason") is not None else data.get("failure_reason"),
            created_at=str(data.get("createdAt") or data.get("created_at", "")),
            updated_at=str(data.get("updatedAt") or data.get("updated_at", "")),
            completed_at=_optional_ts(data.get("completedAt", data.get("completed_at"))),
            trades=list(data.get("trades") or []),
        )


@dataclass
class OrdersListMeta:
    total: int
    limit: int
    offset: int

    @classmethod
    def from_api_dict(cls, data: dict[str, Any]) -> OrdersListMeta:
        return cls(
            total=int(data.get("total", 0)),
            limit=int(data.get("limit", 0)),
            offset=int(data.get("offset", 0)),
        )


@dataclass
class OrdersListResponse:
    data: list[Order]
    total: int
    meta: OrdersListMeta

    @classmethod
    def from_api_dict(cls, payload: dict[str, Any]) -> OrdersListResponse:
        raw_list = payload.get("data") or []
        orders = [Order.from_api_dict(o) for o in raw_list if isinstance(o, dict)]
        meta_raw = payload.get("meta") or {}
        return cls(
            data=orders,
            total=int(payload.get("total", 0)),
            meta=OrdersListMeta.from_api_dict(meta_raw if isinstance(meta_raw, dict) else {}),
        )
