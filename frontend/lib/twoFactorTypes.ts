/**
 * Types for Two-Factor Authentication (2FA).
 * These match the expected backend API contract for future integration.
 */

/** Response when initiating 2FA setup - real QR code and secret from backend */
export interface TwoFactorSetupResponse {
  /** Data URL or image URL for QR code (e.g. data:image/png;base64,... or https://...) */
  qrCodeUrl: string;
  /** Secret key for manual entry in authenticator app (e.g. "JBSWY3DPEHPK3PXP") */
  secret: string;
}

/** Response when regenerating backup codes */
export interface TwoFactorBackupCodesResponse {
  codes: string[];
}

/**
 * Login response when 2FA is required.
 * Real backend: POST /auth/login returns this when credentials valid but 2FA enabled.
 * Frontend then shows 2FA modal and calls POST /auth/2fa/verify with tempToken + code.
 */
export interface LoginRequires2FaResponse {
  requires2fa: true;
  /** Temporary token to use when calling twoFactorApi.verify() */
  tempToken: string;
}

/** Request body for 2FA verification during login */
export interface Verify2FaRequest {
  tempToken: string;
  code: string;
}

/** Request body for enabling 2FA (verify setup code) */
export interface Enable2FaRequest {
  code: string;
}
