/**
 * Training `assets` row (crypto/fiat). Used in DB/seeds; not all fields are exposed on every REST route.
 */

export type AssetType = "crypto" | "fiat";

export type Asset = {
    id: string;
    symbol: string;
    name: string;
    assetType: AssetType;
    walletAddress: string | null;
    decimals: number;
    isActive: boolean;
    createdAt: string;
    updatedAt: string;
};
