/**
 * Validation helpers for Buy and Sell form.
 * Used for frontend validation; backend will re-validate on integration.
 */

export const AMOUNT_MIN = 10;
export const AMOUNT_MAX = 100_000;
export const DECIMAL_PLACES = 8;

export const SEPA_NAME_MAX = 100;
export const SEPA_BANK_NAME_MAX = 100;
export const IBAN_MIN_LENGTH = 15;
export const IBAN_MAX_LENGTH = 34;

export const CVV_LENGTH_MIN = 3;
export const CVV_LENGTH_MAX = 4;

export type PaymentMethod = 'sepa' | 'card' | 'applepay';

export interface FormErrors {
  amount?: string;
  currency?: string;
  iban?: string;
  sepaName?: string;
  sepaBankName?: string;
  cardNumber?: string;
  expiry?: string;
  cvv?: string;
}

export interface FormState {
  amount: string;
  currency: string;
  currencyPrice: number; // from API when selected; 0 = use fallback
  paymentMethod: PaymentMethod;
  iban: string;
  sepaName: string;
  sepaBankName: string;
  cardNumber: string;
  expiry: string;
  cvv: string;
}

export function validateAmount(value: string): string | undefined {
  if (!value || value.trim() === '') return 'Amount is required';
  const num = parseFloat(value);
  if (isNaN(num)) return 'Amount must be a number';
  if (num < AMOUNT_MIN) return `Minimum amount is ${AMOUNT_MIN}`;
  if (num > AMOUNT_MAX) return `Maximum amount is ${AMOUNT_MAX}`;
  const parts = value.split('.');
  if (parts.length === 2 && parts[1].length > DECIMAL_PLACES) {
    return `Maximum ${DECIMAL_PLACES} decimal places`;
  }
  return undefined;
}

export function validateCurrency(value: string): string | undefined {
  if (!value || value.trim() === '') return 'Currency is required';
  return undefined;
}

/** Basic IBAN format: 2 letters + 2 digits + alphanumeric, total 15-34 chars */
const IBAN_REGEX = /^[A-Z]{2}[0-9]{2}[A-Z0-9]{11,30}$/i;

export function validateIBAN(value: string): string | undefined {
  const cleaned = value.replace(/\s/g, '');
  if (cleaned.length === 0) return 'IBAN is required';
  if (cleaned.length < IBAN_MIN_LENGTH) return `IBAN must be at least ${IBAN_MIN_LENGTH} characters`;
  if (cleaned.length > IBAN_MAX_LENGTH) return `IBAN must be at most ${IBAN_MAX_LENGTH} characters`;
  if (!IBAN_REGEX.test(cleaned)) return 'Invalid IBAN format (e.g. DE89370400440532013000)';
  return undefined;
}

export function validateSEPAName(value: string): string | undefined {
  if (!value || value.trim() === '') return 'Account holder name is required';
  if (value.length > SEPA_NAME_MAX) return `Name must be at most ${SEPA_NAME_MAX} characters`;
  return undefined;
}

export function validateSEPABankName(value: string): string | undefined {
  if (!value || value.trim() === '') return 'Bank name is required';
  if (value.length > SEPA_BANK_NAME_MAX) return `Bank name must be at most ${SEPA_BANK_NAME_MAX} characters`;
  return undefined;
}

/** Card number: 13-19 digits, optionally with spaces/dashes */
export function validateCardNumber(value: string): string | undefined {
  const cleaned = value.replace(/\s|-/g, '');
  if (cleaned.length === 0) return 'Card number is required';
  if (!/^\d+$/.test(cleaned)) return 'Card number must contain only digits';
  if (cleaned.length < 13 || cleaned.length > 19) return 'Invalid card number length';
  return undefined;
}

/** Expiry: MM/YY, must be future */
export function validateExpiry(value: string): string | undefined {
  if (!value || value.trim() === '') return 'Expiry date is required';
  const match = value.match(/^(\d{2})\/(\d{2})$/);
  if (!match) return 'Use MM/YY format';
  const month = parseInt(match[1], 10);
  const year = parseInt(match[2], 10);
  if (month < 1 || month > 12) return 'Invalid month';
  const now = new Date();
  const expiryDate = new Date(2000 + year, month - 1);
  if (expiryDate <= now) return 'Card has expired';
  return undefined;
}

export function validateCVV(value: string): string | undefined {
  if (!value || value.trim() === '') return 'CVV is required';
  if (!/^\d+$/.test(value)) return 'CVV must be digits only';
  if (value.length < CVV_LENGTH_MIN || value.length > CVV_LENGTH_MAX) {
    return `CVV must be ${CVV_LENGTH_MIN} or ${CVV_LENGTH_MAX} digits`;
  }
  return undefined;
}

export function validateForm(state: FormState): { valid: boolean; errors: FormErrors } {
  const errors: FormErrors = {};

  const amountErr = validateAmount(state.amount);
  if (amountErr) errors.amount = amountErr;

  const currencyErr = validateCurrency(state.currency);
  if (currencyErr) errors.currency = currencyErr;

  if (state.paymentMethod === 'sepa') {
    const ibanErr = validateIBAN(state.iban);
    if (ibanErr) errors.iban = ibanErr;
    const sepaNameErr = validateSEPAName(state.sepaName);
    if (sepaNameErr) errors.sepaName = sepaNameErr;
    const sepaBankErr = validateSEPABankName(state.sepaBankName);
    if (sepaBankErr) errors.sepaBankName = sepaBankErr;
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
