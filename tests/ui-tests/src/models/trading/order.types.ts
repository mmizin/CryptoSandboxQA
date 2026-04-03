import type { Trade } from "./trade.types";

export type OrderSide = "buy" | "sell";

export type OrderType = "limit" | "market";

export type MarketType = "spot" | "futures";

/**
 * API order status: `OrdersService.mapOrderForResponse` exposes `status` (maps from `orderStatus`).
 */
export type OrderStatus =
    | "open"
    | "partially_filled"
    | "filled"
    | "cancelled"
    | "rejected"
    | "expired";

/**
 * Order as returned by order endpoints after `mapOrderForResponse`:
 * Prisma `orderType` → `type`, `orderStatus` → `status`, includes merged `trades`.
 */
export type Order = {
    id: string;
    userId: string;
    marketType: MarketType;
    symbol: string;
    side: OrderSide;
    type: OrderType;
    quantity: string;
    price: string | null;
    filledQuantity: string;
    status: OrderStatus;
    failureReason: string | null;
    createdAt: string;
    updatedAt: string;
    completedAt: string | null;
    trades: Trade[];
};

export type OrdersListResponse = {
    data: Order[];
    total: number;
    meta: { total: number; limit: number; offset: number };
};
