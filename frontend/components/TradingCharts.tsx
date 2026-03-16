'use client';

import { useEffect, useState } from 'react';
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { cryptosApi, type CryptoItem } from '@/lib/api';

const CHART_COLORS = [
  '#10b981', // emerald-500
  '#06b6d4', // cyan-500
  '#8b5cf6', // violet-500
  '#f59e0b', // amber-500
  '#ef4444', // red-500
  '#ec4899', // pink-500
  '#6366f1', // indigo-500
  '#14b8a6', // teal-500
  '#f97316', // orange-500
  '#84cc16', // lime-500
];

function formatVolume(value: number): string {
  if (value >= 1e9) return `$${(value / 1e9).toFixed(2)}B`;
  if (value >= 1e6) return `$${(value / 1e6).toFixed(2)}M`;
  if (value >= 1e3) return `$${(value / 1e3).toFixed(2)}K`;
  return `$${value.toFixed(0)}`;
}

export function TradingCharts() {
  const [data, setData] = useState<CryptoItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    cryptosApi
      .list({ limit: 20, sortBy: 'volume24h', sortOrder: 'desc' })
      .then((res) => setData(res.data))
      .catch(() => setData([]))
      .finally(() => setLoading(false));
  }, []);

  const pieData = data.slice(0, 10).map((c, i) => ({
    name: c.symbol,
    value: parseFloat(c.volume24h),
    fill: CHART_COLORS[i % CHART_COLORS.length],
  }));

  const barData = data.slice(0, 10).map((c) => ({
    symbol: c.symbol,
    volume: parseFloat(c.volume24h),
    change24h: parseFloat(c.change24h),
  }));

  const totalVolume = pieData.reduce((s, d) => s + d.value, 0);

  if (loading) {
    return (
      <div className="grid gap-6 md:grid-cols-2 mb-8">
        <div className="rounded-xl border border-slate-700/80 bg-slate-900/50 p-6 h-80 flex items-center justify-center group-data-[theme=light]:border-slate-200 group-data-[theme=light]:bg-white/80">
          <span className="text-slate-500 animate-pulse">Loading charts...</span>
        </div>
        <div className="rounded-xl border border-slate-700/80 bg-slate-900/50 p-6 h-80 flex items-center justify-center group-data-[theme=light]:border-slate-200 group-data-[theme=light]:bg-white/80">
          <span className="text-slate-500 animate-pulse">Loading charts...</span>
        </div>
      </div>
    );
  }

  if (data.length === 0) return null;

  return (
    <div className="grid gap-6 md:grid-cols-2 mb-8">
      {/* Volume Distribution (Donut) */}
      <div className="rounded-xl border border-slate-700/80 bg-slate-900/50 p-6 group-data-[theme=light]:border-slate-200 group-data-[theme=light]:bg-white/80">
        <h3 className="text-lg font-semibold text-white group-data-[theme=light]:text-slate-900 mb-4">
          24h Volume Distribution
        </h3>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={pieData}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={90}
                paddingAngle={2}
                dataKey="value"
                nameKey="name"
              >
                {pieData.map((entry, i) => (
                  <Cell key={entry.name} fill={entry.fill} stroke="transparent" />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  backgroundColor: 'rgb(15 23 42)',
                  border: '1px solid rgb(51 65 85)',
                  borderRadius: '8px',
                }}
                labelStyle={{ color: 'rgb(226 232 240)' }}
                formatter={(value) => [
                  `${formatVolume(Number(value ?? 0))} (${totalVolume > 0 ? ((Number(value ?? 0) / totalVolume) * 100).toFixed(1) : 0}%)`,
                  'Volume',
                ]}
              />
              <Legend wrapperStyle={{ fontSize: '12px' }} />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <p className="text-sm text-slate-500 mt-2 text-center">
          Total: {formatVolume(totalVolume)}
        </p>
      </div>

      {/* Top 10 by Volume (Bar) */}
      <div className="rounded-xl border border-slate-700/80 bg-slate-900/50 p-6 group-data-[theme=light]:border-slate-200 group-data-[theme=light]:bg-white/80">
        <h3 className="text-lg font-semibold text-white group-data-[theme=light]:text-slate-900 mb-4">
          Top 10 by 24h Volume
        </h3>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={barData} layout="vertical" margin={{ left: 0, right: 20 }}>
              <XAxis type="number" hide />
              <YAxis
                type="category"
                dataKey="symbol"
                width={40}
                tick={{ fill: 'rgb(148 163 184)', fontSize: 12 }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'rgb(15 23 42)',
                  border: '1px solid rgb(51 65 85)',
                  borderRadius: '8px',
                }}
                formatter={(value) => formatVolume(Number(value ?? 0))}
                labelFormatter={(label) => `${label} - 24h Vol`}
              />
              <Bar dataKey="volume" fill="#10b981" radius={[0, 4, 4, 0]} maxBarSize={24} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
