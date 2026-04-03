/**
 * Fiat/crypto deposits and DB withdrawal rows. Mapped responses follow `DepositsService` helpers.
 */

export type DepositStatus =
    | "pending"
    | "processing"
    | "completed"
    | "failed"
    | "cancelled";

export type CryptoDepositStatus =
    | "pending"
    | "confirming"
    | "completed"
    | "failed"
    | "cancelled";

export type FiatCurrencyCode = "USD" | "EUR";

/** `DepositsService.mapDepositFiat` */
export type DepositFiat = {
    id: string;
    userId: string;
    fiatCurrency: string;
    amount: string;
    fee: string;
    status: DepositStatus;
    createdAt: string;
    completedAt: string | null;
};

/** `DepositsService.mapDepositCryptoWithAsset` */
export type DepositCrypto = {
    id: string;
    userId: string;
    amount: string;
    walletAddress: string;
    status: CryptoDepositStatus;
    createdAt: string;
    symbol: string;
};

/**
 * `withdrawals` table (Prisma). Not all flows expose full rows on user REST; useful for typing DB/admin tooling.
 */
export type Withdrawal = {
    id: string;
    userId: string;
    assetId: string;
    amount: string;
    destination: string;
    fee: string;
    status: DepositStatus;
    failureReason: string | null;
    txHash: string | null;
    createdAt: string;
    updatedAt: string;
    completedAt: string | null;
};
