/**
 * Shared limits aligned with frontend client validation (authFieldConstraints, etc.)
 * so API and UI reject the same out-of-range values where applicable.
 */
export const EMAIL_MAX_LENGTH = 254;

/** Max amount on `POST /wallets/deposit` ([`DepositDto`](../wallets/dto/deposit.dto.ts)); direct API use. */
export const WALLET_DEPOSIT_AMOUNT_MAX = 1_000_000_000;
