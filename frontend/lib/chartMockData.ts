/**
 * Deterministic mock OHLC + volume data for the Advanced Charts page
 * (TradingView Lightweight Charts). Seeded so candles are reproducible per
 * coin + interval, which keeps Playwright assertions and screenshots stable.
 *
 * Reuses the coin catalog from tradeMockData. A separate "live tick" helper
 * advances the most recent candle for the realtime training UX.
 */

import { TRADE_COINS, type TradeCoin } from '@/lib/tradeMockData';

export { TRADE_COINS };
export type { TradeCoin };

/** Lightweight Charts candlestick datum (time is a UNIX timestamp in seconds). */
export interface Candle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
}

/** Lightweight Charts histogram datum for the volume series. */
export interface VolumePoint {
  time: number;
  value: number;
  color: string;
}

export interface ChartInterval {
  id: string;
  label: string;
  /** seconds between candles */
  seconds: number;
}

export const CHART_INTERVALS: ChartInterval[] = [
  { id: '1m', label: '1m', seconds: 60 },
  { id: '5m', label: '5m', seconds: 5 * 60 },
  { id: '15m', label: '15m', seconds: 15 * 60 },
  { id: '1h', label: '1H', seconds: 60 * 60 },
  { id: '1d', label: '1D', seconds: 24 * 60 * 60 },
];

export const DEFAULT_INTERVAL_ID = '1h';

/** Number of historical candles generated per series. */
const CANDLE_COUNT = 160;

/**
 * Deterministic pseudo-random in [0, 1) from an integer step. Pure (no shared
 * mutable state) so a given (symbol, interval, index) always yields the same value.
 */
function seeded(symbol: string, intervalId: string, index: number): number {
  let h = 0;
  const key = `${symbol}-${intervalId}-${index}`;
  for (let i = 0; i < key.length; i++) {
    h = (Math.imul(31, h) + key.charCodeAt(i)) | 0;
  }
  const x = Math.sin(h) * 10000;
  return x - Math.floor(x);
}

const UP_COLOR = 'rgba(16, 185, 129, 0.5)'; // emerald
const DOWN_COLOR = 'rgba(239, 68, 68, 0.5)'; // red

/** Align a timestamp (seconds) down to the interval grid. */
function floorToInterval(epochSeconds: number, intervalSeconds: number): number {
  return Math.floor(epochSeconds / intervalSeconds) * intervalSeconds;
}

export interface GeneratedSeries {
  candles: Candle[];
  volumes: VolumePoint[];
}

/**
 * Build a deterministic OHLC + volume series for a coin/interval ending at the
 * most recent interval boundary before now.
 */
export function generateCandleSeries(
  symbol: string,
  basePrice: number,
  intervalId: string
): GeneratedSeries {
  const interval = CHART_INTERVALS.find((i) => i.id === intervalId) ?? CHART_INTERVALS[3]!;
  const nowSec = Math.floor(Date.now() / 1000);
  const lastTime = floorToInterval(nowSec, interval.seconds);

  const candles: Candle[] = [];
  const volumes: VolumePoint[] = [];

  // Start a bit below base so the latest candle lands near basePrice.
  let close = basePrice * (0.9 + seeded(symbol, intervalId, 0) * 0.05);

  for (let i = CANDLE_COUNT - 1; i >= 0; i--) {
    const time = lastTime - i * interval.seconds;
    const idx = CANDLE_COUNT - i;

    const open = close;
    const drift = (seeded(symbol, intervalId, idx) - 0.48) * 0.02; // slight upward bias
    close = Math.max(open * (1 + drift), 0.0001);

    const wick = open * (0.004 + seeded(symbol, intervalId, idx + 1000) * 0.012);
    const high = Math.max(open, close) + wick * seeded(symbol, intervalId, idx + 2000);
    const low = Math.min(open, close) - wick * seeded(symbol, intervalId, idx + 3000);

    const round = (n: number) => Math.round(n * 100) / 100;
    candles.push({ time, open: round(open), high: round(high), low: round(low), close: round(close) });

    const vol = Math.round((0.5 + seeded(symbol, intervalId, idx + 4000)) * basePrice * 8);
    volumes.push({ time, value: vol, color: close >= open ? UP_COLOR : DOWN_COLOR });
  }

  return { candles, volumes };
}

/**
 * Produce the next live-tick update for the most recent candle: nudges the close
 * within the current candle and extends high/low. Returns an updated candle +
 * volume sharing the same `time` as `last` so `series.update()` mutates in place.
 */
export function nextLiveTick(last: Candle, lastVolume: VolumePoint): {
  candle: Candle;
  volume: VolumePoint;
} {
  const jitter = (Math.random() - 0.5) * 0.004;
  const close = Math.max(last.close * (1 + jitter), 0.0001);
  const round = (n: number) => Math.round(n * 100) / 100;
  const nextClose = round(close);
  const candle: Candle = {
    time: last.time,
    open: last.open,
    high: round(Math.max(last.high, nextClose)),
    low: round(Math.min(last.low, nextClose)),
    close: nextClose,
  };
  const volume: VolumePoint = {
    time: last.time,
    value: Math.round(lastVolume.value * (0.99 + Math.random() * 0.03)),
    color: candle.close >= candle.open ? UP_COLOR : DOWN_COLOR,
  };
  return { candle, volume };
}
