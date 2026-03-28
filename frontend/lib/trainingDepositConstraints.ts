/**
 * Training wallet deposit on dashboard — value matches `WALLET_DEPOSIT_AMOUNT_MAX`
 * in backend `common/validation.constants.ts` / `DepositDto` `@Max`.
 */

export const TRAINING_DEPOSIT_MAX = 1_000_000_000;

export const TrainingDepositMessages = {
  invalid: 'Enter a positive amount',
  tooLarge: `Amount must be at most ${TRAINING_DEPOSIT_MAX.toLocaleString()}`,
} as const;

export function validateTrainingDepositAmount(raw: string): string | undefined {
  const t = raw.trim();
  if (!t) return TrainingDepositMessages.invalid;
  const n = parseFloat(t);
  if (Number.isNaN(n) || n <= 0) return TrainingDepositMessages.invalid;
  if (n > TRAINING_DEPOSIT_MAX) return TrainingDepositMessages.tooLarge;
  return undefined;
}
