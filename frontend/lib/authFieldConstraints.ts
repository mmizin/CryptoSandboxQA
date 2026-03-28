/**
 * Auth field limits aligned with Nest DTOs (RegisterDto, LoginDto, ResetPasswordWithCodeDto).
 * User-facing strings are stable for QA docs and Playwright assertions.
 */

export const PASSWORD_MIN_LENGTH = 6;
export const DISPLAY_NAME_MAX_LENGTH = 100;
export const EMAIL_MAX_LENGTH = 254;
export const RESET_CODE_LENGTH = 8;

/** Matches typical `IsEmail` / RFC 5322-ish local@domain */
const EMAIL_REGEX =
  /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;

export const AuthMessages = {
  emailRequired: 'Email is required',
  emailInvalid: 'Enter a valid email address',
  emailTooLong: `Email must be at most ${EMAIL_MAX_LENGTH} characters`,
  passwordRequired: 'Password is required',
  passwordTooShort: `Password must be at least ${PASSWORD_MIN_LENGTH} characters`,
  displayNameTooLong: `Display name must be at most ${DISPLAY_NAME_MAX_LENGTH} characters`,
  resetCodeDigits: `Reset code must be ${RESET_CODE_LENGTH} digits`,
  passwordsMismatch: 'Passwords do not match',
} as const;

export function validateEmail(value: string): string | undefined {
  const t = value.trim();
  if (!t) return AuthMessages.emailRequired;
  if (t.length > EMAIL_MAX_LENGTH) return AuthMessages.emailTooLong;
  if (!EMAIL_REGEX.test(t)) return AuthMessages.emailInvalid;
  return undefined;
}

export function validatePassword(value: string): string | undefined {
  if (!value) return AuthMessages.passwordRequired;
  if (value.length < PASSWORD_MIN_LENGTH) return AuthMessages.passwordTooShort;
  return undefined;
}

/** Optional display name: empty ok; otherwise max length */
export function validateDisplayNameOptional(value: string): string | undefined {
  if (!value.trim()) return undefined;
  if (value.length > DISPLAY_NAME_MAX_LENGTH) return AuthMessages.displayNameTooLong;
  return undefined;
}

export function validateResetCode(value: string): string | undefined {
  const digits = value.replace(/\D/g, '');
  if (digits.length !== RESET_CODE_LENGTH) return AuthMessages.resetCodeDigits;
  return undefined;
}
