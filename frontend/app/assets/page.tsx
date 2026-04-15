'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/useAuth';
import { portfolioApi } from '@/lib/api';

const cardClass =
  'rounded-xl border border-slate-700/80 bg-slate-900/50 p-6 transition-colors group-data-[theme=light]:border-slate-200 group-data-[theme=light]:bg-white/80';

const buttonSecondary =
  'rounded-lg px-4 py-2 text-sm font-medium transition-colors border-0 outline-none focus:outline-none bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 hover:text-emerald-300 group-data-[theme=light]:bg-emerald-50 group-data-[theme=light]:text-emerald-700 group-data-[theme=light]:hover:bg-emerald-100 group-data-[theme=light]:hover:text-emerald-800';

function formatUsd(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function formatBalance(s: string): string {
  const n = parseFloat(s);
  if (!Number.isFinite(n)) return s;
  return n.toLocaleString('en-US', { maximumFractionDigits: 8 });
}

export default function AssetsOverviewPage() {
  const { user, loading: authLoading } = useAuth(true);
  const [balances, setBalances] = useState<
    Array<{ asset: string; available: string; locked: string; total: string }>
  >([]);
  const [summary, setSummary] = useState<{
    totalValueUsd: string;
  } | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    setLoadError(null);
    Promise.all([portfolioApi.getBalances(), portfolioApi.getSummary()])
      .then(([b, s]) => {
        if (!cancelled) {
          setBalances(b.balances ?? []);
          setSummary(s);
        }
      })
      .catch((e) => {
        if (!cancelled) {
          setLoadError(e instanceof Error ? e.message : 'Failed to load assets');
        }
      });
    return () => {
      cancelled = true;
    };
  }, [user]);

  if (authLoading) {
    return (
      <main className="min-h-screen transition-colors duration-200 px-4 py-8 sm:px-6 lg:px-8">
        <div className="max-w-5xl mx-auto flex items-center justify-center py-24">
          <span className="text-slate-500 animate-pulse">Loading...</span>
        </div>
      </main>
    );
  }
  if (!user) return null;

  const totalValue = summary ? parseFloat(summary.totalValueUsd) : 0;

  return (
    <main className="min-h-screen transition-colors duration-200 px-4 py-8 sm:px-6 lg:px-8">
      <div className="max-w-5xl mx-auto">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-white tracking-tight group-data-[theme=light]:text-slate-900">
              My assets
            </h1>
            <p className="text-slate-400 mt-1 group-data-[theme=light]:text-slate-600">
              Overview of your funding balances — available and in open orders
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/assets/deposit" className={buttonSecondary}>
              Deposit
            </Link>
            <Link href="/assets/withdraw" className={buttonSecondary}>
              Withdraw
            </Link>
          </div>
        </div>

        {summary && (
          <section className={`${cardClass} mb-6`}>
            <span className="text-sm text-slate-400 group-data-[theme=light]:text-slate-600">
              Total value (est.)
            </span>
            <p className="text-2xl font-semibold text-emerald-400 mt-1 group-data-[theme=light]:text-emerald-600">
              {formatUsd(totalValue)}
            </p>
          </section>
        )}

        <section className={cardClass}>
          <h2 className="text-lg font-semibold text-white mb-4 group-data-[theme=light]:text-slate-900">
            Balances
          </h2>
          {loadError && <p className="text-sm text-red-400 mb-4">{loadError}</p>}
          {balances.length === 0 && !loadError ? (
            <p className="text-slate-500 group-data-[theme=light]:text-slate-500">
              No balances yet. Use Deposit to add funds.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-700/80 group-data-[theme=light]:border-slate-200">
                    <th className="text-left py-3 px-2 text-slate-400 group-data-[theme=light]:text-slate-600 font-medium">
                      Asset
                    </th>
                    <th className="text-right py-3 px-2 text-slate-400 group-data-[theme=light]:text-slate-600 font-medium">
                      Available
                    </th>
                    <th className="text-right py-3 px-2 text-slate-400 group-data-[theme=light]:text-slate-600 font-medium">
                      In orders
                    </th>
                    <th className="text-right py-3 px-2 text-slate-400 group-data-[theme=light]:text-slate-600 font-medium">
                      Total
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {balances.map((row) => (
                    <tr
                      key={row.asset}
                      className="border-b border-slate-800/80 group-data-[theme=light]:border-slate-100"
                    >
                      <td className="py-3 px-2 font-medium text-white group-data-[theme=light]:text-slate-900">
                        {row.asset}
                      </td>
                      <td className="py-3 px-2 text-right font-mono text-slate-300 group-data-[theme=light]:text-slate-700">
                        {formatBalance(row.available)}
                      </td>
                      <td className="py-3 px-2 text-right font-mono text-slate-300 group-data-[theme=light]:text-slate-700">
                        {formatBalance(row.locked)}
                      </td>
                      <td className="py-3 px-2 text-right font-mono text-slate-300 group-data-[theme=light]:text-slate-700">
                        {formatBalance(row.total)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
