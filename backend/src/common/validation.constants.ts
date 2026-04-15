/**
 * Shared limits aligned with frontend client validation (authFieldConstraints, etc.)
 * so API and UI reject the same out-of-range values where applicable.
 */
export const EMAIL_MAX_LENGTH = 254;

/** Max amount on `POST /wallets/withdraw` ([`WithdrawDto`](../wallets/dto/withdraw.dto.ts)). */
export const WALLET_WITHDRAW_AMOUNT_MAX = 1_000_000_000;
