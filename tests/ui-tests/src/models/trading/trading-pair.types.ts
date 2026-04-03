/**
 * Trading pair (`trading_pairs`). Used for validation against configured markets; fields mirror Prisma.
 */

export type TradingPair = {
    symbol: string;
    baseAssetId: string;
    quoteAssetId: string;
    isActive: boolean;
    createdAt: string;
    updatedAt: string;
};
