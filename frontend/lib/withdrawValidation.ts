/**
 * Client-side validation for wallet withdraw — aligned with backend
 * `WithdrawDto` and `WALLET_WITHDRAW_AMOUNT_MAX` in validation.constants.ts.
 */

export const WALLET_WITHDRAW_AMOUNT_MAX = 1_000_000_000;

const WITHDRAW_ASSETS = ['USD', 'EUR', 'BTC', 'ETH'] as const;
export type WithdrawAsset = (typeof WITHDRAW_ASSETS)[number];
/** Same set as backend `WithdrawDto.asset` */
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
