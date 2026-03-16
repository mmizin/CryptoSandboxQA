'use client';

import { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import {
  validateDepositCryptoForm,
  type DepositCryptoFormState,
  type DepositCryptoFormErrors,
  DEPOSIT_CRYPTO_AMOUNT_MIN,
  DEPOSIT_CRYPTO_AMOUNT_MAX,
} from '@/lib/depositCryptoValidation';
import { getMockWalletAddress } from '@/lib/depositCryptoMockData';
import { CryptoSearchSelect } from '@/components/CryptoSearchSelect';

const inputBase =
  'w-full px-4 py-3 rounded-xl bg-[var(--input-bg)] border text-[var(--text)] placeholder-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50 transition-colors';
const inputError = 'border-red-500 focus:ring-red-500/50 focus:border-red-500/50';
const inputNormal = 'border-[var(--border)]';

const initialState: DepositCryptoFormState = {
  crypto: 'BTC',
  amount: '',
};

export function DepositCryptoForm() {
  const [state, setState] = useState<DepositCryptoFormState>(initialState);
  const [errors, setErrors] = useState<DepositCryptoFormErrors>({});
  const [touched, setTouched] = useState<Partial<Record<keyof DepositCryptoFormState, boolean>>>({});
  const [submitLoading, setSubmitLoading] = useState(false);
  const [submitMessage, setSubmitMessage] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);
  const [copySuccess, setCopySuccess] = useState(false);

  const walletAddress = state.crypto ? getMockWalletAddress(state.crypto) : null;
  const walletAddressError =
    state.crypto && !walletAddress
      ? 'Wallet address unavailable for this asset. (Mock error for QA)'
      : null;

  const { valid, errors: validatedErrors } = validateDepositCryptoForm(state);
  const displayErrors = Object.keys(errors).length > 0 ? errors : validatedErrors;
  const formValid =
    valid &&
    !!walletAddress &&
    !walletAddressError &&
    parseFloat(state.amount || '0') > 0;

  const updateField = (field: keyof DepositCryptoFormState, value: string) => {
    setState((s) => ({ ...s, [field]: value }));
    setErrors((e) => {
      const next = { ...e };
      delete next[field as keyof DepositCryptoFormErrors];
      return next;
    });
    setSubmitMessage(null);
    setCopySuccess(false);
  };

  const markTouched = (field: keyof DepositCryptoFormState) => {
    setTouched((t) => ({ ...t, [field]: true }));
  };

  const inputClass = (field: keyof DepositCryptoFormErrors) =>
    `${inputBase} ${displayErrors[field] ? inputError : inputNormal}`;

  const handleCopyAddress = async () => {
    if (!walletAddress) return;
    try {
      await navigator.clipboard.writeText(walletAddress);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    } catch {
      setSubmitMessage({
        type: 'error',
        text: 'Failed to copy address. Please copy manually.',
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const { valid: isValid, errors: errs } = validateDepositCryptoForm(state);
    const hasWallet = state.crypto && getMockWalletAddress(state.crypto);

    if (!isValid || !hasWallet) {
      setErrors({
        ...errs,
        ...(hasWallet ? {} : { walletAddress: walletAddressError || undefined }),
      });
      setTouched({ crypto: true, amount: true });
      return;
    }

    setErrors({});
    setSubmitLoading(true);
    setSubmitMessage(null);

    await new Promise((r) => setTimeout(r, 1500));

    setSubmitLoading(false);
    const amountNum = parseFloat(state.amount);

    // QA: amount 0.12345678 triggers mock error
    const simulateError = amountNum === 0.12345678;
    if (simulateError) {
      setSubmitMessage({
        type: 'error',
        text: 'Deposit failed. Network error. Please try again. (Mock error for QA)',
      });
      return;
    }

    setSubmitMessage({
      type: 'success',
      text: `Deposit simulated: ${amountNum.toFixed(8)} ${state.crypto} to your wallet. Backend integration coming soon.`,
    });
  };

  const handleReset = () => {
    setState(initialState);
    setErrors({});
    setTouched({});
    setSubmitMessage(null);
    setCopySuccess(false);
  };

  const amountNum = parseFloat(state.amount) || 0;

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/50 shadow-xl shadow-black/20 p-6 sm:p-8 transition-colors duration-200 group-data-[theme=light]:border-slate-200 group-data-[theme=light]:bg-white group-data-[theme=light]:shadow-slate-200/50">
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Crypto selection */}
        <div>
          <label
            htmlFor="crypto"
            className="block text-sm font-medium text-slate-300 mb-2 group-data-[theme=light]:text-slate-700"
          >
            Cryptocurrency
            <span
              className="ml-1 text-slate-500 cursor-help"
              title="Select the crypto to deposit"
            >
              ⓘ
            </span>
          </label>
          <CryptoSearchSelect
            value={state.crypto}
            onChange={(symbol, _price) => {
              updateField('crypto', symbol);
              markTouched('crypto');
            }}
            error={!!displayErrors.crypto}
          />
          {(touched.crypto || displayErrors.crypto) && displayErrors.crypto && (
            <p className="mt-1 text-sm text-red-400">{displayErrors.crypto}</p>
          )}
        </div>

        {/* Wallet address & QR */}
        {state.crypto && (
          <div className="space-y-4 p-4 rounded-xl bg-slate-800/50 group-data-[theme=light]:bg-slate-100/50 border border-slate-700/50 group-data-[theme=light]:border-slate-200">
            <h3 className="text-sm font-medium text-slate-300 group-data-[theme=light]:text-slate-700">
              Deposit address
            </h3>
            {walletAddressError ? (
              <p className="text-sm text-red-400">{walletAddressError}</p>
            ) : walletAddress ? (
              <>
                <div className="flex flex-col sm:flex-row gap-4 items-start">
                  <div className="flex-1 min-w-0">
                    <div className="px-4 py-3 rounded-xl bg-slate-900/50 group-data-[theme=light]:bg-slate-200/50 border border-slate-700 group-data-[theme=light]:border-slate-300 font-mono text-sm text-slate-300 group-data-[theme=light]:text-slate-700 break-all">
                      {walletAddress}
                    </div>
                    <button
                      type="button"
                      onClick={handleCopyAddress}
                      className="mt-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors border-0 outline-none focus:outline-none bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 hover:text-emerald-300 focus:ring-2 focus:ring-emerald-500/50 group-data-[theme=light]:bg-emerald-50 group-data-[theme=light]:text-emerald-700 group-data-[theme=light]:hover:bg-emerald-100 group-data-[theme=light]:hover:text-emerald-800"
                    >
                      {copySuccess ? 'Copied!' : 'Copy address'}
                    </button>
                  </div>
                  <div className="flex-shrink-0 p-3 rounded-xl bg-white">
                    <QRCodeSVG value={walletAddress} size={128} level="M" />
                  </div>
                </div>
              </>
            ) : null}
          </div>
        )}

        {/* Amount */}
        <div>
          <label
            htmlFor="amount"
            className="block text-sm font-medium text-slate-300 mb-2 group-data-[theme=light]:text-slate-700"
          >
            Amount to deposit
            <span
              className="ml-1 text-slate-500 cursor-help"
              title={`Between ${DEPOSIT_CRYPTO_AMOUNT_MIN} and ${DEPOSIT_CRYPTO_AMOUNT_MAX}`}
            >
              ⓘ
            </span>
          </label>
          <input
            id="amount"
            type="number"
            placeholder="e.g. 0.001"
            value={state.amount}
            onChange={(e) => updateField('amount', e.target.value)}
            onBlur={() => markTouched('amount')}
            min={DEPOSIT_CRYPTO_AMOUNT_MIN}
            max={DEPOSIT_CRYPTO_AMOUNT_MAX}
            step="any"
            className={inputClass('amount')}
          />
          {(touched.amount || displayErrors.amount) && displayErrors.amount && (
            <p className="mt-1 text-sm text-red-400">{displayErrors.amount}</p>
          )}
        </div>

        {/* Transaction summary */}
        {state.crypto && amountNum > 0 && !displayErrors.amount && !displayErrors.crypto && (
          <div className="rounded-xl border border-slate-700 group-data-[theme=light]:border-slate-200 p-4 space-y-2">
            <h3 className="text-sm font-medium text-slate-300 group-data-[theme=light]:text-slate-700">
              Summary
            </h3>
            <div className="flex justify-between text-sm">
              <span className="text-slate-400 group-data-[theme=light]:text-slate-600">Amount</span>
              <span>
                {amountNum.toFixed(8)} {state.crypto}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-slate-400 group-data-[theme=light]:text-slate-600">Asset</span>
              <span>{state.crypto}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-slate-400 group-data-[theme=light]:text-slate-600">Wallet</span>
              <span className="font-mono text-xs truncate max-w-[180px]">
                {walletAddress ? `${walletAddress.slice(0, 8)}...${walletAddress.slice(-8)}` : '—'}
              </span>
            </div>
          </div>
        )}

        {submitMessage && (
          <p
            className={`text-sm ${
              submitMessage.type === 'success' ? 'text-green-400' : 'text-red-400'
            }`}
          >
            {submitMessage.text}
          </p>
        )}

        <div className="flex gap-4">
          <button
            type="submit"
            disabled={!formValid || submitLoading}
            className="flex-1 py-3.5 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600 text-white font-medium hover:from-emerald-600 hover:to-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all duration-200 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {submitLoading ? 'Processing...' : 'Deposit'}
          </button>
          <button
            type="button"
            onClick={handleReset}
            className="rounded-lg px-4 py-2 text-sm font-medium transition-colors border-0 outline-none focus:outline-none bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 hover:text-emerald-300 group-data-[theme=light]:bg-emerald-50 group-data-[theme=light]:text-emerald-700 group-data-[theme=light]:hover:bg-emerald-100 group-data-[theme=light]:hover:text-emerald-800"
          >
            Reset
          </button>
        </div>
      </form>
    </div>
  );
}
