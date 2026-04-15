/**
 * Dashboard quick deposit — same amount rules as `/deposit-cash` (fiat) and `/deposit-crypto` (crypto).
 */

import { validateDepositAmount } from '@/lib/depositCashValidation';
import { validateDepositCryptoAmount } from '@/lib/depositCryptoValidation';

const FIAT_ASSETS = new Set(['USD', 'EUR']);
const CRYPTO_ASSETS = new Set(['BTC', 'ETH']);

export function validateDashboardDepositAmount(asset: string, raw: string): string | undefined {
  if (FIAT_ASSETS.has(asset)) {
    return validateDepositAmount(raw);
  }
  if (CRYPTO_ASSETS.has(asset)) {
    return validateDepositCryptoAmount(raw);
  }
  return 'Unsupported asset';
}
