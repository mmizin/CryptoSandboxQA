'use client';

import { useState, useEffect, useCallback } from 'react';
import { useCryptos } from '@/lib/useCryptos';

const LOGO_BASE = 'https://assets.coincap.io/assets/icons';
const FALLBACK_ICON = 'https://assets.coincap.io/assets/icons/btc@2x.png';

function CryptoLogo({ symbol }: { symbol: string }) {
  const sym = symbol.toLowerCase();
  const src = `${LOGO_BASE}/${sym}@2x.png`;
  const [imgError, setImgError] = useState(false);

  if (imgError) {
    return (
      <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center text-sm font-semibold text-slate-400 shrink-0 group-data-[theme=light]:bg-slate-200 group-data-[theme=light]:text-slate-600">
        {symbol.slice(0, 2)}
      </div>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={symbol}
      width={32}
      height={32}
      className="w-8 h-8 rounded-full object-contain shrink-0"
      onError={() => setImgError(true)}
    />
  );
}

type SortField = 'name' | 'symbol' | 'price' | 'change24h' | 'volume24h';

interface MarketsCryptoTableProps {
  defaultLimit?: number;
  showPopularHighlight?: boolean;
  title?: string;
}

export function MarketsCryptoTable({
  defaultLimit = 10,
  showPopularHighlight = true,
  title,
}: MarketsCryptoTableProps) {
  const [limit, setLimit] = useState(defaultLimit);
  const [search, setSearch] = useState('');
  const [searchDebounced, setSearchDebounced] = useState('');
  const [sort, setSort] = useState<{ by: SortField; order: 'asc' | 'desc' }>({
    by: 'volume24h',
    order: 'desc',
  });
  useEffect(() => {
    const t = setTimeout(() => setSearchDebounced(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  const { data, total, loading, error, goNext, goPrev, canGoNext, canGoPrev } = useCryptos({
    limit,
    search: searchDebounced,
    sortBy: sort.by,
    sortOrder: sort.order,
  });

  const handleSort = useCallback((field: SortField) => {
    setSort((prev) => {
      if (prev.by === field) {
        return { by: field, order: prev.order === 'asc' ? 'desc' : 'asc' };
      }
      return { by: field, order: 'desc' };
    });
  }, []);

const sortButtonBase =
    'rounded-lg px-3 py-1.5 text-sm font-medium flex items-center gap-1 transition-colors border-0 outline-none focus:outline-none bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 hover:text-emerald-300 group-data-[theme=light]:bg-emerald-50 group-data-[theme=light]:text-emerald-700 group-data-[theme=light]:hover:bg-emerald-100 group-data-[theme=light]:hover:text-emerald-800';

  const SortHeader = ({
    field,
    label,
    align = 'left',
  }: {
    field: SortField;
    label: string;
    align?: 'left' | 'right';
  }) => {
    const active = sort.by === field;
    return (
      <button
        type="button"
        onClick={() => handleSort(field)}
        className={`${sortButtonBase} w-full min-w-0 ${align === 'right' ? 'justify-end' : 'justify-start'} ${active ? 'ring-1 ring-emerald-500/30' : ''}`}
      >
        {label}
        {active && (
          <span className="text-emerald-500 group-data-[theme=light]:text-emerald-600 shrink-0">
            {sort.order === 'asc' ? '↑' : '↓'}
          </span>
        )}
      </button>
    );
  };

  const formatPrice = (s: string) => {
    const n = parseFloat(s);
    if (n >= 1e6) return `$${(n / 1e6).toFixed(2)}M`;
    if (n >= 1e3) return `$${n.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
    if (n >= 1) return `$${n.toFixed(2)}`;
    if (n >= 0.0001) return `$${n.toFixed(4)}`;
    return `$${n.toExponential(2)}`;
  };

  const formatVol = (s: string) => {
    const n = parseFloat(s);
    if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
    if (n >= 1e6) return `$${(n / 1e6).toFixed(2)}M`;
    if (n >= 1e3) return `$${(n / 1e3).toFixed(2)}K`;
    return `$${n.toFixed(0)}`;
  };

  return (
    <div className="rounded-xl border border-slate-700/80 bg-slate-900/50 overflow-hidden group-data-[theme=light]:border-slate-200 group-data-[theme=light]:bg-white/80">
      <div className="p-4 border-b border-slate-700/80 group-data-[theme=light]:border-slate-200">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          {title && (
            <h2 className="text-lg font-semibold text-white group-data-[theme=light]:text-slate-900">
              {title}
            </h2>
          )}
          <div className="flex flex-wrap items-center gap-3">
            <input
              type="search"
              placeholder="Search by name or symbol..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="rounded-lg border border-slate-600 bg-slate-800/80 px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 group-data-[theme=light]:border-slate-300 group-data-[theme=light]:bg-white group-data-[theme=light]:text-slate-900"
            />
            <label className="flex items-center gap-2 text-sm text-slate-400 group-data-[theme=light]:text-slate-600">
              <span>Per load:</span>
              <select
                value={limit}
                onChange={(e) => setLimit(Number(e.target.value))}
                className="rounded-lg border border-slate-600 bg-slate-800/80 px-3 py-2 text-sm text-white focus:border-emerald-500 focus:outline-none group-data-[theme=light]:border-slate-300 group-data-[theme=light]:bg-white group-data-[theme=light]:text-slate-900"
              >
                <option value={10}>10</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
            </label>
            {data.length > 0 && (
              <span className="text-sm text-slate-500 group-data-[theme=light]:text-slate-500">
                Showing {data.length} of {total}
              </span>
            )}
          </div>
        </div>
      </div>

      {error && (
        <div className="p-4 text-red-400 text-sm">{error}</div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-700/80 group-data-[theme=light]:border-slate-200">
              <th className="text-left py-3 px-4">
                <SortHeader field="name" label="Coin" align="left" />
              </th>
              <th className="text-left py-3 px-4">
                <SortHeader field="symbol" label="Symbol" align="left" />
              </th>
              <th className="text-right py-3 px-4">
                <SortHeader field="price" label="Price" align="right" />
              </th>
              <th className="text-right py-3 px-4">
                <SortHeader field="change24h" label="24h %" align="right" />
              </th>
              <th className="text-right py-3 px-4">
                <SortHeader field="volume24h" label="24h Volume" align="right" />
              </th>
            </tr>
          </thead>
          <tbody>
            {data.map((c, i) => (
              <tr
                key={c.id}
                className={`border-b border-slate-800/80 transition-colors hover:bg-slate-800/60 group-data-[theme=light]:border-slate-100 group-data-[theme=light]:hover:bg-slate-50 ${
                  showPopularHighlight && c.popular ? 'bg-emerald-500/5 group-data-[theme=light]:bg-emerald-50/50' : ''
                } ${i % 2 === 1 ? 'bg-slate-800/20 group-data-[theme=light]:bg-slate-50/30' : ''}`}
              >
                <td className="py-3 px-4 text-left">
                  <div className="flex items-center gap-2">
                    <CryptoLogo symbol={c.symbol} />
                    <span className="font-medium text-white group-data-[theme=light]:text-slate-900">
                      {c.name}
                    </span>
                    {c.popular && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400">
                        Popular
                      </span>
                    )}
                  </div>
                </td>
                <td className="py-3 px-4 text-left text-slate-400 group-data-[theme=light]:text-slate-600">
                  {c.symbol}
                </td>
                <td className="py-3 px-4 text-right font-mono text-white group-data-[theme=light]:text-slate-900">
                  {formatPrice(c.price)}
                </td>
                <td className="py-3 px-4 text-right">
                  <span
                    className={`font-mono ${
                      parseFloat(c.change24h) >= 0 ? 'text-emerald-400' : 'text-red-400'
                    }`}
                  >
                    {parseFloat(c.change24h) >= 0 ? '+' : ''}
                    {parseFloat(c.change24h).toFixed(2)}%
                  </span>
                </td>
                <td className="py-3 px-4 text-right font-mono text-slate-400 group-data-[theme=light]:text-slate-600">
                  {formatVol(c.volume24h)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {loading && data.length === 0 && (
        <div className="p-4 text-center text-slate-500 animate-pulse">Loading...</div>
      )}
      {loading && data.length > 0 && (
        <div className="p-4 text-center text-slate-400 animate-pulse">Loading more...</div>
      )}

      {data.length > 0 && (canGoPrev || canGoNext) && !loading && (
        <div className="p-4 flex items-center justify-center gap-2 border-t border-slate-700/80 group-data-[theme=light]:border-slate-200">
          <button
            type="button"
            onClick={goPrev}
            disabled={!canGoPrev}
            className="rounded-lg px-4 py-2 text-sm font-medium flex items-center gap-1 transition-colors border-0 outline-none focus:outline-none bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 hover:text-emerald-300 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-emerald-500/10 disabled:hover:text-emerald-400 group-data-[theme=light]:bg-emerald-50 group-data-[theme=light]:text-emerald-700 group-data-[theme=light]:hover:bg-emerald-100 group-data-[theme=light]:hover:text-emerald-800 group-data-[theme=light]:disabled:hover:bg-emerald-50 group-data-[theme=light]:disabled:hover:text-emerald-700"
          >
            ← Previous
          </button>
          <button
            type="button"
            onClick={goNext}
            disabled={!canGoNext}
            className="rounded-lg px-4 py-2 text-sm font-medium flex items-center gap-1 transition-colors border-0 outline-none focus:outline-none bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 hover:text-emerald-300 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-emerald-500/10 disabled:hover:text-emerald-400 group-data-[theme=light]:bg-emerald-50 group-data-[theme=light]:text-emerald-700 group-data-[theme=light]:hover:bg-emerald-100 group-data-[theme=light]:hover:text-emerald-800 group-data-[theme=light]:disabled:hover:bg-emerald-50 group-data-[theme=light]:disabled:hover:text-emerald-700"
          >
            Next →
          </button>
        </div>
      )}
    </div>
  );
}
