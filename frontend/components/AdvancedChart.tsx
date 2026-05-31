'use client';

import { useEffect, useRef, useState } from 'react';
import {
  createChart,
  ColorType,
  CrosshairMode,
  type IChartApi,
  type ISeriesApi,
  type UTCTimestamp,
  type MouseEventParams,
} from 'lightweight-charts';
import { useTheme } from '@/lib/useTheme';
import {
  generateCandleSeries,
  nextLiveTick,
  type Candle,
  type VolumePoint,
  type TradeCoin,
} from '@/lib/chartMockData';

export type ChartSeriesType = 'candlestick' | 'line' | 'area';

interface AdvancedChartProps {
  coin: TradeCoin | null;
  intervalId: string;
  seriesType: ChartSeriesType;
  showVolume: boolean;
  live: boolean;
}

const UP_COLOR = '#10b981';
const DOWN_COLOR = '#ef4444';
const LIVE_TICK_MS = 1500;

function themeColors(theme: 'dark' | 'light') {
  if (theme === 'light') {
    return {
      background: '#ffffff',
      text: '#334155',
      grid: '#e2e8f0',
      border: '#cbd5e1',
    };
  }
  return {
    background: 'transparent',
    text: '#94a3b8',
    grid: 'rgba(51, 65, 85, 0.4)',
    border: 'rgba(51, 65, 85, 0.6)',
  };
}

type Readout = { open: number; high: number; low: number; close: number } | null;

export function AdvancedChart({ coin, intervalId, seriesType, showVolume, live }: AdvancedChartProps) {
  const { theme } = useTheme();
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const mainSeriesRef = useRef<ISeriesApi<'Candlestick' | 'Line' | 'Area'> | null>(null);
  const volumeSeriesRef = useRef<ISeriesApi<'Histogram'> | null>(null);
  const candlesRef = useRef<Candle[]>([]);
  const volumesRef = useRef<VolumePoint[]>([]);
  const seriesTypeRef = useRef<ChartSeriesType>(seriesType);

  const [readout, setReadout] = useState<Readout>(null);
  const [lastClose, setLastClose] = useState<number | null>(null);

  // --- Create chart once on mount ---------------------------------------
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const colors = themeColors(theme);
    const chart = createChart(container, {
      width: container.clientWidth,
      height: 380,
      layout: {
        background: { type: ColorType.Solid, color: colors.background },
        textColor: colors.text,
        attributionLogo: false,
      },
      grid: {
        vertLines: { color: colors.grid },
        horzLines: { color: colors.grid },
      },
      rightPriceScale: { borderColor: colors.border },
      timeScale: { borderColor: colors.border, timeVisible: true, secondsVisible: false },
      crosshair: { mode: CrosshairMode.Normal },
    });
    chartRef.current = chart;

    const ro = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect.width;
      if (width) chart.applyOptions({ width: Math.floor(width) });
    });
    ro.observe(container);

    chart.subscribeCrosshairMove((param: MouseEventParams) => {
      const series = mainSeriesRef.current;
      if (!series || !param.time || !param.point) {
        // Pointer left the chart: fall back to the latest candle.
        const last = candlesRef.current[candlesRef.current.length - 1];
        setReadout(last ? { open: last.open, high: last.high, low: last.low, close: last.close } : null);
        return;
      }
      const data = param.seriesData.get(series) as
        | { open: number; high: number; low: number; close: number }
        | { value: number }
        | undefined;
      if (!data) return;
      if ('open' in data) {
        setReadout({ open: data.open, high: data.high, low: data.low, close: data.close });
      } else {
        setReadout({ open: data.value, high: data.value, low: data.value, close: data.value });
      }
    });

    return () => {
      ro.disconnect();
      chart.remove();
      chartRef.current = null;
      mainSeriesRef.current = null;
      volumeSeriesRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // --- Build / rebuild series + data ------------------------------------
  useEffect(() => {
    const chart = chartRef.current;
    if (!chart || !coin) {
      candlesRef.current = [];
      volumesRef.current = [];
      setReadout(null);
      setLastClose(null);
      return;
    }
    seriesTypeRef.current = seriesType;

    if (mainSeriesRef.current) {
      chart.removeSeries(mainSeriesRef.current);
      mainSeriesRef.current = null;
    }
    if (volumeSeriesRef.current) {
      chart.removeSeries(volumeSeriesRef.current);
      volumeSeriesRef.current = null;
    }

    const { candles, volumes } = generateCandleSeries(coin.symbol, coin.price, intervalId);
    candlesRef.current = candles;
    volumesRef.current = volumes;

    const toTime = <T extends { time: number }>(d: T) => ({ ...d, time: d.time as UTCTimestamp });

    if (seriesType === 'candlestick') {
      const s = chart.addCandlestickSeries({
        upColor: UP_COLOR,
        downColor: DOWN_COLOR,
        borderUpColor: UP_COLOR,
        borderDownColor: DOWN_COLOR,
        wickUpColor: UP_COLOR,
        wickDownColor: DOWN_COLOR,
      });
      s.setData(candles.map(toTime));
      mainSeriesRef.current = s;
    } else if (seriesType === 'line') {
      const s = chart.addLineSeries({ color: UP_COLOR, lineWidth: 2 });
      s.setData(candles.map((c) => ({ time: c.time as UTCTimestamp, value: c.close })));
      mainSeriesRef.current = s;
    } else {
      const s = chart.addAreaSeries({
        lineColor: UP_COLOR,
        topColor: 'rgba(16, 185, 129, 0.35)',
        bottomColor: 'rgba(16, 185, 129, 0)',
        lineWidth: 2,
      });
      s.setData(candles.map((c) => ({ time: c.time as UTCTimestamp, value: c.close })));
      mainSeriesRef.current = s;
    }

    if (showVolume) {
      const v = chart.addHistogramSeries({
        priceFormat: { type: 'volume' },
        priceScaleId: 'volume',
      });
      v.priceScale().applyOptions({ scaleMargins: { top: 0.82, bottom: 0 } });
      v.setData(volumes.map(toTime));
      volumeSeriesRef.current = v;
    }

    chart.timeScale().fitContent();

    const last = candles[candles.length - 1];
    setLastClose(last ? last.close : null);
    setReadout(last ? { open: last.open, high: last.high, low: last.low, close: last.close } : null);
  }, [coin, intervalId, seriesType, showVolume]);

  // --- Re-theme without rebuilding --------------------------------------
  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;
    const colors = themeColors(theme);
    chart.applyOptions({
      layout: {
        background: { type: ColorType.Solid, color: colors.background },
        textColor: colors.text,
      },
      grid: { vertLines: { color: colors.grid }, horzLines: { color: colors.grid } },
      rightPriceScale: { borderColor: colors.border },
      timeScale: { borderColor: colors.border },
    });
  }, [theme]);

  // --- Live tick: advance the most recent candle ------------------------
  useEffect(() => {
    if (!live || !coin) return;
    const id = window.setInterval(() => {
      const candles = candlesRef.current;
      const volumes = volumesRef.current;
      const main = mainSeriesRef.current;
      if (!candles.length || !main) return;

      const lastCandle = candles[candles.length - 1]!;
      const lastVol = volumes[volumes.length - 1] ?? { time: lastCandle.time, value: 0, color: UP_COLOR };
      const { candle, volume } = nextLiveTick(lastCandle, lastVol);
      candles[candles.length - 1] = candle;
      volumes[volumes.length - 1] = volume;

      if (seriesTypeRef.current === 'candlestick') {
        main.update({ ...candle, time: candle.time as UTCTimestamp });
      } else {
        main.update({ time: candle.time as UTCTimestamp, value: candle.close });
      }
      if (volumeSeriesRef.current) {
        volumeSeriesRef.current.update({ ...volume, time: volume.time as UTCTimestamp });
      }
      setLastClose(candle.close);
      setReadout({ open: candle.open, high: candle.high, low: candle.low, close: candle.close });
    }, LIVE_TICK_MS);
    return () => window.clearInterval(id);
  }, [live, coin, intervalId, seriesType, showVolume]);

  const resetZoom = () => chartRef.current?.timeScale().fitContent();

  const fmt = (n: number) =>
    n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <div
      className="rounded-xl border border-slate-700/80 bg-slate-900/50 p-4 group-data-[theme=light]:border-slate-200 group-data-[theme=light]:bg-white/80"
      data-testid="advanced-chart"
    >
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-baseline gap-3">
          <h3 className="text-sm font-medium text-white group-data-[theme=light]:text-slate-900">
            {coin ? `${coin.name} (${coin.symbol})` : 'No coin selected'}
          </h3>
          {lastClose != null && (
            <span
              className="text-lg font-bold text-white group-data-[theme=light]:text-slate-900"
              data-testid="advanced-chart-last-price"
            >
              ${fmt(lastClose)}
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={resetZoom}
          disabled={!coin}
          data-testid="advanced-chart-reset-zoom"
          className="rounded-lg border border-slate-600 bg-slate-800/80 px-3 py-1.5 text-sm font-medium text-slate-200 outline-none transition-colors hover:bg-slate-800 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-500/50 disabled:cursor-not-allowed disabled:opacity-45 group-data-[theme=light]:border-slate-300 group-data-[theme=light]:bg-white group-data-[theme=light]:text-slate-900 group-data-[theme=light]:hover:bg-slate-50"
        >
          Reset zoom
        </button>
      </div>

      {!coin ? (
        <div
          className="flex h-[380px] items-center justify-center text-slate-500"
          data-testid="advanced-chart-empty"
        >
          Select a coin to view the chart
        </div>
      ) : (
        <>
          <div ref={containerRef} data-testid="advanced-chart-container" className="w-full" />
          <dl
            className="mt-3 grid grid-cols-2 gap-2 text-xs sm:grid-cols-4"
            data-testid="advanced-chart-readout"
            aria-label="Crosshair candle values"
          >
            {(['open', 'high', 'low', 'close'] as const).map((k) => (
              <div
                key={k}
                className="rounded-lg bg-slate-800/40 px-3 py-2 group-data-[theme=light]:bg-slate-100/80"
              >
                <dt className="uppercase tracking-wide text-slate-500 group-data-[theme=light]:text-slate-500">
                  {k}
                </dt>
                <dd
                  className="font-mono text-slate-200 group-data-[theme=light]:text-slate-800"
                  data-testid={`advanced-chart-readout-${k}`}
                >
                  {readout ? fmt(readout[k]) : '—'}
                </dd>
              </div>
            ))}
          </dl>
        </>
      )}
    </div>
  );
}
