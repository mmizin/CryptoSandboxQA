/**
 * Mock data and state for 2FA UI testing.
 *
 * BACKEND INTEGRATION:
 * When real 2FA is implemented, replace twoFactorApi in lib/api.ts with real API calls.
 * The backend will provide:
 * - Real QR code (data URL or image URL) from GET /auth/2fa/setup
 * - Real secret key for manual entry
 * - Real backup codes from GET/POST /auth/2fa/backup-codes
 * - 2FA required flag from login response (e.g. requires2fa + tempToken)
 * - Verify endpoint POST /auth/2fa/verify with tempToken + code -> access_token
 */

const MOCK_2FA_STORAGE_KEY = 'mock_2fa_enabled';

/** Code accepted as valid during mock verification. Remove when using real TOTP. */
export const MOCK_VALID_CODE = '123456';

/** Placeholder until backend returns real QR (e.g. otpauth://... encoded as image) */
const PLACEHOLDER_QR =
  'data:image/svg+xml,' +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128"><rect width="128" height="128" fill="#374151"/><text x="64" y="70" text-anchor="middle" fill="#9ca3af" font-size="12">QR Code</text></svg>'
  );

/** Mock QR code image for authenticator setup */
export const MOCK_QR_IMAGE = PLACEHOLDER_QR;

export function getMock2faEnabled(): boolean {
  if (typeof window === 'undefined') return false;
  return localStorage.getItem(MOCK_2FA_STORAGE_KEY) === 'true';
}

export function setMock2faEnabled(enabled: boolean): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(MOCK_2FA_STORAGE_KEY, String(enabled));
}

/** Generate 8 mock backup codes (format: XXXX-XXXX) */
export function generateMockBackupCodes(): string[] {
  const codes: string[] = [];
  for (let i = 0; i < 8; i++) {
    const p1 = Math.floor(1000 + Math.random() * 9000).toString();
    const p2 = Math.floor(1000 + Math.random() * 9000).toString();
    codes.push(`${p1}-${p2}`);
  }
  return codes;
}

/** Default mock backup codes for display */
export function getDefaultMockBackupCodes(): string[] {
  return [
    '1234-5678',
    '2345-6789',
    '3456-7890',
    '4567-8901',
    '5678-9012',
    '6789-0123',
    '7890-1234',
    '8901-2345',
  ];
}
