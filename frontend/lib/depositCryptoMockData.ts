/**
 * Mock data for Deposit Crypto page.
 * Used until backend integration is available.
 */

export interface MockCryptoAsset {
  code: string;
  name: string;
  symbol: string;
}

export const MOCK_CRYPTO_ASSETS: MockCryptoAsset[] = [
  { code: 'BTC', name: 'Bitcoin', symbol: 'BTC' },
  { code: 'ETH', name: 'Ethereum', symbol: 'ETH' },
  { code: 'USDT', name: 'Tether', symbol: 'USDT' },
  { code: 'SOL', name: 'Solana', symbol: 'SOL' },
  { code: 'XRP', name: 'Ripple', symbol: 'XRP' },
];

/** Mock wallet addresses per asset (for display and copy). */
export const MOCK_WALLET_ADDRESSES: Record<string, string> = {
  BTC: 'bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh',
  ETH: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb',
  USDT: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb',
  SOL: 'DYw8jCTfwHNRJhhmFcbXvVDTqWMEVFBX6ZKUmG5CNSKK',
  XRP: 'rN7n7otQDd6FczFgLdlqtyMVrn3e1DjxvV',
};

/** QA: USDT returns null to simulate "address unavailable" scenario */
export const MOCK_UNSUPPORTED_ASSET = 'USDT';

export function getMockWalletAddress(asset: string): string | null {
  if (asset === MOCK_UNSUPPORTED_ASSET) return null;
  return MOCK_WALLET_ADDRESSES[asset] ?? null;
}
