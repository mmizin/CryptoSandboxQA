'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/useAuth';
import { portfolioApi, walletsApi } from '@/lib/api';
import {
  validateWithdrawAmount,
  WITHDRAW_ASSET_OPTIONS,
  type WithdrawAsset,
} from '@/lib/withdrawValidation';
import { awaitMinElapsedSince } from '@/lib/submitLoadingMinDuration';
import { SubmitLoadingBar } from '@/components/SubmitLoadingBar';

const cardClass =
  'rounded-xl border border-slate-700/80 bg-slate-900/50 p-6 transition-colors group-data-[theme=light]:border-slate-200 group-data-[theme=light]:bg-white/80';

const inputBase =
  'w-full px-4 py-3 rounded-xl bg-[var(--input-bg)] border border-[var(--border)] text-[var(--text)] placeholder-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50 transition-colors group-data-[theme=light]:bg-white group-data-[theme=light]:text-slate-900';

const submitPrimary =
  'w-full py-3.5 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600 text-white font-medium hover:from-emerald-600 hover:to-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:ring-offset-2 focus:ring-offset-slate-900 transition-all duration-200 disabled:opacity-60 disabled:cursor-not-allowed group-data-[theme=light]:focus:ring-offset-white';

function formatBalance(s: string): string {
  const n = parseFloat(s);
  if (!Number.isFinite(n)) return s;
  return n.toLocaleString('en-US', { maximumFractionDigits: 8 });
}

export default function AssetsWithdrawPage() {
  const { user, loading: authLoading } = useAuth(true);
  const [asset, setAsset] = useState<WithdrawAsset>('USD');
  const [amount, setAmount] = useState('');
  const [amountError, setAmountError] = useState('');
  const [balances, setBalances] = useState<
    Array<{ asset: string; available: string; locked: string; total: string }>
  >([]);
  const [balancesLoading, setBalancesLoading] = useState(true);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [submitMessage, setSubmitMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(
    null
  );

  useEffect(() => {
    if (!user) return;
    setBalancesLoading(true);
    portfolioApi
      .getBalances()
      .then((res) => setBalances(res.balances ?? []))
      .catch(console.error)
      .finally(() => setBalancesLoading(false));
  }, [user]);

  const availableForAsset = useMemo(() => {
    const row = balances.find((b) => b.asset === asset);
    return row?.available ?? null;
  }, [balances, asset]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const err = validateWithdrawAmount(amount);
    if (err) {
      setAmountError(err);
      return;
    }
    setAmountError('');
    setSubmitLoading(true);
    const submitStartedAt = Date.now();
    setSubmitMessage(null);
    const amt = parseFloat(amount.trim());
    try {
      await walletsApi.withdraw(asset, amt);
      setSubmitMessage({
        type: 'success',
        text: `Withdrawal submitted: ${amt} ${asset}. Your balance will update shortly.`,
      });
      setAmount('');
      const res = await portfolioApi.getBalances();
      setBalances(res.balances ?? []);
    } catch (err) {
      setSubmitMessage({
        type: 'error',
        text: err instanceof Error ? err.message : 'Withdrawal failed',
      });
    } finally {
      await awaitMinElapsedSince(submitStartedAt);
      setSubmitLoading(false);
    }
  };

  if (authLoading) {
    return (
      <main className="min-h-screen transition-colors duration-200 px-4 py-6 sm:px-6 sm:py-8">
        <div className="max-w-lg mx-auto flex items-center justify-center py-24">
          <span className="text-slate-500 animate-pulse">Loading...</span>
        </div>
      </main>
    );
  }
  if (!user) return null;

  return (
    <main className="min-h-screen transition-colors duration-200 px-4 py-6 sm:px-6 sm:py-8">
      <div className="max-w-lg mx-auto">
        <div className="mb-6">
          <Link
            href="/assets"
            className="text-slate-400 hover:text-white group-data-[theme=light]:hover:text-slate-900 transition-colors text-sm"
          >
            ← Back to My assets
          </Link>
        </div>

        <h1 className="text-2xl font-bold text-white group-data-[theme=light]:text-slate-900 mb-2">
          Withdraw
        </h1>
        <p className="text-slate-400 group-data-[theme=light]:text-slate-600 mb-6">
          Withdraw from your wallet balance. Training sandbox — no real outbound transfers.
        </p>

        <section className={cardClass}>
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label
                htmlFor="withdraw-asset"
                className="block text-sm font-medium text-slate-300 mb-2 group-data-[theme=light]:text-slate-700"
              >
                Asset
              </label>
              <select
                id="withdraw-asset"
                value={asset}
                onChange={(e) => setAsset(e.target.value as WithdrawAsset)}
                className={inputBase}
                disabled={submitLoading}
              >
                {WITHDRAW_ASSET_OPTIONS.map((a) => (
                  <option key={a} value={a}>
                    {a}
                  </option>
                ))}
              </select>
              {!balancesLoading && availableForAsset !== null && (
                <p className="mt-2 text-sm text-slate-400 group-data-[theme=light]:text-slate-600">
                  Available:{' '}
                  <span className="font-mono text-slate-300 group-data-[theme=light]:text-slate-800">
                    {formatBalance(availableForAsset)} {asset}
                  </span>
                </p>
              )}
            </div>

            <div>
              <label
                htmlFor="withdraw-amount"
                className="block text-sm font-medium text-slate-300 mb-2 group-data-[theme=light]:text-slate-700"
              >
                Amount
              </label>
              <input
                id="withdraw-amount"
                type="number"
                step="any"
                min="0"
                value={amount}
                onChange={(e) => {
                  setAmount(e.target.value);
                  setAmountError('');
                  setSubmitMessage(null);
                }}
                data-testid="withdraw-amount"
                aria-invalid={!!amountError}
                className={`${inputBase} ${amountError ? 'border-red-500 focus:ring-red-500/50 focus:border-red-500/50' : ''}`}
                disabled={submitLoading}
                placeholder="0"
              />
              {amountError && <p className="mt-1 text-sm text-red-400">{amountError}</p>}
            </div>

            <SubmitLoadingBar active={submitLoading} label="Processing withdrawal…" />

            <button type="submit" disabled={submitLoading} className={submitPrimary}>
              {submitLoading ? 'Processing…' : 'Withdraw'}
            </button>
          </form>

          {submitMessage && (
            <p
              className={`mt-4 text-sm ${submitMessage.type === 'success' ? 'text-emerald-400 group-data-[theme=light]:text-emerald-600' : 'text-red-400'}`}
              role="status"
            >
              {submitMessage.text}
            </p>
          )}
        </section>
      </div>
    </main>
  );
}
