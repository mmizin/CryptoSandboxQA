'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/useAuth';
import { portfolioApi, transactionsApi, walletsApi, type BalanceTransactionItem } from '@/lib/api';
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

const inputDisabled =
  'opacity-50 cursor-not-allowed pointer-events-none group-data-[theme=light]:opacity-60';

const submitPrimary =
  'w-full py-3.5 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600 text-white font-medium hover:from-emerald-600 hover:to-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:ring-offset-2 focus:ring-offset-slate-900 transition-all duration-200 disabled:opacity-60 disabled:cursor-not-allowed group-data-[theme=light]:focus:ring-offset-white';

const linkStyle =
  'font-medium text-emerald-400 hover:text-emerald-300 transition-colors group-data-[theme=light]:text-emerald-600 group-data-[theme=light]:hover:text-emerald-700';

function formatBalance(s: string): string {
  const n = parseFloat(s);
  if (!Number.isFinite(n)) return s;
  return n.toLocaleString('en-US', { maximumFractionDigits: 8 });
}

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function shortId(id: string): string {
  if (id.length <= 12) return id;
  return `${id.slice(0, 8)}…${id.slice(-4)}`;
}

function withdrawalDisplayAmount(amountStr: string): string {
  const n = parseFloat(amountStr);
  if (!Number.isFinite(n)) return amountStr;
  return Math.abs(n).toLocaleString('en-US', { maximumFractionDigits: 8 });
}

function buildWithdrawalsCsv(rows: BalanceTransactionItem[]): string {
  const header = [
    'Time',
    'Reference no.',
    'Address',
    'Transaction ID',
    'Crypto',
    'Amount',
    'Fee',
    'Status',
  ];
  const lines = rows.map((r) => {
    const t = formatDateTime(r.createdAt);
    const amt = withdrawalDisplayAmount(r.amount);
    return [
      `"${t.replace(/"/g, '""')}"`,
      `"${r.id.replace(/"/g, '""')}"`,
      '"Training sandbox (no outbound address)"',
      `"${(r.refId ?? '—').toString().replace(/"/g, '""')}"`,
      `"${r.asset.replace(/"/g, '""')}"`,
      amt,
      '0',
      '"Completed"',
    ].join(',');
  });
  return [header.join(','), ...lines].join('\n');
}

export default function AssetsWithdrawPage() {
  const { user, loading: authLoading } = useAuth(true);
  const [asset, setAsset] = useState<WithdrawAsset | ''>('');
  const [destination, setDestination] = useState('');
  const [amount, setAmount] = useState('');
  const [amountError, setAmountError] = useState('');
  const [balances, setBalances] = useState<
    Array<{ asset: string; available: string; locked: string; total: string }>
  >([]);
  const [balancesLoading, setBalancesLoading] = useState(true);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [submitMessage, setSubmitMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(
    null,
  );
  const [withdrawals, setWithdrawals] = useState<BalanceTransactionItem[]>([]);
  const [withdrawalsLoading, setWithdrawalsLoading] = useState(true);
  const [copyFlashId, setCopyFlashId] = useState<string | null>(null);

  const loadWithdrawals = useCallback(() => {
    setWithdrawalsLoading(true);
    transactionsApi
      .getWithdrawals({ limit: 50, offset: 0 })
      .then((res) => setWithdrawals(res.data ?? []))
      .catch(console.error)
      .finally(() => setWithdrawalsLoading(false));
  }, []);

  useEffect(() => {
    if (!user) return;
    setBalancesLoading(true);
    portfolioApi
      .getBalances()
      .then((res) => setBalances(res.balances ?? []))
      .catch(console.error)
      .finally(() => setBalancesLoading(false));
  }, [user]);

  useEffect(() => {
    if (!user) return;
    loadWithdrawals();
  }, [user, loadWithdrawals]);

  const availableForAsset = useMemo(() => {
    if (!asset) return null;
    const row = balances.find((b) => b.asset === asset);
    return row?.available ?? null;
  }, [balances, asset]);

  const hasAsset = asset !== '';
  const hasDestination = destination.trim().length > 0;
  /** Which step is active for emphasis (1–3). Later steps stay disabled until prior steps are satisfied. */
  const activeStep = !hasAsset ? 1 : !hasDestination ? 2 : 3;

  const copyToClipboard = async (text: string, rowKey: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopyFlashId(rowKey);
      window.setTimeout(() => setCopyFlashId((k) => (k === rowKey ? null : k)), 1500);
    } catch {
      /* ignore */
    }
  };

  const exportCsv = () => {
    if (withdrawals.length === 0) return;
    const blob = new Blob([buildWithdrawalsCsv(withdrawals)], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `withdrawals-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!asset) return;
    const err = validateWithdrawAmount(amount);
    if (err) {
      setAmountError(err);
      return;
    }
    if (!destination.trim()) {
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
      loadWithdrawals();
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
        <div className="max-w-5xl mx-auto flex items-center justify-center py-24">
          <span className="text-slate-500 animate-pulse">Loading...</span>
        </div>
      </main>
    );
  }
  if (!user) return null;

  const stepClass = (stepNum: number, completed: boolean, locked: boolean) => {
    const active = activeStep === stepNum && !locked;
    const circle =
      active || completed
        ? 'bg-slate-900 text-white border-slate-900 group-data-[theme=light]:bg-slate-900 group-data-[theme=light]:text-white'
        : 'bg-slate-700/40 text-slate-500 border-slate-600 group-data-[theme=light]:bg-slate-200 group-data-[theme=light]:text-slate-500';
    const label =
      active || completed
        ? 'text-slate-200 group-data-[theme=light]:text-slate-900'
        : 'text-slate-500 group-data-[theme=light]:text-slate-500';
    return { circle, label };
  };

  return (
    <main className="min-h-screen transition-colors duration-200 px-4 py-6 sm:px-6 sm:py-8">
      <div className="max-w-5xl mx-auto">
        <div className="mb-6">
          <Link
            href="/assets"
            className="text-slate-400 hover:text-white group-data-[theme=light]:hover:text-slate-900 transition-colors text-sm"
          >
            ← Back to My assets
          </Link>
        </div>

        <h1 className="text-2xl font-bold text-white group-data-[theme=light]:text-slate-900 mb-2">
          Withdrawal
        </h1>
        <p className="text-slate-400 group-data-[theme=light]:text-slate-600 mb-8 max-w-2xl">
          Withdraw from your wallet balance. Training sandbox — no real outbound transfers. Complete each step in
          order; the next step unlocks when the previous one is valid.
        </p>

        <div className="grid gap-8 lg:grid-cols-[1fr_minmax(260px,320px)] lg:items-start">
          <section className={cardClass}>
            <form onSubmit={handleSubmit} className="space-y-8">
              <div className="relative pl-10 space-y-8">
                <div className="absolute left-[15px] top-8 bottom-8 w-px bg-slate-700 group-data-[theme=light]:bg-slate-200" aria-hidden />

                {/* Step 1 */}
                <div className="relative">
                  <div className="absolute -left-10 top-0 flex h-8 w-8 items-center justify-center rounded-full border-2 text-sm font-semibold transition-colors z-[1] bg-[var(--page-bg,transparent)] group-data-[theme=light]:bg-white/80">
                    <span
                      className={`flex h-8 w-8 items-center justify-center rounded-full border-2 text-sm ${stepClass(1, hasAsset, false).circle}`}
                    >
                      1
                    </span>
                  </div>
                  <h2 className={`text-sm font-semibold mb-3 ${stepClass(1, hasAsset, false).label}`}>
                    Select crypto
                  </h2>
                  <label htmlFor="withdraw-asset" className="sr-only">
                    Select crypto
                  </label>
                  <select
                    id="withdraw-asset"
                    value={asset}
                    onChange={(e) => {
                      const v = e.target.value as WithdrawAsset | '';
                      setAsset(v);
                      setAmountError('');
                      setSubmitMessage(null);
                    }}
                    className={inputBase}
                    disabled={submitLoading}
                  >
                    <option value="">Select crypto</option>
                    {WITHDRAW_ASSET_OPTIONS.map((a) => (
                      <option key={a} value={a}>
                        {a}
                      </option>
                    ))}
                  </select>
                  {!balancesLoading && hasAsset && availableForAsset !== null && (
                    <p className="mt-2 text-sm text-slate-400 group-data-[theme=light]:text-slate-600">
                      Available:{' '}
                      <span className="font-mono text-slate-300 group-data-[theme=light]:text-slate-800">
                        {formatBalance(availableForAsset)} {asset}
                      </span>
                    </p>
                  )}
                </div>

                {/* Step 2 */}
                <div className={`relative ${!hasAsset ? inputDisabled : ''}`}>
                  <div className="absolute -left-10 top-0 flex h-8 w-8 items-center justify-center z-[1] bg-[var(--page-bg,transparent)] group-data-[theme=light]:bg-white/80">
                    <span
                      className={`flex h-8 w-8 items-center justify-center rounded-full border-2 text-sm ${stepClass(2, hasDestination, !hasAsset).circle}`}
                    >
                      2
                    </span>
                  </div>
                  <h2 className={`text-sm font-semibold mb-3 ${stepClass(2, hasDestination, !hasAsset).label}`}>
                    Set destination
                  </h2>
                  <p className="text-xs text-slate-500 group-data-[theme=light]:text-slate-500 mb-2">
                    Simulated destination for QA (not sent on-chain).
                  </p>
                  <label htmlFor="withdraw-destination" className="sr-only">
                    Destination address or label
                  </label>
                  <input
                    id="withdraw-destination"
                    type="text"
                    autoComplete="off"
                    value={destination}
                    onChange={(e) => {
                      setDestination(e.target.value);
                      setSubmitMessage(null);
                    }}
                    disabled={submitLoading || !hasAsset}
                    placeholder="Enter a label or simulated address"
                    className={inputBase}
                  />
                </div>

                {/* Step 3 */}
                <div className={`relative ${!hasAsset || !hasDestination ? inputDisabled : ''}`}>
                  <div className="absolute -left-10 top-0 flex h-8 w-8 items-center justify-center z-[1] bg-[var(--page-bg,transparent)] group-data-[theme=light]:bg-white/80">
                    <span
                      className={`flex h-8 w-8 items-center justify-center rounded-full border-2 text-sm ${stepClass(3, false, !hasAsset || !hasDestination).circle}`}
                    >
                      3
                    </span>
                  </div>
                  <h2 className={`text-sm font-semibold mb-3 ${stepClass(3, false, !hasAsset || !hasDestination).label}`}>
                    Set withdrawal amount
                  </h2>
                  <label htmlFor="withdraw-amount" className="sr-only">
                    Withdrawal amount
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
                    disabled={submitLoading || !hasAsset || !hasDestination}
                    placeholder="0"
                  />
                  {amountError && <p className="mt-1 text-sm text-red-400">{amountError}</p>}
                </div>
              </div>

              <SubmitLoadingBar active={submitLoading} label="Processing withdrawal…" />

              <button
                type="submit"
                disabled={submitLoading || !hasAsset || !hasDestination}
                className={submitPrimary}
              >
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

          <aside
            className="rounded-xl border border-slate-700/80 bg-slate-900/30 p-5 group-data-[theme=light]:border-slate-200 group-data-[theme=light]:bg-slate-50/80"
            aria-labelledby="withdraw-faq-heading"
          >
            <h2
              id="withdraw-faq-heading"
              className="text-lg font-semibold text-white group-data-[theme=light]:text-slate-900 mb-4"
            >
              FAQ
            </h2>
            <ul className="space-y-4 text-sm text-slate-400 group-data-[theme=light]:text-slate-600">
              <li>
                <p className="font-medium text-slate-300 group-data-[theme=light]:text-slate-800">
                  How do I make a withdrawal?
                </p>
                <p className="mt-1">
                  Choose an asset, enter a simulated destination, then the amount within your available balance and
                  submit.
                </p>
              </li>
              <li>
                <p className="font-medium text-slate-300 group-data-[theme=light]:text-slate-800">
                  Why is there no real transaction ID?
                </p>
                <p className="mt-1">This environment does not broadcast to public networks; ledger rows are for training only.</p>
              </li>
              <li>
                <p className="font-medium text-slate-300 group-data-[theme=light]:text-slate-800">
                  Are there withdrawal fees?
                </p>
                <p className="mt-1">Fees are not simulated on the ledger for this sandbox; amounts shown are the debit from your balance.</p>
              </li>
            </ul>
          </aside>
        </div>

        <section id="all-withdrawals" className={`mt-12 ${cardClass}`}>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-6">
            <h2 className="text-lg font-semibold text-white group-data-[theme=light]:text-slate-900">
              All withdrawals
            </h2>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={exportCsv}
                disabled={withdrawals.length === 0 || withdrawalsLoading}
                className="rounded-lg px-4 py-2 text-sm font-medium transition-colors border border-slate-600 bg-slate-800/80 text-slate-200 hover:bg-slate-700 disabled:opacity-50 group-data-[theme=light]:border-slate-300 group-data-[theme=light]:bg-white group-data-[theme=light]:text-slate-800 group-data-[theme=light]:hover:bg-slate-100"
              >
                Export
              </button>
              <button
                type="button"
                onClick={() => document.getElementById('all-withdrawals')?.scrollIntoView({ behavior: 'smooth' })}
                className="rounded-lg px-4 py-2 text-sm font-medium transition-colors border border-slate-600 bg-slate-800/80 text-slate-200 hover:bg-slate-700 group-data-[theme=light]:border-slate-300 group-data-[theme=light]:bg-white group-data-[theme=light]:text-slate-800 group-data-[theme=light]:hover:bg-slate-100"
              >
                View history
              </button>
            </div>
          </div>

          <div className="overflow-x-auto -mx-6 px-6 sm:mx-0 sm:px-0">
            <table className="w-full text-left text-sm text-slate-300 group-data-[theme=light]:text-slate-800 min-w-[720px]">
              <thead>
                <tr className="border-b border-slate-700 group-data-[theme=light]:border-slate-200 text-slate-400 group-data-[theme=light]:text-slate-600">
                  <th className="pb-3 pr-4 font-medium whitespace-nowrap">Time</th>
                  <th className="pb-3 pr-4 font-medium whitespace-nowrap">Reference no.</th>
                  <th className="pb-3 pr-4 font-medium whitespace-nowrap">Address</th>
                  <th className="pb-3 pr-4 font-medium whitespace-nowrap">Transaction ID</th>
                  <th className="pb-3 pr-4 font-medium whitespace-nowrap">Crypto</th>
                  <th className="pb-3 pr-4 font-medium whitespace-nowrap">Amount</th>
                  <th className="pb-3 pr-4 font-medium whitespace-nowrap">Fee</th>
                  <th className="pb-3 font-medium whitespace-nowrap">Status</th>
                </tr>
              </thead>
              <tbody>
                {withdrawalsLoading ? (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-slate-500">
                      Loading…
                    </td>
                  </tr>
                ) : withdrawals.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-slate-500">
                      No withdrawals yet.
                    </td>
                  </tr>
                ) : (
                  withdrawals.map((row) => {
                    const refKey = `ref-${row.id}`;
                    const txKey = `tx-${row.id}`;
                    return (
                      <tr
                        key={row.id}
                        className="border-b border-slate-800/80 group-data-[theme=light]:border-slate-100"
                      >
                        <td className="py-3 pr-4 align-top whitespace-nowrap">{formatDateTime(row.createdAt)}</td>
                        <td className="py-3 pr-4 align-top font-mono text-xs">
                          <span className="inline-flex items-center gap-1">
                            {shortId(row.id)}
                            <button
                              type="button"
                              className={`${linkStyle} p-0.5 text-xs`}
                              onClick={() => copyToClipboard(row.id, refKey)}
                              aria-label="Copy reference number"
                            >
                              {copyFlashId === refKey ? '✓' : '⎘'}
                            </button>
                          </span>
                        </td>
                        <td className="py-3 pr-4 align-top max-w-[180px]">
                          <span className="text-slate-400 group-data-[theme=light]:text-slate-600">Training sandbox</span>
                          <span className="mt-1 block text-xs text-slate-500">Simulated</span>
                        </td>
                        <td className="py-3 pr-4 align-top font-mono text-xs text-slate-400 group-data-[theme=light]:text-slate-600">
                          {row.refId ? (
                            <span className="inline-flex items-center gap-1">
                              {shortId(row.refId)}
                              <button
                                type="button"
                                className={`${linkStyle} p-0.5 text-xs`}
                                onClick={() => void copyToClipboard(row.refId!, txKey)}
                                aria-label="Copy transaction id"
                              >
                                {copyFlashId === txKey ? '✓' : '⎘'}
                              </button>
                            </span>
                          ) : (
                            '—'
                          )}
                        </td>
                        <td className="py-3 pr-4 align-top">{row.asset}</td>
                        <td className="py-3 pr-4 align-top font-mono">{withdrawalDisplayAmount(row.amount)}</td>
                        <td className="py-3 pr-4 align-top">0</td>
                        <td className="py-3 align-top text-emerald-400 group-data-[theme=light]:text-emerald-600">
                          Completed
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </main>
  );
}
