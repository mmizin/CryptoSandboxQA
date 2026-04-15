'use client';

import { useState, useEffect, useCallback, useRef, useId } from 'react';
import { cryptosApi, type CryptoItem } from '@/lib/api';
import { FALLBACK_CRYPTOS } from '@/lib/buySellMockData';
import { SEARCH_MAX_LENGTH, clampSearchInput } from '@/lib/searchFieldConstraints';

const inputBase =
  'w-full px-4 py-3 rounded-xl bg-[var(--input-bg)] border text-[var(--text)] placeholder-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50 transition-colors';
const inputError = 'border-red-500 focus:ring-red-500/50 focus:border-red-500/50';
const inputNormal = 'border-[var(--border)]';

interface CryptoSearchSelectProps {
  value: string;
  onChange: (symbol: string, price: number) => void;
  error?: boolean;
  disabled?: boolean;
  /** Stable id for the search input (for htmlFor). If omitted, a unique id is generated. */
  inputId?: string;
}

/** Map API CryptoItem to { symbol, name, price } for fallback compatibility */
function toCryptoItem(c: { symbol: string; name: string; price: string | number }): CryptoItem & { priceNum: number } {
  const priceNum = typeof c.price === 'string' ? parseFloat(c.price) || 0 : c.price;
  return {
    ...c,
    id: c.symbol,
    price: String(c.price),
    change24h: '0',
    volume24h: '0',
    popular: false,
    priceNum,
  };
}

export function CryptoSearchSelect({
  value,
  onChange,
  error = false,
  disabled = false,
  inputId: inputIdProp,
}: CryptoSearchSelectProps) {
  const genId = useId();
  const inputId = inputIdProp ?? `${genId}-crypto-search`;
  const listboxId = `${genId}-listbox`;

  const [searchQuery, setSearchQuery] = useState('');
  const [options, setOptions] = useState<(CryptoItem & { priceNum: number })[]>([]);
  const [loading, setLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [useFallback, setUseFallback] = useState(false);
  const [selectedItem, setSelectedItem] = useState<(CryptoItem & { priceNum: number }) | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const fetchCryptos = useCallback(async (search?: string) => {
    setLoading(true);
    setUseFallback(false);
    try {
      const res = await cryptosApi.list({
        limit: 100,
        offset: 0,
        search: search || undefined,
        sortBy: 'volume24h',
        sortOrder: 'desc',
      });
      const items = res.data.map((c) => ({ ...c, priceNum: parseFloat(c.price) || 0 }));
      setOptions(items);
    } catch {
      setOptions(FALLBACK_CRYPTOS.map(toCryptoItem));
      setUseFallback(true);
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial load and search (debounced)
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (searchQuery.trim()) {
      debounceRef.current = setTimeout(() => fetchCryptos(searchQuery.trim()), 300);
    } else {
      fetchCryptos();
    }
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [searchQuery, fetchCryptos]);

  // Sync selectedItem with value
  useEffect(() => {
    if (value && options.length > 0) {
      const found = options.find((c) => c.symbol === value);
      setSelectedItem(found ?? null);
    } else {
      setSelectedItem(null);
    }
  }, [value, options]);

  // Click outside to close
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = (c: CryptoItem & { priceNum: number }) => {
    onChange(c.symbol, c.priceNum);
    setSelectedItem(c);
    setSearchQuery('');
    setIsOpen(false);
  };

  const displayText = selectedItem
    ? `${selectedItem.name} (${selectedItem.symbol}) — $${selectedItem.priceNum.toLocaleString()}`
    : value
      ? `${value}${loading ? ' — Loading...' : ''}`
      : '';

  return (
    <div ref={containerRef} className="relative">
      <div
        role="combobox"
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        aria-controls={listboxId}
      >
        <input
          id={inputId}
          type="text"
          placeholder="Search cryptocurrency (e.g. Bitcoin, ETH, SOL)"
          value={isOpen ? searchQuery : displayText}
          maxLength={SEARCH_MAX_LENGTH}
          onChange={(e) => {
            setSearchQuery(clampSearchInput(e.target.value));
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          disabled={disabled}
          className={`${inputBase} ${error ? inputError : inputNormal}`}
          autoComplete="off"
        />
      </div>

      {isOpen && (
        <ul
          id={listboxId}
          role="listbox"
          className="absolute z-50 mt-1 w-full max-h-60 overflow-auto rounded-xl border border-slate-700 group-data-[theme=light]:border-slate-200 bg-slate-900 group-data-[theme=light]:bg-white shadow-xl"
        >
          {loading ? (
            <li className="px-4 py-6 text-center text-slate-500 group-data-[theme=light]:text-slate-600">
              Loading...
            </li>
          ) : options.length === 0 ? (
            <li className="px-4 py-6 text-center text-slate-500 group-data-[theme=light]:text-slate-600">
              No cryptocurrencies found
            </li>
          ) : (
            options.map((c) => (
              <li
                key={c.id}
                role="option"
                aria-selected={c.symbol === value}
                onClick={() => handleSelect(c)}
                className={`px-4 py-3 cursor-pointer transition-colors hover:bg-emerald-500/10 group-data-[theme=light]:hover:bg-emerald-50 ${
                  c.symbol === value ? 'bg-emerald-500/20 group-data-[theme=light]:bg-emerald-100' : ''
                }`}
              >
                <div className="flex justify-between items-center">
                  <span className="font-medium">
                    {c.name} <span className="text-slate-500">({c.symbol})</span>
                  </span>
                  <span className="text-slate-400 group-data-[theme=light]:text-slate-600">
                    ${c.priceNum.toLocaleString()}
                  </span>
                </div>
              </li>
            ))
          )}
          {useFallback && (
            <li className="px-4 py-2 text-xs text-slate-500 group-data-[theme=light]:text-slate-600 border-t border-slate-700 group-data-[theme=light]:border-slate-200">
              Using offline list — API unavailable
            </li>
          )}
        </ul>
      )}
    </div>
  );
}
