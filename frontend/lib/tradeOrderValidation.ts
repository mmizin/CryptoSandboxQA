/**
 * Validation helpers for Trade order entry.
 * Mock balance validation; backend will re-validate on integration.
 */

export type OrderType = 'market' | 'limit' | 'stop-limit';

export interface OrderFormState {
  orderType: OrderType;
  side: 'buy' | 'sell';
  amount: string;
  price: string;
  stopPrice: string;
}

export interface OrderErrors {
  amount?: string;
  price?: string;
  stopPrice?: string;
  balance?: string;
}

const MIN_AMOUNT = 0.00000001;
const MAX_AMOUNT = 1_000_000;
const MAX_DECIMALS = 8;

export function validateAmount(value: string): string | undefined {
  if (!value || value.trim() === '') return 'Amount is required';
  const num = parseFloat(value);
  if (isNaN(num)) return 'Amount must be a number';
  if (num < MIN_AMOUNT) return 'Amount must be greater than 0';
  if (num > MAX_AMOUNT) return `Maximum amount is ${MAX_AMOUNT.toLocaleString()}`;
  const parts = value.split('.');
  if (parts.length === 2 && parts[1].length > MAX_DECIMALS) {
    return `Maximum ${MAX_DECIMALS} decimal places`;
  }
  return undefined;
}

export function validatePrice(value: string, required: boolean): string | undefined {
  if (!required) return undefined;
  if (!value || value.trim() === '') return 'Price is required';
  const num = parseFloat(value);
  if (isNaN(num)) return 'Price must be a number';
  if (num <= 0) return 'Price must be greater than 0';
  return undefined;
}

export function validateOrderForm(
  state: OrderFormState,
  currentPrice: number,
  balances: Record<string, number>,
  quoteSymbol: string = 'USD',
  baseSymbol?: string
): { valid: boolean; errors: OrderErrors } {
  const errors: OrderErrors = {};
  const amount = parseFloat(state.amount);

  const amountErr = validateAmount(state.amount);
  if (amountErr) errors.amount = amountErr;

  const needsPrice = state.orderType === 'limit' || state.orderType === 'stop-limit';
  const priceErr = validatePrice(state.price, needsPrice);
  if (priceErr) errors.price = priceErr;

  const needsStopPrice = state.orderType === 'stop-limit';
  const stopPriceErr = validatePrice(state.stopPrice, needsStopPrice);
  if (stopPriceErr) errors.stopPrice = stopPriceErr;

  if (!amountErr && !isNaN(amount) && amount > 0) {
    const base = baseSymbol || 'BTC';
    if (state.side === 'buy') {
      const cost = state.orderType === 'market' ? amount * currentPrice : amount * parseFloat(state.price || '0');
      const balance = balances[quoteSymbol] ?? 0;
      if (cost > balance) {
        errors.balance = `Insufficient ${quoteSymbol} balance. Available: ${balance.toLocaleString()}`;
      }
    } else {
      const balance = balances[base] ?? 0;
      if (amount > balance) {
        errors.balance = `Insufficient ${base} balance. Available: ${balance.toLocaleString()}`;
      }
    }
  }

  return { valid: Object.keys(errors).length === 0, errors };
}
