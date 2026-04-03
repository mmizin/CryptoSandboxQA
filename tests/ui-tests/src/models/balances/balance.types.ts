/**
 * Wallet line from `GET /wallets` / `GET /wallets/:asset` (`WalletsService.formatWalletResponse`).
 */

export type WalletBalance = {
    id: string;
    userId: string;
    asset: string;
    balance: string;
    balanceAvailable: string;
    balanceLocked: string;
};

/**
 * Row from `GET /transactions` (`TransactionsService.getTransactions`).
 */
export type BalanceTransaction = {
    id: string;
    userId: string;
    type: string;
    asset: string;
    amount: string;
    balanceBefore: string;
    balanceAfter: string;
    refType: string | null;
    refId: string | null;
    createdAt: string;
};

/** Portfolio `GET /portfolio/balances` line item. */
export type PortfolioBalanceLine = {
    asset: string;
    available: string;
    locked: string;
    total: string;
};

export type PortfolioBalancesResponse = {
    balances: PortfolioBalanceLine[];
};

export type PortfolioSummaryAsset = {
    symbol: string;
    amount: string;
    priceUsd: string;
    valueUsd: string;
};

export type PortfolioSummaryResponse = {
    totalValueUsd: string;
    assets: PortfolioSummaryAsset[];
};

export type PortfolioAllocationLine = {
    symbol: string;
    percentage: number;
    valueUsd: string;
};

export type PortfolioAllocationResponse = {
    allocations: PortfolioAllocationLine[];
};
