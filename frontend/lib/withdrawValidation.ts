/**
 * Client-side validation for wallet withdraw — aligned with backend
 * `WithdrawDto` and `WALLET_WITHDRAW_AMOUNT_MAX` in validation.constants.ts.
 */

export const WALLET_WITHDRAW_AMOUNT_MAX = 1_000_000_000;

/** Same tradable crypto base assets as backend seed (`backend/prisma/seed-lib.js` ASSET_DEFS). */
const WITHDRAW_ASSETS = [
  'BTC',
  'ETH',
  'SOL',
  'XRP',
  'BNB',
  'ADA',
  'DOGE',
  'AVAX',
  'LINK',
  'LTC',
] as const;
export type WithdrawAsset = (typeof WITHDRAW_ASSETS)[number];
/** Crypto symbols aligned with backend withdraw (DB asset_type crypto); API rejects fiat. */
export const WITHDRAW_ASSET_OPTIONS: readonly WithdrawAsset[] = WITHDRAW_ASSETS;

export function validateWithdrawAmount(amountStr: string): string | null {
  const trimmed = amountStr.trim();
  if (!trimmed) {
    return 'Enter an amount';
  }
  const n = Number(trimmed);
  if (!Number.isFinite(n)) {
    return 'Enter a valid number';
  }
  if (n <= 0) {
    return 'Amount must be greater than zero';
  }
  if (n > WALLET_WITHDRAW_AMOUNT_MAX) {
    return `Amount cannot exceed ${WALLET_WITHDRAW_AMOUNT_MAX.toLocaleString()}`;
  }
  return null;
}
