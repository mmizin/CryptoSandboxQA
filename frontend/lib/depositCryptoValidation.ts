/**
 * Validation helpers for Deposit Crypto form.
 * Backend will re-validate on integration.
 */

export const DEPOSIT_CRYPTO_AMOUNT_MIN = 0.00001;
export const DEPOSIT_CRYPTO_AMOUNT_MAX = 100;
export const DECIMAL_PLACES = 8;

export interface DepositCryptoFormState {
  crypto: string;
  amount: string;
}

export interface DepositCryptoFormErrors {
  crypto?: string;
  amount?: string;
  walletAddress?: string;
}

export function validateDepositCryptoAmount(value: string): string | undefined {
  if (!value || value.trim() === '') return 'Amount is required';
  const num = parseFloat(value);
  if (isNaN(num)) return 'Amount must be a number';
  if (num < DEPOSIT_CRYPTO_AMOUNT_MIN)
    return `Minimum amount is ${DEPOSIT_CRYPTO_AMOUNT_MIN}`;
  if (num > DEPOSIT_CRYPTO_AMOUNT_MAX)
    return `Maximum amount is ${DEPOSIT_CRYPTO_AMOUNT_MAX}`;
  if (num < 0) return 'Amount cannot be negative';
  const parts = value.split('.');
  if (parts.length === 2 && parts[1].length > DECIMAL_PLACES) {
    return `Maximum ${DECIMAL_PLACES} decimal places`;
  }
  return undefined;
}

export function validateCryptoSelection(value: string): string | undefined {
  if (!value || value.trim() === '') return 'Please select a cryptocurrency';
  return undefined;
}

export function validateDepositCryptoForm(state: DepositCryptoFormState): {
  valid: boolean;
  errors: DepositCryptoFormErrors;
} {
  const errors: DepositCryptoFormErrors = {};

  const cryptoErr = validateCryptoSelection(state.crypto);
  if (cryptoErr) errors.crypto = cryptoErr;

  const amountErr = validateDepositCryptoAmount(state.amount);
  if (amountErr) errors.amount = amountErr;

  return { valid: Object.keys(errors).length === 0, errors };
}
