/**
 * Validation helpers for Deposit Cash form.
 * Reuses card/SEPA validators from buySellValidation.
 * Backend will re-validate on integration.
 */

import {
  validateIBAN,
  validateSEPAName,
  validateCardNumber,
  validateExpiry,
  validateCVV,
} from '@/lib/buySellValidation';

export const DEPOSIT_AMOUNT_MIN = 1;
export const DEPOSIT_AMOUNT_MAX = 50_000;
export const DECIMAL_PLACES = 2;

/** Mock daily limit for deposit (QA testing) */
export const MOCK_DAILY_LIMIT = 50_000;

export type PaymentMethod = 'card' | 'sepa' | 'applepay';

export interface DepositFormErrors {
  amount?: string;
  currency?: string;
  dailyLimit?: string;
  paymentMethod?: string;
  iban?: string;
  sepaName?: string;
  cardNumber?: string;
  expiry?: string;
  cvv?: string;
}

export interface DepositFormState {
  amount: string;
  currency: string;
  paymentMethod: PaymentMethod;
  iban: string;
  sepaName: string;
  cardNumber: string;
  expiry: string;
  cvv: string;
}

export function validateDepositAmount(value: string): string | undefined {
  if (!value || value.trim() === '') return 'Amount is required';
  const num = parseFloat(value);
  if (isNaN(num)) return 'Amount must be a number';
  if (num < DEPOSIT_AMOUNT_MIN) return `Minimum amount is ${DEPOSIT_AMOUNT_MIN}`;
  if (num > DEPOSIT_AMOUNT_MAX) return `Maximum amount is ${DEPOSIT_AMOUNT_MAX}`;
  const parts = value.split('.');
  if (parts.length === 2 && parts[1].length > DECIMAL_PLACES) {
    return `Maximum ${DECIMAL_PLACES} decimal places`;
  }
  return undefined;
}

export function validateDepositCurrency(value: string): string | undefined {
  if (!value || value.trim() === '') return 'Currency is required';
  return undefined;
}

export function validateDepositForm(
  state: DepositFormState,
  options?: { dailyLimit?: number }
): { valid: boolean; errors: DepositFormErrors } {
  const errors: DepositFormErrors = {};
  const dailyLimit = options?.dailyLimit ?? MOCK_DAILY_LIMIT;

  const amountErr = validateDepositAmount(state.amount);
  if (amountErr) errors.amount = amountErr;

  const currencyErr = validateDepositCurrency(state.currency);
  if (currencyErr) errors.currency = currencyErr;

  // Optional: daily limit check
  const amountNum = parseFloat(state.amount) || 0;
  if (amountNum > 0 && amountNum > dailyLimit) {
    errors.dailyLimit = `Amount exceeds daily limit of ${dailyLimit.toLocaleString()}`;
  }

  if (state.paymentMethod === 'sepa') {
    const ibanErr = validateIBAN(state.iban);
    if (ibanErr) errors.iban = ibanErr;
    const sepaNameErr = validateSEPAName(state.sepaName);
    if (sepaNameErr) errors.sepaName = sepaNameErr;
  }

  if (state.paymentMethod === 'applepay') {
    errors.paymentMethod = 'Apple Pay integration coming soon';
  }

  if (state.paymentMethod === 'card') {
    const cardErr = validateCardNumber(state.cardNumber);
    if (cardErr) errors.cardNumber = cardErr;
    const expiryErr = validateExpiry(state.expiry);
    if (expiryErr) errors.expiry = expiryErr;
    const cvvErr = validateCVV(state.cvv);
    if (cvvErr) errors.cvv = cvvErr;
  }

  return { valid: Object.keys(errors).length === 0, errors };
}
