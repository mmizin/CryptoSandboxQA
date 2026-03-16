'use client';

import { useMemo } from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { generateMockPriceSeries, type TradeCoin } from '@/lib/tradeMockData';

interface TradePriceChartProps {
  coin: TradeCoin | null;
}

export function TradePriceChart({ coin }: TradePriceChartProps) {
  const data = useMemo(() => {
    if (!coin) return [];
    return generateMockPriceSeries(coin.symbol, coin.price);
  }, [coin]);

  const isUp = data.length >= 2 && data[data.length - 1]!.price >= data[0]!.price;
  const strokeColor = isUp ? '#10b981' : '#ef4444';
  const gradientId = `chartGradient-${coin?.symbol ?? 'none'}`;

  if (!coin) {
    return (
      <div className="rounded-xl border border-slate-700/80 bg-slate-900/50 p-6 h-64 flex items-center justify-center group-data-[theme=light]:border-slate-200 group-data-[theme=light]:bg-white/80">
        <p className="text-slate-500 group-data-[theme=light]:text-slate-500">
          Select a coin to view chart
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-slate-700/80 bg-slate-900/50 p-4 group-data-[theme=light]:border-slate-200 group-data-[theme=light]:bg-white/80">
      <h3 className="text-sm font-medium text-white group-data-[theme=light]:text-slate-900 mb-2">
        {coin.name} ({coin.symbol})
      </h3>
      <p className="text-2xl font-bold text-white group-data-[theme=light]:text-slate-900 mb-1">
        ${coin.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 6 })}
      </p>
      <span
        className={`text-sm font-mono ${
          coin.change24h >= 0 ? 'text-emerald-400' : 'text-red-400'
        }`}
      >
        {coin.change24h >= 0 ? '+' : ''}
        {coin.change24h.toFixed(2)}% (24h)
      </span>
      <div className="h-48 mt-4">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 4, right: 4, left: 4, bottom: 0 }}>
            <defs>
              <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={strokeColor} stopOpacity={0.3} />
                <stop offset="100%" stopColor={strokeColor} stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis
              dataKey="time"
              tick={{ fill: 'rgb(148 163 184)', fontSize: 10 }}
              tickFormatter={(v) => {
                try {
                  const d = new Date(v);
                  return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
                } catch {
                  return v;
                }
              }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              domain={['auto', 'auto']}
              tick={{ fill: 'rgb(148 163 184)', fontSize: 10 }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(v) => `$${v >= 1e3 ? `${(v / 1e3).toFixed(1)}k` : v.toFixed(2)}`}
              width={50}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: 'rgb(15 23 42)',
                border: '1px solid rgb(51 65 85)',
                borderRadius: '8px',
              }}
              labelStyle={{ color: 'rgb(226 232 240)' }}
              formatter={(value) => [`$${Number(value ?? 0).toLocaleString()}`, 'Price']}
              labelFormatter={(label) => {
                try {
                  return new Date(label).toLocaleString();
                } catch {
                  return label;
                }
              }}
            />
            <Area
              type="monotone"
              dataKey="price"
              stroke={strokeColor}
              strokeWidth={2}
              fill={`url(#${gradientId})`}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
