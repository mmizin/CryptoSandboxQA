/**
 * Market listing row from `GET /cryptos`, `GET /cryptos/:symbol`.
 * See `CryptosService.findAll` / `findBySymbol` (amounts as strings).
 */

export type Crypto = {
    id: string;
    name: string;
    symbol: string;
    price: string;
    change24h: string;
    volume24h: string;
    popular: boolean;
};

export type CryptosListResponse = {
    data: Crypto[];
    total: number;
};

export type CryptoPriceHistoryPoint = {
    timestamp: string;
    price: string;
};

export type CryptoPriceHistoryResponse = {
    symbol: string;
    data: CryptoPriceHistoryPoint[];
};
