/**
 * Mock data for Deposit Cash page.
 * Used until backend integration is available.
 */

export interface MockFiatCurrency {
  code: string;
  name: string;
  symbol: string;
}

export const MOCK_CURRENCIES: MockFiatCurrency[] = [
  { code: 'USD', name: 'US Dollar', symbol: '$' },
  { code: 'EUR', name: 'Euro', symbol: '€' },
  { code: 'GBP', name: 'British Pound', symbol: '£' },
  { code: 'CHF', name: 'Swiss Franc', symbol: 'CHF' },
  { code: 'PLN', name: 'Polish Złoty', symbol: 'zł' },
];

/** Mock fee percentage for card payments (QA testing) */
export const MOCK_CARD_FEE_PERCENT = 1.5;

/** Mock fee for SEPA (often free or flat) */
export const MOCK_SEPA_FEE = 0;

export function getMockBalance(currency: string): number {
  const balances: Record<string, number> = {
    USD: 1250.5,
    EUR: 890.25,
    GBP: 420.0,
    CHF: 0,
    PLN: 0,
  };
  return balances[currency] ?? 0;
}
