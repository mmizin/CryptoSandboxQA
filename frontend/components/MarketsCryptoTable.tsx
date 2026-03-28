'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { useCryptos } from '@/lib/useCryptos';
import { cryptosApi, type CryptoItem } from '@/lib/api';
import { MarketsModal } from '@/components/MarketsModal';
import { MarketsCryptoDetailModal } from '@/components/MarketsCryptoDetailModal';
import { SEARCH_MAX_LENGTH, clampSearchInput } from '@/lib/searchFieldConstraints';

const LOGO_BASE = 'https://assets.coincap.io/assets/icons';

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

const toolbarBtn =
  'rounded-lg px-3 py-2 text-sm font-medium transition-colors border-0 outline-none focus:outline-none bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 hover:text-emerald-300 group-data-[theme=light]:bg-emerald-50 group-data-[theme=light]:text-emerald-700 group-data-[theme=light]:hover:bg-emerald-100 group-data-[theme=light]:hover:text-emerald-800';

const methodologyParagraphs = [
  'This methodology document is intentionally long so QA can verify scroll behavior inside a modal, background scroll lock, and focus staying within the dialog while using Page Down or a trackpad.',
  'Rankings and prices in CryptoSandboxQA are persisted training data — not live exchange feeds. Volume and change percentages are stored per row in the cryptos table and may be seeded or updated by the training backend.',
  'When you sort by 24h volume or 24h change, the API applies the sort and pagination parameters documented in OpenAPI. Search debounces client-side to reduce chatter during typing exercises.',
  'Popular flags are a boolean on each listing; highlighted rows pair with that flag for visual regression checks in both dark and light themes.',
  'For automation: primary modal surfaces expose stable data-testid attributes listed in docs/QA_TESTING_FEATURES.md. Use them rather than brittle CSS selectors where possible.',
  'Backdrop clicks and Escape should behave consistently across nested and stacked dialogs; the nested QA dialog is a deliberate second layer to exercise z-index and focus-return edge cases.',
  'If a symbol in the URL fails to resolve, the detail modal stays open with an error message until the user dismisses it or fixes the query string — useful for negative-path testing.',
  'Scroll this panel to the bottom to confirm the footer actions of other modals (where present) remain reachable on short viewports.',
  'Session storage and authentication do not affect read-only market listings; detail reload uses the same GET /cryptos/:symbol endpoint as the initial load inside this flow.',
  'Training content duplicated: ranks are indicative; repeat text blocks pad length. Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.',
  'Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur.',
  'Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum. Additional padding paragraph for scroll depth.',
  'Closing: thank you for running through methodology QA; report any focus trap or body-scroll issues as regression bugs.',
];

interface MarketsCryptoTableProps {
  defaultLimit?: number;
  showPopularHighlight?: boolean;
  title?: string;
  /** Sync open detail modal with `?detail=SYMBOL` (shareable URL). Default true. */
  syncDetailQuery?: boolean;
}

export function MarketsCryptoTable({
  defaultLimit = 10,
  showPopularHighlight = true,
  title,
  syncDetailQuery = true,
}: MarketsCryptoTableProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [limit, setLimit] = useState(defaultLimit);
  const [search, setSearch] = useState('');
  const [searchDebounced, setSearchDebounced] = useState('');
  const [sort, setSort] = useState<{ by: SortField; order: 'asc' | 'desc' }>({
    by: 'volume24h',
    order: 'desc',
  });

  const [internalDetailSymbol, setInternalDetailSymbol] = useState<string | null>(null);
  const [detailCrypto, setDetailCrypto] = useState<CryptoItem | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [reloadSubmitting, setReloadSubmitting] = useState(false);

  const [aboutOpen, setAboutOpen] = useState(false);
  const [methodologyOpen, setMethodologyOpen] = useState(false);
  const [resetConfirmOpen, setResetConfirmOpen] = useState(false);

  const detailFromUrl = searchParams.get('detail')?.trim().toUpperCase() || null;
  const activeDetailSymbol = syncDetailQuery ? detailFromUrl : internalDetailSymbol;

  const setDetailQuery = useCallback(
    (symbol: string | null) => {
      if (!syncDetailQuery) {
        setInternalDetailSymbol(symbol ? symbol.toUpperCase() : null);
        return;
      }
      const p = new URLSearchParams(searchParams.toString());
      if (symbol) p.set('detail', symbol.toUpperCase());
      else p.delete('detail');
      const q = p.toString();
      router.replace(q ? `${pathname}?${q}` : pathname, { scroll: false });
    },
    [syncDetailQuery, searchParams, pathname, router]
  );

  const closeDetailModal = useCallback(() => {
    setDetailQuery(null);
    setDetailCrypto(null);
    setDetailError(null);
  }, [setDetailQuery]);

  const fetchIdRef = useRef(0);
  useEffect(() => {
    if (!activeDetailSymbol) {
      setDetailCrypto(null);
      setDetailError(null);
      setDetailLoading(false);
      return;
    }
    const sym = activeDetailSymbol;
    const id = ++fetchIdRef.current;
    setDetailLoading(true);
    setDetailError(null);
    setDetailCrypto(null);
    void (async () => {
      try {
        const item = await cryptosApi.get(sym);
        if (id !== fetchIdRef.current) return;
        if (!item) throw new Error('Symbol not found');
        setDetailCrypto(item);
      } catch (e) {
        if (id !== fetchIdRef.current) return;
        setDetailError(e instanceof Error ? e.message : 'Failed to load');
        setDetailCrypto(null);
      } finally {
        if (id === fetchIdRef.current) setDetailLoading(false);
      }
    })();
  }, [activeDetailSymbol]);

  const handleReloadDetail = useCallback(async () => {
    const sym = detailCrypto?.symbol ?? activeDetailSymbol;
    if (!sym) return;
    setReloadSubmitting(true);
    setDetailError(null);
    try {
      const item = await cryptosApi.get(sym);
      if (!item) throw new Error('Symbol not found');
      setDetailCrypto(item);
    } catch (e) {
      setDetailError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setReloadSubmitting(false);
    }
  }, [detailCrypto?.symbol, activeDetailSymbol]);

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

  const openRowDetail = (c: CryptoItem) => {
    setDetailQuery(c.symbol);
  };

  const applyResetFilters = () => {
    setSearch('');
    setSearchDebounced('');
    setLimit(defaultLimit);
    setSort({ by: 'volume24h', order: 'desc' });
    setResetConfirmOpen(false);
  };

  const detailModalOpen = !!activeDetailSymbol;

  return (
    <>
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
        <span className="text-xs font-medium uppercase tracking-wide text-slate-500 group-data-[theme=light]:text-slate-500">
          QA modals
        </span>
        <div className="flex flex-wrap gap-2">
          <button type="button" className={toolbarBtn} onClick={() => setAboutOpen(true)} data-testid="markets-modal-about">
            About this data
          </button>
          <button
            type="button"
            className={toolbarBtn}
            onClick={() => setMethodologyOpen(true)}
            data-testid="markets-modal-methodology"
          >
            Data methodology (long scroll)
          </button>
          <button
            type="button"
            className={toolbarBtn}
            onClick={() => setResetConfirmOpen(true)}
            data-testid="markets-open-reset-filters"
          >
            Reset filters…
          </button>
        </div>
      </div>

      <div className="rounded-xl border border-slate-700/80 bg-slate-900/50 overflow-hidden group-data-[theme=light]:border-slate-200 group-data-[theme=light]:bg-white/80">
        <div className="p-4 border-b border-slate-700/80 group-data-[theme=light]:border-slate-200">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            {title && (
              <h2 className="text-lg font-semibold text-white group-data-[theme=light]:text-slate-900">{title}</h2>
            )}
            <div className="flex flex-wrap items-center gap-3">
              <input
                type="search"
                placeholder="Search by name or symbol..."
                value={search}
                maxLength={SEARCH_MAX_LENGTH}
                onChange={(e) => setSearch(clampSearchInput(e.target.value))}
                data-testid="markets-search-input"
                className="rounded-lg border border-slate-600 bg-slate-800/80 px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 group-data-[theme=light]:border-slate-300 group-data-[theme=light]:bg-white group-data-[theme=light]:text-slate-900"
              />
              <label className="flex items-center gap-2 text-sm text-slate-400 group-data-[theme=light]:text-slate-600">
                <span>Per load:</span>
                <select
                  value={limit}
                  onChange={(e) => setLimit(Number(e.target.value))}
                  data-testid="markets-limit-select"
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

        {error && <div className="p-4 text-red-400 text-sm">{error}</div>}

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
                  role="button"
                  tabIndex={0}
                  data-testid={`markets-row-${c.symbol}`}
                  onClick={() => openRowDetail(c)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      openRowDetail(c);
                    }
                  }}
                  className={`cursor-pointer border-b border-slate-800/80 transition-colors hover:bg-slate-800/60 group-data-[theme=light]:border-slate-100 group-data-[theme=light]:hover:bg-slate-50 ${
                    showPopularHighlight && c.popular ? 'bg-emerald-500/5 group-data-[theme=light]:bg-emerald-50/50' : ''
                  } ${i % 2 === 1 ? 'bg-slate-800/20 group-data-[theme=light]:bg-slate-50/30' : ''}`}
                >
                  <td className="py-3 px-4 text-left">
                    <div className="flex items-center gap-2">
                      <CryptoLogo symbol={c.symbol} />
                      <span className="font-medium text-white group-data-[theme=light]:text-slate-900">{c.name}</span>
                      {c.popular && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400">Popular</span>
                      )}
                    </div>
                  </td>
                  <td className="py-3 px-4 text-left text-slate-400 group-data-[theme=light]:text-slate-600">{c.symbol}</td>
                  <td className="py-3 px-4 text-right font-mono text-white group-data-[theme=light]:text-slate-900">
                    {formatPrice(c.price)}
                  </td>
                  <td className="py-3 px-4 text-right">
                    <span
                      className={`font-mono ${parseFloat(c.change24h) >= 0 ? 'text-emerald-400' : 'text-red-400'}`}
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

      <MarketsCryptoDetailModal
        open={detailModalOpen}
        onClose={closeDetailModal}
        crypto={detailCrypto}
        loading={detailLoading}
        error={detailError}
        onReloadDetail={handleReloadDetail}
        reloadLoading={reloadSubmitting}
      />

      <MarketsModal
        open={aboutOpen}
        onClose={() => setAboutOpen(false)}
        titleId="markets-about-title"
        title="About market data"
        descriptionId="markets-about-desc"
        description="Short informational modal for copy, theme, and primary-button checks."
        size="md"
        panelTestId="markets-about-modal"
        footer={
          <button
            type="button"
            className="w-full rounded-lg px-4 py-2 text-sm font-medium transition-colors border-0 outline-none focus:outline-none bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 hover:text-emerald-300 group-data-[theme=light]:bg-emerald-50 group-data-[theme=light]:text-emerald-700 group-data-[theme=light]:hover:bg-emerald-100 group-data-[theme=light]:hover:text-emerald-800 sm:w-auto"
            onClick={() => setAboutOpen(false)}
            data-testid="markets-about-dismiss"
          >
            Got it
          </button>
        }
      >
        <p className="text-sm text-slate-400 group-data-[theme=light]:text-slate-600">
          Listings come from the training API (<code className="rounded bg-slate-800 px-1 group-data-[theme=light]:bg-slate-100">GET /cryptos</code>
          ). Row keyboard activation and click open a detail modal; optional <code className="rounded bg-slate-800 px-1 group-data-[theme=light]:bg-slate-100">?detail=SYMBOL</code> deep
          links sync with that modal when enabled.
        </p>
      </MarketsModal>

      <MarketsModal
        open={methodologyOpen}
        onClose={() => setMethodologyOpen(false)}
        titleId="markets-methodology-title"
        title="Data methodology"
        descriptionId="markets-methodology-desc"
        description="Scroll the body while the page behind stays locked."
        size="xl"
        bodyScrollable
        panelTestId="markets-methodology-modal"
        footer={
          <button
            type="button"
            className="w-full rounded-lg px-4 py-2 text-sm font-medium transition-colors border-0 outline-none focus:outline-none bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 hover:text-emerald-300 group-data-[theme=light]:bg-emerald-50 group-data-[theme=light]:text-emerald-700 group-data-[theme=light]:hover:bg-emerald-100 group-data-[theme=light]:hover:text-emerald-800 sm:w-auto"
            onClick={() => setMethodologyOpen(false)}
            data-testid="markets-methodology-dismiss"
          >
            Close
          </button>
        }
      >
        <div className="space-y-4 text-sm text-slate-400 group-data-[theme=light]:text-slate-600">
          {methodologyParagraphs.map((p, idx) => (
            <p key={idx}>{p}</p>
          ))}
        </div>
      </MarketsModal>

      <MarketsModal
        open={resetConfirmOpen}
        onClose={() => setResetConfirmOpen(false)}
        titleId="markets-reset-title"
        title="Reset filters?"
        descriptionId="markets-reset-desc"
        description="Search text, per-load limit, and sort order will return to defaults for this table."
        role="alertdialog"
        size="md"
        closeOnBackdropClick={false}
        panelTestId="markets-reset-confirm-modal"
        footer={
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button
              type="button"
              className="rounded-lg px-4 py-2 text-sm font-medium transition-colors border border-slate-600 bg-transparent text-slate-300 hover:bg-slate-800 hover:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50 group-data-[theme=light]:border-slate-300 group-data-[theme=light]:text-slate-700 group-data-[theme=light]:hover:bg-slate-100"
              onClick={() => setResetConfirmOpen(false)}
              data-testid="markets-reset-cancel"
            >
              Cancel
            </button>
            <button
              type="button"
              className="rounded-lg px-4 py-2 text-sm font-medium transition-colors border-0 outline-none focus:outline-none bg-red-500/15 text-red-400 hover:bg-red-500/25 hover:text-red-300 group-data-[theme=light]:bg-red-50 group-data-[theme=light]:text-red-700 group-data-[theme=light]:hover:bg-red-100"
              onClick={applyResetFilters}
              data-testid="markets-reset-confirm"
            >
              Reset filters
            </button>
          </div>
        }
      >
        <p className="text-sm text-slate-400 group-data-[theme=light]:text-slate-600">
          This confirmation uses <code className="rounded bg-slate-800 px-1 group-data-[theme=light]:bg-slate-100">role=&quot;alertdialog&quot;</code> and disables
          backdrop close so cancel is explicit — useful for automation and negative paths.
        </p>
      </MarketsModal>
    </>
  );
}
