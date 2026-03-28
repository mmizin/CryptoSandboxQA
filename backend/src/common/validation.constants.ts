/**
 * Shared limits aligned with frontend client validation (authFieldConstraints,
 * trainingDepositConstraints) so API and UI reject the same out-of-range values.
 */
export const EMAIL_MAX_LENGTH = 254;

/** Matches `TRAINING_DEPOSIT_MAX` in frontend/lib/trainingDepositConstraints.ts */
export const WALLET_DEPOSIT_AMOUNT_MAX = 1_000_000_000;
