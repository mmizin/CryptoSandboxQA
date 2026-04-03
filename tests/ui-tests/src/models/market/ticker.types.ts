/**
 * DB ticker row (`tickers` table) as returned by Prisma reads.
 * Socket.IO `/ticker` emits {@link TickerPayload} with numeric lastPrice/volume24h.
 */

export type TickerRow = {
    symbol: string;
    lastPrice: string;
    volume24h: string;
    updatedAt: string;
};

/** Payload from `TickerGateway` `ticker` events. */
export type TickerPayload = {
    symbol: string;
    lastPrice: number;
    volume24h: number;
};
