'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/useAuth';
import { cryptosApi, portfolioApi } from '@/lib/api';

const LOGO_BASE = 'https://assets.coincap.io/assets/icons';

function CryptoLogo({ symbol }: { symbol: string }) {
  const sym = symbol.toLowerCase();
  const src = `${LOGO_BASE}/${sym}@2x.png`;
  const [imgError, setImgError] = useState(false);

  if (imgError) {
    return (
      <div className="w-10 h-10 rounded-full bg-slate-700 flex items-center justify-center text-xs font-semibold text-slate-400 shrink-0 group-data-[theme=light]:bg-slate-200 group-data-[theme=light]:text-slate-600">
        {symbol.slice(0, 2)}
      </div>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt=""
      width={40}
      height={40}
      className="w-10 h-10 rounded-full object-contain shrink-0"
      onError={() => setImgError(true)}
    />
  );
}

const cardClass =
  'rounded-2xl border border-slate-700/60 bg-slate-900/50 p-6 shadow-sm transition-colors group-data-[theme=light]:border-slate-200/90 group-data-[theme=light]:bg-white group-data-[theme=light]:shadow-md';

/** Matches Buy (active) and Sell (inactive) tab styles in components/BuySellForm.tsx */
const buySellTabBase =
  'inline-flex items-center justify-center rounded-lg px-4 py-2 text-sm font-medium transition-colors border-0 outline-none focus:outline-none';
const buyTabActive =
  'bg-emerald-500/40 text-emerald-200 ring-2 ring-emerald-400/50 shadow-sm shadow-emerald-500/20 group-data-[theme=light]:bg-emerald-200 group-data-[theme=light]:text-emerald-950 group-data-[theme=light]:ring-emerald-500/40';
const sellTabInactive =
  'bg-red-500/10 text-red-400 hover:bg-red-500/20 hover:text-red-300 group-data-[theme=light]:bg-red-50 group-data-[theme=light]:text-red-700 group-data-[theme=light]:hover:bg-red-100 group-data-[theme=light]:hover:text-red-800';

const inputSearch =
  'w-full pl-10 pr-4 py-2.5 rounded-full bg-[var(--input-bg)] border text-[var(--text)] placeholder-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500/40 transition-colors border-[var(--border)] text-sm';

function formatUsd(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function formatAmount(s: string): string {
  const n = parseFloat(s);
  if (!Number.isFinite(n)) return s;
  return n.toLocaleString('en-US', { maximumFractionDigits: 8 });
}

async function fetchCryptosNameMap(): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  let offset = 0;
  const limit = 100;
  for (let i = 0; i < 20; i += 1) {
    const { data, total } = await cryptosApi.list({ limit, offset, sortBy: 'symbol', sortOrder: 'asc' });
    for (const c of data) {
      map.set(c.symbol, c.name);
    }
    offset += data.length;
    if (offset >= total || data.length === 0) break;
  }
  return map;
}

type SummaryAsset = {
  symbol: string;
  amount: string;
  priceUsd: string;
  valueUsd: string;
};

export default function AssetsOverviewPage() {
  const { user, loading: authLoading } = useAuth(true);
  const [summary, setSummary] = useState<{
    totalValueUsd: string;
    assets: SummaryAsset[];
  } | null>(null);
  const [cryptoNames, setCryptoNames] = useState<Map<string, string>>(new Map());
  const [loadError, setLoadError] = useState<string | null>(null);
  const [dataLoading, setDataLoading] = useState(false);
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    setLoadError(null);
    setDataLoading(true);
    Promise.all([portfolioApi.getSummary(), fetchCryptosNameMap()])
      .then(([s, names]) => {
        if (!cancelled) {
          setSummary(s);
          setCryptoNames(names);
        }
      })
      .catch((e) => {
        if (!cancelled) {
          setLoadError(e instanceof Error ? e.message : 'Failed to load assets');
        }
      })
      .finally(() => {
        if (!cancelled) setDataLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [user]);

  const filteredAssets = useMemo(() => {
    const assets = summary?.assets ?? [];
    const q = search.trim().toLowerCase();
    if (!q) return assets;
    return assets.filter((a) => {
      const name = cryptoNames.get(a.symbol) ?? '';
      return (
        a.symbol.toLowerCase().includes(q) ||
        name.toLowerCase().includes(q)
      );
    });
  }, [summary?.assets, search, cryptoNames]);

  if (authLoading) {
    return (
      <main className="min-h-screen transition-colors duration-200 px-4 py-8 sm:px-6 lg:px-8 bg-slate-950/80 group-data-[theme=light]:bg-slate-100">
        <div className="max-w-6xl mx-auto flex items-center justify-center py-24">
          <span className="text-slate-500 animate-pulse">Loading...</span>
        </div>
      </main>
    );
  }
  if (!user) return null;

  const totalValue = summary ? parseFloat(summary.totalValueUsd) : 0;

  if (dataLoading) {
    return (
      <main className="min-h-screen transition-colors duration-200 px-4 py-8 sm:px-6 lg:px-8 bg-slate-950/80 group-data-[theme=light]:bg-slate-100">
        <div className="max-w-6xl mx-auto flex items-center justify-center py-24">
          <span className="text-slate-500 animate-pulse">Loading...</span>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen transition-colors duration-200 px-4 py-8 sm:px-6 lg:px-8 bg-slate-950/80 group-data-[theme=light]:bg-slate-100">
      <div className="max-w-6xl mx-auto">
        {summary && (
          <section className={`${cardClass} mb-8`}>
            <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
              <div className="min-w-0">
                <p className="text-sm text-slate-400 group-data-[theme=light]:text-slate-500">
                  Estimated total value
                </p>
                <div className="mt-1 flex flex-wrap items-baseline gap-2">
                  <span className="text-3xl font-bold tracking-tight text-white tabular-nums group-data-[theme=light]:text-slate-900 sm:text-4xl">
                    {formatUsd(totalValue)}
                  </span>
                  <span className="text-sm font-medium text-slate-400 group-data-[theme=light]:text-slate-500">
                    USD
                  </span>
                </div>
              </div>
              <div className="flex flex-wrap gap-2 shrink-0">
                <Link href="/assets/deposit" className={`${buySellTabBase} ${buyTabActive}`}>
                  Deposit
                </Link>
                <Link href="/assets/withdraw" className={`${buySellTabBase} ${sellTabInactive}`}>
                  Withdraw
                </Link>
              </div>
            </div>
          </section>
        )}

        <h2 className="text-xl font-bold text-white tracking-tight group-data-[theme=light]:text-slate-900 mb-4">
          Portfolio
        </h2>

        <div className="mb-4">
          <label className="relative block">
            <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 group-data-[theme=light]:text-slate-500">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
            </span>
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search"
              className={inputSearch}
              autoComplete="off"
            />
          </label>
        </div>

        <section className={cardClass}>
          {loadError ? (
            <p className="text-sm text-red-400">{loadError}</p>
          ) : filteredAssets.length === 0 ? (
            <p className="text-slate-500 group-data-[theme=light]:text-slate-500">
              {summary && (summary.assets?.length ?? 0) === 0
                ? 'No holdings yet. Use Deposit to add funds.'
                : 'No assets match your search.'}
            </p>
          ) : (
            <div className="overflow-x-auto -mx-2 sm:mx-0">
              <table className="w-full text-sm min-w-[320px]">
                <thead>
                  <tr className="border-b border-slate-700/80 group-data-[theme=light]:border-slate-200">
                    <th className="text-left py-3 px-2 text-xs font-medium uppercase tracking-wide text-slate-400 group-data-[theme=light]:text-slate-500">
                      Name
                    </th>
                    <th className="text-right py-3 px-2 text-xs font-medium uppercase tracking-wide text-slate-400 group-data-[theme=light]:text-slate-500">
                      Amount
                    </th>
                    <th className="text-right py-3 px-2 text-xs font-medium uppercase tracking-wide text-slate-400 group-data-[theme=light]:text-slate-500">
                      Valuation
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredAssets.map((row) => {
                    const displayName = cryptoNames.get(row.symbol) ?? row.symbol;
                    return (
                      <tr
                        key={row.symbol}
                        className="border-b border-slate-800/60 group-data-[theme=light]:border-slate-100 last:border-0"
                      >
                        <td className="py-3 px-2">
                          <div className="flex items-center gap-3 min-w-0">
                            <CryptoLogo symbol={row.symbol} />
                            <div className="min-w-0">
                              <div className="font-semibold text-white group-data-[theme=light]:text-slate-900">
                                {row.symbol}
                              </div>
                              <div className="text-xs text-slate-400 truncate group-data-[theme=light]:text-slate-500">
                                {displayName}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="py-3 px-2 text-right font-mono text-slate-200 tabular-nums group-data-[theme=light]:text-slate-800">
                          {formatAmount(row.amount)}
                        </td>
                        <td className="py-3 px-2 text-right">
                          <span className="font-semibold text-white tabular-nums group-data-[theme=light]:text-slate-900">
                            {formatUsd(parseFloat(row.valueUsd))}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
