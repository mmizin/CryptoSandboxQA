/**
 * Mock data for Buy and Sell page.
 * MOCK_CURRENCIES deprecated — use cryptosApi for live data.
 * FALLBACK_CRYPTOS used when API is unavailable.
 */

export interface MockCurrency {
  symbol: string;
  name: string;
  priceUsd: number;
}

/** @deprecated Use cryptosApi — kept for getMockPrice fallback */
export const MOCK_CURRENCIES: MockCurrency[] = [
  { symbol: 'BTC', name: 'Bitcoin', priceUsd: 97_500 },
  { symbol: 'ETH', name: 'Ethereum', priceUsd: 3_650 },
  { symbol: 'SOL', name: 'Solana', priceUsd: 235 },
  { symbol: 'XRP', name: 'XRP', priceUsd: 2.45 },
  { symbol: 'DOGE', name: 'Dogecoin', priceUsd: 0.38 },
];

/** Fallback list when cryptos API is unavailable — mirrors backend seed */
export const FALLBACK_CRYPTOS: Array<{ symbol: string; name: string; price: number }> = [
  { symbol: 'BTC', name: 'Bitcoin', price: 97500 },
  { symbol: 'ETH', name: 'Ethereum', price: 3650 },
  { symbol: 'USDT', name: 'Tether', price: 1 },
  { symbol: 'BNB', name: 'BNB', price: 715 },
  { symbol: 'SOL', name: 'Solana', price: 235 },
  { symbol: 'XRP', name: 'XRP', price: 2.45 },
  { symbol: 'USDC', name: 'USDC', price: 1 },
  { symbol: 'ADA', name: 'Cardano', price: 1.12 },
  { symbol: 'DOGE', name: 'Dogecoin', price: 0.38 },
  { symbol: 'AVAX', name: 'Avalanche', price: 42 },
  { symbol: 'TRX', name: 'TRON', price: 0.22 },
  { symbol: 'LINK', name: 'Chainlink', price: 18.5 },
  { symbol: 'DOT', name: 'Polkadot', price: 7.8 },
  { symbol: 'MATIC', name: 'Polygon', price: 0.52 },
  { symbol: 'SHIB', name: 'Shiba Inu', price: 0.000025 },
  { symbol: 'LTC', name: 'Litecoin', price: 95 },
  { symbol: 'UNI', name: 'Uniswap', price: 12.5 },
  { symbol: 'TON', name: 'Toncoin', price: 5.85 },
  { symbol: 'PEPE', name: 'Pepe', price: 0.000012 },
  { symbol: 'BONK', name: 'Bonk', price: 0.000032 },
  { symbol: 'WLD', name: 'Worldcoin', price: 4.85 },
];

/** Mock fee percentage for display */
export const MOCK_FEE_PERCENT = 1;

export function getMockPrice(symbol: string): number {
  const c = MOCK_CURRENCIES.find((x) => x.symbol === symbol);
  return c?.priceUsd ?? 0;
}
