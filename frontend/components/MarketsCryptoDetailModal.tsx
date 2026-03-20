'use client';

import { useState, useCallback, useEffect } from 'react';
import type { CryptoItem } from '@/lib/api';
import { MarketsModal } from '@/components/MarketsModal';

function formatPrice(s: string) {
  const n = parseFloat(s);
  if (n >= 1e6) return `$${(n / 1e6).toFixed(2)}M`;
  if (n >= 1e3) return `$${n.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
  if (n >= 1) return `$${n.toFixed(2)}`;
  if (n >= 0.0001) return `$${n.toFixed(4)}`;
  return `$${n.toExponential(2)}`;
}

function formatVol(s: string) {
  const n = parseFloat(s);
  if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(2)}M`;
  if (n >= 1e3) return `$${(n / 1e3).toFixed(2)}K`;
  return `$${n.toFixed(0)}`;
}

const secondaryBtn =
  'rounded-lg px-4 py-2 text-sm font-medium transition-colors border-0 outline-none focus:outline-none bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 hover:text-emerald-300 group-data-[theme=light]:bg-emerald-50 group-data-[theme=light]:text-emerald-700 group-data-[theme=light]:hover:bg-emerald-100 group-data-[theme=light]:hover:text-emerald-800';

const tertiaryBtn =
  'rounded-lg px-4 py-2 text-sm font-medium transition-colors border border-slate-600 bg-transparent text-slate-300 hover:bg-slate-800 hover:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50 group-data-[theme=light]:border-slate-300 group-data-[theme=light]:text-slate-700 group-data-[theme=light]:hover:bg-slate-100 group-data-[theme=light]:hover:text-slate-900';

export interface MarketsCryptoDetailModalProps {
  open: boolean;
  onClose: () => void;
  crypto: CryptoItem | null;
  loading: boolean;
  error: string | null;
  onReloadDetail: () => Promise<void>;
  reloadLoading: boolean;
}

export function MarketsCryptoDetailModal({
  open,
  onClose,
  crypto,
  loading,
  error,
  onReloadDetail,
  reloadLoading,
}: MarketsCryptoDetailModalProps) {
  const [nestedOpen, setNestedOpen] = useState(false);

  useEffect(() => {
    if (!open) setNestedOpen(false);
  }, [open]);

  const handleOpenNested = useCallback(() => {
    setNestedOpen(true);
  }, []);

  const handleCloseNested = useCallback(() => {
    setNestedOpen(false);
  }, []);

  const titleText =
    crypto && !loading ? `${crypto.name} (${crypto.symbol})` : loading ? 'Loading…' : 'Market detail';

  return (
    <>
      <MarketsModal
        open={open}
        onClose={onClose}
        titleId="markets-detail-title"
        title={titleText}
        descriptionId="markets-detail-desc"
        description="Training sandbox: stats from the cryptos API. Use Reload to exercise async loading."
        size="lg"
        panelTestId="markets-detail-modal"
        disableFocusTrap={nestedOpen}
        suppressEscapeClose={nestedOpen}
        footer={
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className={secondaryBtn}
              disabled={!crypto || reloadLoading}
              onClick={() => void onReloadDetail()}
              data-testid="markets-detail-reload"
            >
              {reloadLoading ? 'Reloading…' : 'Reload details (async)'}
            </button>
            <button type="button" className={tertiaryBtn} onClick={handleOpenNested} data-testid="markets-detail-nested-open">
              Open nested QA dialog
            </button>
          </div>
        }
      >
        {error ? (
          <p className="text-sm text-red-400" role="alert" data-testid="markets-detail-error">
            {error}
          </p>
        ) : null}
        {loading && !crypto ? (
          <p className="text-sm text-slate-400 group-data-[theme=light]:text-slate-600 animate-pulse" data-testid="markets-detail-loading">
            Loading market data…
          </p>
        ) : null}
        {crypto ? (
          <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2 text-sm">
            <div className="rounded-lg border border-slate-700/80 bg-slate-800/40 p-3 group-data-[theme=light]:border-slate-200 group-data-[theme=light]:bg-slate-50">
              <dt className="text-slate-500 group-data-[theme=light]:text-slate-600">Price</dt>
              <dd className="mt-1 font-mono text-white group-data-[theme=light]:text-slate-900">{formatPrice(crypto.price)}</dd>
            </div>
            <div className="rounded-lg border border-slate-700/80 bg-slate-800/40 p-3 group-data-[theme=light]:border-slate-200 group-data-[theme=light]:bg-slate-50">
              <dt className="text-slate-500 group-data-[theme=light]:text-slate-600">24h change</dt>
              <dd
                className={`mt-1 font-mono ${
                  parseFloat(crypto.change24h) >= 0 ? 'text-emerald-400' : 'text-red-400'
                }`}
              >
                {parseFloat(crypto.change24h) >= 0 ? '+' : ''}
                {parseFloat(crypto.change24h).toFixed(2)}%
              </dd>
            </div>
            <div className="rounded-lg border border-slate-700/80 bg-slate-800/40 p-3 group-data-[theme=light]:border-slate-200 group-data-[theme=light]:bg-slate-50">
              <dt className="text-slate-500 group-data-[theme=light]:text-slate-600">24h volume</dt>
              <dd className="mt-1 font-mono text-slate-300 group-data-[theme=light]:text-slate-800">{formatVol(crypto.volume24h)}</dd>
            </div>
            <div className="rounded-lg border border-slate-700/80 bg-slate-800/40 p-3 group-data-[theme=light]:border-slate-200 group-data-[theme=light]:bg-slate-50">
              <dt className="text-slate-500 group-data-[theme=light]:text-slate-600">Popular flag</dt>
              <dd className="mt-1 text-slate-200 group-data-[theme=light]:text-slate-900">{crypto.popular ? 'Yes' : 'No'}</dd>
            </div>
          </dl>
        ) : null}
      </MarketsModal>

      <MarketsModal
        open={nestedOpen}
        onClose={handleCloseNested}
        titleId="markets-nested-title"
        title="Nested QA dialog"
        descriptionId="markets-nested-desc"
        description="Stacked modal for z-index, focus, and Escape behavior checks."
        size="md"
        zIndexClass="z-[60]"
        panelTestId="markets-nested-modal"
        footer={
          <button type="button" className={`${secondaryBtn} w-full sm:w-auto`} onClick={handleCloseNested} data-testid="markets-nested-dismiss">
            Close nested dialog
          </button>
        }
      >
        <p className="text-sm text-slate-400 group-data-[theme=light]:text-slate-600">
          Close with Escape, the close button in the header, the primary action below, or the dimmed area behind this panel (if
          enabled).
        </p>
      </MarketsModal>
    </>
  );
}
