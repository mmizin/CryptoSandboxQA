/**
 * Mock exchange rates for Crypto Calculator.
 * Backend integration will replace these with live rates.
 */

export const CRYPTO_OPTIONS = [
  { symbol: 'BTC', name: 'Bitcoin' },
  { symbol: 'ETH', name: 'Ethereum' },
  { symbol: 'SOL', name: 'Solana' },
  { symbol: 'XRP', name: 'XRP' },
  { symbol: 'DOGE', name: 'Dogecoin' },
  { symbol: 'ADA', name: 'Cardano' },
  { symbol: 'AVAX', name: 'Avalanche' },
  { symbol: 'LINK', name: 'Chainlink' },
  { symbol: 'DOT', name: 'Polkadot' },
  { symbol: 'LTC', name: 'Litecoin' },
] as const;

export const FIAT_OPTIONS = [
  { symbol: 'USD', name: 'US Dollar' },
  { symbol: 'EUR', name: 'Euro' },
  { symbol: 'GBP', name: 'British Pound' },
] as const;

/** Mock rates: 1 crypto unit = X fiat units. Base is USD. EUR/GBP derived. */
const USD_RATES: Record<string, number> = {
  BTC: 97_500,
  ETH: 3_650,
  SOL: 235,
  XRP: 2.45,
  DOGE: 0.38,
  ADA: 1.12,
  AVAX: 42,
  LINK: 18.5,
  DOT: 7.8,
  LTC: 95,
};

/** Fiat to USD (1 fiat = X USD) */
const FIAT_TO_USD: Record<string, number> = {
  USD: 1,
  EUR: 1.08,
  GBP: 1.27,
};

/**
 * Get mock exchange rate: 1 unit of crypto = X units of fiat.
 */
export function getMockRate(crypto: string, fiat: string): number {
  const usdPerCrypto = USD_RATES[crypto] ?? 0;
  const fiatPerUsd = 1 / (FIAT_TO_USD[fiat] ?? 1);
  return usdPerCrypto * fiatPerUsd;
}

/**
 * Mock last update timestamp for rates display.
 */
export function getMockLastUpdate(): Date {
  return new Date(Date.now() - 60_000); // 1 minute ago
}
