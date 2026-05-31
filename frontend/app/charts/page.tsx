'use client';

import { useCallback, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/useAuth';
import { AdvancedChart, type ChartSeriesType } from '@/components/AdvancedChart';
import { TradeOrderEntryDual } from '@/components/TradeOrderEntryDual';
import { TradeOrdersTabs } from '@/components/TradeOrdersTabs';
import { useOrderTriggers } from '@/lib/useOrderTriggers';
import {
  TRADE_COINS,
  CHART_INTERVALS,
  DEFAULT_INTERVAL_ID,
  type TradeCoin,
} from '@/lib/chartMockData';

const backBtn =
  'rounded-lg px-4 py-2 text-sm font-medium flex items-center gap-1 transition-colors border-0 outline-none focus:outline-none bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 hover:text-emerald-300 group-data-[theme=light]:bg-emerald-50 group-data-[theme=light]:text-emerald-700 group-data-[theme=light]:hover:bg-emerald-100 group-data-[theme=light]:hover:text-emerald-800';

const selectBase =
  'rounded-lg border border-slate-600 bg-slate-800/80 px-3 py-2 text-sm text-white focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 group-data-[theme=light]:border-slate-300 group-data-[theme=light]:bg-white group-data-[theme=light]:text-slate-900';

const SERIES_TYPES: { id: ChartSeriesType; label: string }[] = [
  { id: 'candlestick', label: 'Candlestick' },
  { id: 'line', label: 'Line' },
  { id: 'area', label: 'Area' },
];

function segmentBtn(active: boolean) {
  return `rounded-lg px-3 py-1.5 text-sm font-medium border outline-none transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40 ${
    active
      ? 'border-emerald-500/60 bg-emerald-500/15 text-emerald-300 group-data-[theme=light]:border-emerald-400 group-data-[theme=light]:bg-emerald-50 group-data-[theme=light]:text-emerald-700'
      : 'border-slate-600 bg-slate-800/80 text-slate-300 hover:bg-slate-800 hover:text-white group-data-[theme=light]:border-slate-300 group-data-[theme=light]:bg-white group-data-[theme=light]:text-slate-700 group-data-[theme=light]:hover:bg-slate-50'
  }`;
}

export default function ChartsPage() {
  const router = useRouter();
  const { user } = useAuth(false);

  const [symbol, setSymbol] = useState<string>(TRADE_COINS[0]?.symbol ?? 'BTC');
  const [intervalId, setIntervalId] = useState<string>(DEFAULT_INTERVAL_ID);
  const [seriesType, setSeriesType] = useState<ChartSeriesType>('candlestick');
  const [showVolume, setShowVolume] = useState(true);
  const [live, setLive] = useState(true);
  const [livePrice, setLivePrice] = useState<number | null>(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const coin: TradeCoin | null = useMemo(
    () => TRADE_COINS.find((c) => c.symbol === symbol) ?? null,
    [symbol]
  );

  const bumpRefresh = useCallback(() => setRefreshTrigger((n) => n + 1), []);

  const { addWorkingOrder, removeWorkingOrder } = useOrderTriggers({
    symbol,
    livePrice,
    onTriggered: bumpRefresh,
  });

  const handleBack = () => {
    if (typeof window !== 'undefined' && window.history.length > 1) {
      router.back();
    } else {
      router.push(user ? '/dashboard' : '/');
    }
  };

  return (
    <main
      className="min-h-screen transition-colors duration-200 px-4 py-6 sm:px-6 lg:px-8"
      data-testid="advanced-chart-page"
    >
      <div className="max-w-7xl mx-auto">
        <div className="mb-6">
          <button type="button" onClick={handleBack} className={backBtn}>
            ← Back
          </button>
        </div>
        <h1 className="flex items-center gap-3 text-6xl font-bold text-white group-data-[theme=light]:text-slate-900 mb-2">
          <img src="/tv.jpg" alt="TradingView" width={84} height={84} className="rounded-md" />
          Advanced Charts
        </h1>
        <p className="text-slate-400 group-data-[theme=light]:text-slate-600 mb-6">
          Interactive candlestick charts powered by TradingView Lightweight Charts with deterministic
          mock data. Pan, zoom, and hover the crosshair; the values below mirror the candle under the
          cursor. Pause live updates for stable screenshots.
        </p>

        <div className="mb-4 flex flex-wrap items-end gap-4">
          <label className="flex flex-col gap-1 text-xs font-medium text-slate-400 group-data-[theme=light]:text-slate-600">
            Coin
            <select
              value={symbol}
              onChange={(e) => setSymbol(e.target.value)}
              className={selectBase}
              data-testid="advanced-chart-coin-select"
              aria-label="Select coin"
            >
              {TRADE_COINS.map((c) => (
                <option key={c.symbol} value={c.symbol}>
                  {c.symbol} · {c.name}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1 text-xs font-medium text-slate-400 group-data-[theme=light]:text-slate-600">
            Interval
            <select
              value={intervalId}
              onChange={(e) => setIntervalId(e.target.value)}
              className={selectBase}
              data-testid="advanced-chart-interval-select"
              aria-label="Select interval"
            >
              {CHART_INTERVALS.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.label}
                </option>
              ))}
            </select>
          </label>

          <div className="flex flex-col gap-1 text-xs font-medium text-slate-400 group-data-[theme=light]:text-slate-600">
            Series
            <div className="flex gap-2" role="group" aria-label="Series type">
              {SERIES_TYPES.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setSeriesType(s.id)}
                  aria-pressed={seriesType === s.id}
                  data-testid={`advanced-chart-series-${s.id}`}
                  className={segmentBtn(seriesType === s.id)}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-1 text-xs font-medium text-slate-400 group-data-[theme=light]:text-slate-600">
            Options
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setShowVolume((v) => !v)}
                aria-pressed={showVolume}
                data-testid="advanced-chart-volume-toggle"
                className={segmentBtn(showVolume)}
              >
                Volume
              </button>
              <button
                type="button"
                onClick={() => setLive((v) => !v)}
                aria-pressed={live}
                data-testid="advanced-chart-live-toggle"
                className={segmentBtn(live)}
              >
                {live ? 'Live ●' : 'Paused'}
              </button>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-4">
          <AdvancedChart
            coin={coin}
            intervalId={intervalId}
            seriesType={seriesType}
            showVolume={showVolume}
            live={live}
            onPriceUpdate={setLivePrice}
          />
          <TradeOrderEntryDual
            selectedCoin={coin}
            marketType="spot"
            currentPrice={livePrice ?? undefined}
            onOrderSubmitted={bumpRefresh}
            onOrderCreated={addWorkingOrder}
          />
          <TradeOrdersTabs
            marketType="spot"
            refreshTrigger={refreshTrigger}
            onCancelOrder={removeWorkingOrder}
          />
        </div>
      </div>
    </main>
  );
}
