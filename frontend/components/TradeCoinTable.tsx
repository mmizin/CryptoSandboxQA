'use client';

import { useState, useMemo, useCallback } from 'react';
import { SEARCH_MAX_LENGTH, clampSearchInput } from '@/lib/searchFieldConstraints';
import { TRADE_COINS, generateMockPriceSeries, POPULAR_SYMBOLS, type TradeCoin } from '@/lib/tradeMockData';

const LOGO_BASE = 'https://assets.coincap.io/assets/icons';

function CryptoLogo({ symbol }: { symbol: string }) {
  const sym = symbol.toLowerCase();
  const src = `${LOGO_BASE}/${sym}@2x.png`;
  const [imgError, setImgError] = useState(false);

  if (imgError) {
    return (
      <div className="w-6 h-6 rounded-full bg-slate-700 flex items-center justify-center text-xs font-semibold text-slate-400 shrink-0 group-data-[theme=light]:bg-slate-200 group-data-[theme=light]:text-slate-600">
        {symbol.slice(0, 2)}
      </div>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={symbol}
      width={24}
      height={24}
      className="w-6 h-6 rounded-full object-contain shrink-0"
      onError={() => setImgError(true)}
    />
  );
}

function MiniSparkline({ symbol, price }: { symbol: string; price: number }) {
  const points = useMemo(() => generateMockPriceSeries(symbol, price), [symbol, price]);
  const min = Math.min(...points.map((p) => p.price));
  const max = Math.max(...points.map((p) => p.price));
  const range = max - min || 1;
  const w = 60;
  const h = 24;
  const path = points
    .map((p, i) => {
      const x = (i / (points.length - 1)) * w;
      const y = h - ((p.price - min) / range) * (h - 2) - 1;
      return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
    })
    .join(' ');
  const isUp = points[points.length - 1]?.price >= points[0]?.price;

  return (
    <svg width={w} height={h} className="shrink-0" aria-hidden>
      <path
        d={path}
        fill="none"
        stroke={isUp ? '#10b981' : '#ef4444'}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

type SortField = 'name' | 'symbol' | 'price' | 'change24h' | 'volume24h';

interface TradeCoinTableProps {
  selectedCoin: TradeCoin | null;
  onSelectCoin: (coin: TradeCoin) => void;
}

const sortButtonBase =
  'rounded-lg px-3 py-1.5 text-sm font-medium flex items-center gap-1 transition-colors border-0 outline-none focus:outline-none bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 hover:text-emerald-300 group-data-[theme=light]:bg-emerald-50 group-data-[theme=light]:text-emerald-700 group-data-[theme=light]:hover:bg-emerald-100 group-data-[theme=light]:hover:text-emerald-800';

function formatPrice(n: number): string {
  if (n >= 1e6) return `$${(n / 1e6).toFixed(2)}M`;
  if (n >= 1e3) return `$${n.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
  if (n >= 1) return `$${n.toFixed(2)}`;
  if (n >= 0.0001) return `$${n.toFixed(4)}`;
  return `$${n.toExponential(2)}`;
}

function formatVol(n: number): string {
  if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(2)}M`;
  if (n >= 1e3) return `$${(n / 1e3).toFixed(2)}K`;
  return `$${n.toFixed(0)}`;
}

export function TradeCoinTable({ selectedCoin, onSelectCoin }: TradeCoinTableProps) {
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<{ by: SortField; order: 'asc' | 'desc' }>({
    by: 'price',
    order: 'desc',
  });
  const [popularFilter, setPopularFilter] = useState(false);

  const filteredCoins = useMemo(() => {
    let list = [...TRADE_COINS];
    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (c) =>
          c.name.toLowerCase().includes(q) || c.symbol.toLowerCase().includes(q)
      );
    }
    if (popularFilter) {
      list = list.filter((c) => POPULAR_SYMBOLS.includes(c.symbol));
    }
    list.sort((a, b) => {
      const aVal = a[sort.by] as string | number;
      const bVal = b[sort.by] as string | number;
      let cmp = 0;
      if (typeof aVal === 'number' && typeof bVal === 'number') cmp = aVal - bVal;
      else cmp = String(aVal).localeCompare(String(bVal));
      return sort.order === 'asc' ? cmp : -cmp;
    });
    return list;
  }, [search, sort, popularFilter]);

  const handleSort = useCallback((field: SortField) => {
    setSort((prev) => {
      if (prev.by === field) {
        return { by: field, order: prev.order === 'asc' ? 'desc' : 'asc' };
      }
      return { by: field, order: 'desc' };
    });
  }, []);

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

  return (
    <div className="rounded-xl border border-slate-700/80 bg-slate-900/50 overflow-hidden group-data-[theme=light]:border-slate-200 group-data-[theme=light]:bg-white/80">
      <div className="p-3 border-b border-slate-700/80 group-data-[theme=light]:border-slate-200">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <input
            type="search"
            placeholder="Search coin..."
            value={search}
            maxLength={SEARCH_MAX_LENGTH}
            onChange={(e) => setSearch(clampSearchInput(e.target.value))}
            className="rounded-lg border border-slate-600 bg-slate-800/80 px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-emerald-500 focus:outline-none w-full sm:w-48 group-data-[theme=light]:border-slate-300 group-data-[theme=light]:bg-white group-data-[theme=light]:text-slate-900"
          />
          <label className="flex items-center gap-2 text-sm text-slate-400 group-data-[theme=light]:text-slate-600 cursor-pointer">
            <input
              type="checkbox"
              checked={popularFilter}
              onChange={(e) => setPopularFilter(e.target.checked)}
              className="rounded border-slate-600 bg-slate-800 text-emerald-500 focus:ring-emerald-500 group-data-[theme=light]:border-slate-300"
            />
            Popular only
          </label>
        </div>
      </div>
      <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-slate-900/95 group-data-[theme=light]:bg-white/95 z-10">
            <tr className="border-b border-slate-700/80 group-data-[theme=light]:border-slate-200">
              <th className="text-left py-3 px-4 font-medium text-slate-400 group-data-[theme=light]:text-slate-600">
                <SortHeader field="name" label="Coin" />
              </th>
              <th className="text-left py-3 px-4 font-medium text-slate-400 group-data-[theme=light]:text-slate-600">
                <SortHeader field="symbol" label="Symbol" />
              </th>
              <th className="text-center py-3 px-4 font-medium text-slate-400 group-data-[theme=light]:text-slate-600">
                Chart
              </th>
              <th className="text-right py-3 px-4 font-medium text-slate-400 group-data-[theme=light]:text-slate-600">
                <SortHeader field="price" label="Price" align="right" />
              </th>
              <th className="text-right py-3 px-4 font-medium text-slate-400 group-data-[theme=light]:text-slate-600">
                <SortHeader field="change24h" label="24h %" align="right" />
              </th>
              <th className="text-right py-3 px-4 font-medium text-slate-400 group-data-[theme=light]:text-slate-600">
                <SortHeader field="volume24h" label="Volume" align="right" />
              </th>
            </tr>
          </thead>
          <tbody>
            {filteredCoins.map((coin) => {
              const isSelected = selectedCoin?.id === coin.id;
              return (
                <tr
                  key={coin.id}
                  onClick={() => onSelectCoin(coin)}
                  className={`border-b border-slate-800/80 cursor-pointer transition-colors hover:bg-slate-800/60 group-data-[theme=light]:border-slate-100 group-data-[theme=light]:hover:bg-slate-50 ${
                    isSelected ? 'bg-emerald-500/15 ring-1 ring-inset ring-emerald-500/40 group-data-[theme=light]:bg-emerald-50/70' : ''
                  } ${POPULAR_SYMBOLS.includes(coin.symbol) ? 'bg-slate-800/20 group-data-[theme=light]:bg-slate-50/30' : ''}`}
                >
                  <td className="py-3 px-4 text-left">
                    <div className="flex items-center gap-2">
                      <CryptoLogo symbol={coin.symbol} />
                      <span className="font-medium text-white group-data-[theme=light]:text-slate-900">
                        {coin.name}
                      </span>
                    </div>
                  </td>
                  <td className="py-3 px-4 text-left text-slate-400 group-data-[theme=light]:text-slate-600">
                    {coin.symbol}
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex justify-center">
                      <MiniSparkline symbol={coin.symbol} price={coin.price} />
                    </div>
                  </td>
                  <td className="py-3 px-4 text-right font-mono tabular-nums text-white group-data-[theme=light]:text-slate-900">
                    {formatPrice(coin.price)}
                  </td>
                  <td className="py-3 px-4 text-right">
                    <span
                      className={`font-mono tabular-nums ${
                        coin.change24h >= 0 ? 'text-emerald-400' : 'text-red-400'
                      }`}
                    >
                      {coin.change24h >= 0 ? '+' : ''}
                      {coin.change24h.toFixed(2)}%
                    </span>
                  </td>
                  <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-400 group-data-[theme=light]:text-slate-600">
                    {formatVol(coin.volume24h)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {filteredCoins.length === 0 && (
        <div className="p-6 text-center text-slate-500 group-data-[theme=light]:text-slate-500">
          No coins match your search
        </div>
      )}
    </div>
  );
}
