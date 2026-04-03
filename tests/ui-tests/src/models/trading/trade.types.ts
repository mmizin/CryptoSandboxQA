/**
 * Executed trade (`trades`). Raw Prisma JSON uses Decimal → often string in responses.
 */

export type Trade = {
    id: string;
    symbol: string;
    takerOrderId: string;
    makerOrderId: string;
    takerUserId: string;
    makerUserId: string;
    quantity: string;
    price: string;
    createdAt: string;
};

/** Row from `GET /transactions/trades`. */
export type TradeHistoryEntry = {
    id: string;
    symbol: string;
    quantity: string;
    price: string;
    side: "taker" | "maker";
    takerUserId: string;
    makerUserId: string;
    createdAt: string;
};
