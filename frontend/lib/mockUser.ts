export const mockUser = {
  username: 'crypto_trader',
  email: 'trader@example.com',
  accountId: 'acc_7f3b2c1a-9d4e-4a8b-b5c2-1e6f0a9d8b7c',
  joinDate: '2024-01-15',
};

export type MockHolding = {
  coin: string;
  amount: number;
  currentPrice: number;
  totalValue: number;
};

export const mockPortfolio: MockHolding[] = [
  { coin: 'BTC', amount: 0.5, currentPrice: 67000, totalValue: 33500 },
  { coin: 'ETH', amount: 2.0, currentPrice: 3500, totalValue: 7000 },
  { coin: 'SOL', amount: 50, currentPrice: 185, totalValue: 9250 },
  { coin: 'USDT', amount: 1000, currentPrice: 1, totalValue: 1000 },
];
