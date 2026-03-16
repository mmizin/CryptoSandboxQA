/**
 * Validation helpers for 2FA verification code.
 * Backend will re-validate on integration.
 */

const CODE_LENGTH = 6;
const VALID_CODE_REGEX = /^\d{6}$/;

export function validateTwoFactorCode(value: string): string | undefined {
  if (!value || value.trim() === '') {
    return 'Verification code is required';
  }
  if (value.length !== CODE_LENGTH) {
    return 'Code must be 6 digits';
  }
  if (!VALID_CODE_REGEX.test(value)) {
    return 'Code must contain only numbers';
  }
  return undefined;
}
