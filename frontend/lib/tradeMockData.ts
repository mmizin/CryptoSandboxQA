/**
 * Mock data for Trade (Spot/Futures) pages.
 * Reusable for backend integration later.
 */

export interface TradeCoin {
  id: string;
  symbol: string;
  name: string;
  price: number;
  change24h: number;
  volume24h: number;
}

export interface PricePoint {
  time: string;
  price: number;
}

export interface TradeOrder {
  id: string;
  symbol: string;
  orderType: 'market' | 'limit' | 'stop-limit';
  side: 'buy' | 'sell';
  amount: number;
  price: number | null;
  stopPrice?: number;
  status: 'open' | 'filled' | 'cancelled';
  createdAt: string;
}

export const TRADE_COINS: TradeCoin[] = [
  { id: '1', symbol: 'BTC', name: 'Bitcoin', price: 97_500, change24h: 2.34, volume24h: 28_500_000_000 },
  { id: '2', symbol: 'ETH', name: 'Ethereum', price: 3_650, change24h: -1.2, volume24h: 12_100_000_000 },
  { id: '3', symbol: 'SOL', name: 'Solana', price: 235, change24h: 5.67, volume24h: 2_800_000_000 },
  { id: '4', symbol: 'XRP', name: 'XRP', price: 2.45, change24h: -0.8, volume24h: 1_200_000_000 },
  { id: '5', symbol: 'BNB', name: 'BNB', price: 715, change24h: 1.5, volume24h: 980_000_000 },
  { id: '6', symbol: 'ADA', name: 'Cardano', price: 1.12, change24h: 3.1, volume24h: 450_000_000 },
  { id: '7', symbol: 'DOGE', name: 'Dogecoin', price: 0.38, change24h: -2.0, volume24h: 320_000_000 },
  { id: '8', symbol: 'AVAX', name: 'Avalanche', price: 42, change24h: 4.2, volume24h: 280_000_000 },
  { id: '9', symbol: 'LINK', name: 'Chainlink', price: 18.5, change24h: -0.5, volume24h: 180_000_000 },
  { id: '10', symbol: 'LTC', name: 'Litecoin', price: 95, change24h: 1.8, volume24h: 150_000_000 },
];

export const MOCK_BALANCES: Record<string, number> = {
  USD: 10_000,
  BTC: 0.5,
  ETH: 10,
  SOL: 100,
};

const SEED_MAP: Record<string, number> = {};
function seededRandom(seed: string): number {
  if (!SEED_MAP[seed]) SEED_MAP[seed] = 0;
  const x = Math.sin(SEED_MAP[seed]++) * 10000;
  return x - Math.floor(x);
}

/** Generate deterministic mock price series for a coin (24 points) */
export function generateMockPriceSeries(symbol: string, basePrice: number): PricePoint[] {
  const points: PricePoint[] = [];
  let price = basePrice;
  const now = Date.now();
  const step = 3600000; // 1 hour

  for (let i = 24; i >= 0; i--) {
    const t = new Date(now - i * step);
    const change = (seededRandom(`${symbol}-${i}`) - 0.5) * 0.02;
    price = price * (1 + change);
    points.push({
      time: t.toISOString().slice(0, 16),
      price: Math.round(price * 100) / 100,
    });
  }
  return points;
}

/** Mock orders for Active + History tabs */
export function getMockOrders(): TradeOrder[] {
  const base = new Date();
  return [
    { id: '1', symbol: 'BTC', orderType: 'limit', side: 'buy', amount: 0.01, price: 96000, status: 'open', createdAt: new Date(base.getTime() - 3600000).toISOString() },
    { id: '2', symbol: 'ETH', orderType: 'market', side: 'sell', amount: 0.5, price: null, status: 'filled', createdAt: new Date(base.getTime() - 7200000).toISOString() },
    { id: '3', symbol: 'SOL', orderType: 'stop-limit', side: 'buy', amount: 10, price: 220, stopPrice: 225, status: 'open', createdAt: new Date(base.getTime() - 86400000).toISOString() },
    { id: '4', symbol: 'BTC', orderType: 'limit', side: 'sell', amount: 0.02, price: 98000, status: 'cancelled', createdAt: new Date(base.getTime() - 172800000).toISOString() },
    { id: '5', symbol: 'ETH', orderType: 'limit', side: 'buy', amount: 2, price: 3500, status: 'filled', createdAt: new Date(base.getTime() - 259200000).toISOString() },
    { id: '6', symbol: 'XRP', orderType: 'market', side: 'buy', amount: 500, price: null, status: 'open', createdAt: new Date(base.getTime() - 60000).toISOString() },
  ];
}

export const POPULAR_SYMBOLS = ['BTC', 'ETH', 'SOL', 'XRP', 'BNB'];
