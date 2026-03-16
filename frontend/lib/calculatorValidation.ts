/**
 * Validation helpers for Crypto Calculator form.
 */

export const AMOUNT_MIN = 0.00000001;
export const AMOUNT_MAX = 1_000_000_000;
export const DECIMAL_PLACES = 8;

export interface CalculatorErrors {
  amount?: string;
  crypto?: string;
  fiat?: string;
}

export function validateAmount(value: string): string | undefined {
  if (!value || value.trim() === '') return 'Amount is required';
  const num = parseFloat(value);
  if (value.trim() !== '' && isNaN(num)) return 'Amount must be a number';
  if (num < 0) return 'Amount cannot be negative';
  if (num === 0) return 'Amount must be greater than zero';
  if (num < AMOUNT_MIN) return `Minimum amount is ${AMOUNT_MIN.toFixed(8)}`;
  if (num > AMOUNT_MAX) return `Maximum amount is ${AMOUNT_MAX.toLocaleString()}`;
  const parts = value.split('.');
  if (parts.length === 2 && parts[1].length > DECIMAL_PLACES) {
    return `Maximum ${DECIMAL_PLACES} decimal places`;
  }
  return undefined;
}

export function validateCryptoSelection(value: string): string | undefined {
  if (!value || value.trim() === '') return 'Select a cryptocurrency';
  return undefined;
}

export function validateFiatSelection(value: string): string | undefined {
  if (!value || value.trim() === '') return 'Select a fiat currency';
  return undefined;
}
