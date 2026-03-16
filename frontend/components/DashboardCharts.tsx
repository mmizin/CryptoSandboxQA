'use client';

import { useMemo } from 'react';
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  LineChart,
  Line,
  AreaChart,
  Area,
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
  CartesianGrid,
} from 'recharts';

const CHART_COLORS = [
  '#10b981',
  '#06b6d4',
  '#8b5cf6',
  '#f59e0b',
  '#ef4444',
  '#ec4899',
];

interface DashboardChartsProps {
  wallets: Array<{ asset: string; balance: string }>;
  loading?: boolean;
}

// Mock 7-day price trend for testing (deterministic)
const MOCK_PRICE_DATA = [
  { day: 'Mon', price: 48500, volume: 1200 },
  { day: 'Tue', price: 49200, volume: 1350 },
  { day: 'Wed', price: 47800, volume: 1100 },
  { day: 'Thu', price: 50100, volume: 1500 },
  { day: 'Fri', price: 49500, volume: 1400 },
  { day: 'Sat', price: 50800, volume: 1250 },
  { day: 'Sun', price: 51200, volume: 1300 },
];

// Mock portfolio value over time
const MOCK_PORTFOLIO_DATA = [
  { week: 'W1', value: 9500 },
  { week: 'W2', value: 10200 },
  { week: 'W3', value: 9800 },
  { week: 'W4', value: 11500 },
  { week: 'W5', value: 10800 },
  { week: 'W6', value: 12200 },
];

const tooltipStyle = {
  backgroundColor: 'rgb(15 23 42)',
  border: '1px solid rgb(51 65 85)',
  borderRadius: '8px',
};

export function DashboardCharts({ wallets, loading = false }: DashboardChartsProps) {
  const pieData = useMemo(() => {
    const values = wallets.map((w) => Math.max(0, parseFloat(w.balance)));
    const total = values.reduce((s, v) => s + v, 0) || 1;
    return wallets.map((w, i) => ({
      name: w.asset,
      value: Math.max(0, parseFloat(w.balance)),
      percent: total > 0 ? ((values[i] / total) * 100).toFixed(1) : '0',
      fill: CHART_COLORS[i % CHART_COLORS.length],
    })).filter((d) => d.value > 0);
  }, [wallets]);

  const barData = useMemo(
    () => wallets.map((w) => ({ asset: w.asset, balance: parseFloat(w.balance) })),
    [wallets]
  );

  const radarData = useMemo(() => {
    const usd = wallets.find((w) => w.asset === 'USD');
    const btc = wallets.find((w) => w.asset === 'BTC');
    const eth = wallets.find((w) => w.asset === 'ETH');
    const total =
      (parseFloat(usd?.balance || '0') +
        parseFloat(btc?.balance || '0') * 50000 +
        parseFloat(eth?.balance || '0') * 3000) || 1;
    return [
      { subject: 'USD', value: total > 0 ? (parseFloat(usd?.balance || '0') / total) * 100 : 0, fullMark: 100 },
      { subject: 'BTC', value: total > 0 ? ((parseFloat(btc?.balance || '0') * 50000) / total) * 100 : 0, fullMark: 100 },
      { subject: 'ETH', value: total > 0 ? ((parseFloat(eth?.balance || '0') * 3000) / total) * 100 : 0, fullMark: 100 },
    ];
  }, [wallets]);

  const totalBalance = useMemo(() => {
    const usd = wallets.find((w) => w.asset === 'USD');
    const btc = wallets.find((w) => w.asset === 'BTC');
    const eth = wallets.find((w) => w.asset === 'ETH');
    return (
      (parseFloat(usd?.balance || '0') +
        parseFloat(btc?.balance || '0') * 50000 +
        parseFloat(eth?.balance || '0') * 3000)
    );
  }, [wallets]);

  const portfolioPercent = Math.min(100, Math.max(0, (totalBalance / 15000) * 100));

  if (loading) {
    return (
      <section
        className="rounded-xl border border-slate-700/80 bg-slate-900/50 p-6 mb-10 group-data-[theme=light]:border-slate-200 group-data-[theme=light]:bg-white/80"
        data-testid="dashboard-charts"
      >
        <h2 className="text-lg font-semibold text-white mb-4 group-data-[theme=light]:text-slate-900">
          Portfolio Analytics
        </h2>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3" role="status" aria-label="Charts loading">
          <div className="h-48 animate-pulse rounded-lg bg-slate-800/50" />
          <div className="h-48 animate-pulse rounded-lg bg-slate-800/50" />
          <div className="h-48 animate-pulse rounded-lg bg-slate-800/50" />
        </div>
      </section>
    );
  }

  return (
    <section
      className="mb-10 space-y-8"
      data-testid="dashboard-charts"
      role="region"
      aria-label="Portfolio analytics and charts"
    >
      <h2 className="text-xl font-semibold text-white group-data-[theme=light]:text-slate-900">
        Portfolio Analytics
      </h2>

      {/* Row 1: Pie, Bar, Progress */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {/* 1. Pie Chart - Balance distribution (clickable segments, legend toggle) */}
        <div
          className="rounded-xl border border-slate-700/80 bg-slate-900/50 p-6 group-data-[theme=light]:border-slate-200 group-data-[theme=light]:bg-white/80"
          data-testid="chart-balance-pie"
          role="img"
          aria-label="Wallet balance distribution"
        >
          <h3 className="text-sm font-medium text-slate-400 mb-4 group-data-[theme=light]:text-slate-600">
            Balance distribution
          </h3>
          {pieData.length === 0 ? (
            <div className="h-48 flex items-center justify-center text-slate-500" data-testid="chart-empty-state">
              No balance data
            </div>
          ) : (
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={40}
                    outerRadius={70}
                    paddingAngle={2}
                  >
                    {pieData.map((e, i) => (
                      <Cell key={e.name} fill={e.fill} stroke="transparent" data-testid={`pie-segment-${e.name}`} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={tooltipStyle}
                    formatter={(value, name, props) => [
                      `${Number(value ?? 0).toFixed(4)} (${(props?.payload as { percent?: string })?.percent ?? '0'}%)`,
                      name,
                    ]}
                  />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* 2. Bar Chart - Asset comparison */}
        <div
          className="rounded-xl border border-slate-700/80 bg-slate-900/50 p-6 group-data-[theme=light]:border-slate-200 group-data-[theme=light]:bg-white/80"
          data-testid="chart-balance-bar"
          role="img"
          aria-label="Asset balance comparison"
        >
          <h3 className="text-sm font-medium text-slate-400 mb-4 group-data-[theme=light]:text-slate-600">
            Asset balance comparison
          </h3>
          {barData.length === 0 ? (
            <div className="h-48 flex items-center justify-center text-slate-500" data-testid="chart-empty-state">
              No assets
            </div>
          ) : (
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={barData} layout="vertical" margin={{ left: 0, right: 20 }}>
                  <XAxis type="number" hide />
                  <YAxis type="category" dataKey="asset" width={36} tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={tooltipStyle} formatter={(v) => [Number(v ?? 0).toFixed(4), 'Balance']} />
                  <Bar dataKey="balance" radius={[0, 4, 4, 0]} maxBarSize={28} fill="#10b981" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* 3. Progress bars - Portfolio health (HTML/CSS, no Recharts) */}
        <div
          className="rounded-xl border border-slate-700/80 bg-slate-900/50 p-6 group-data-[theme=light]:border-slate-200 group-data-[theme=light]:bg-white/80"
          data-testid="chart-progress"
          role="group"
          aria-label="Portfolio health indicator"
        >
          <h3 className="text-sm font-medium text-slate-400 mb-4 group-data-[theme=light]:text-slate-600">
            Portfolio health
          </h3>
          <div className="space-y-4">
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-slate-400">Total value target</span>
                <span className="text-slate-300" data-testid="progress-value">{portfolioPercent.toFixed(0)}%</span>
              </div>
              <div
                className="h-2 rounded-full bg-slate-700 overflow-hidden group-data-[theme=light]:bg-slate-200"
                role="progressbar"
                aria-valuenow={portfolioPercent}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label="Portfolio value progress"
              >
                <div
                  className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                  style={{ width: `${portfolioPercent}%` }}
                  data-testid="progress-bar"
                />
              </div>
            </div>
            <p className="text-xs text-slate-500">
              Est. value: ${totalBalance.toLocaleString(undefined, { maximumFractionDigits: 0 })}
            </p>
          </div>
        </div>
      </div>

      {/* Row 2: Line chart, Area chart, Radar chart */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {/* 4. Line Chart - Price trend (time series) */}
        <div
          className="rounded-xl border border-slate-700/80 bg-slate-900/50 p-6 group-data-[theme=light]:border-slate-200 group-data-[theme=light]:bg-white/80"
          data-testid="chart-line-trend"
          role="img"
          aria-label="7-day mock price trend"
        >
          <h3 className="text-sm font-medium text-slate-400 mb-4 group-data-[theme=light]:text-slate-600">
            Price trend (mock)
          </h3>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={MOCK_PRICE_DATA}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgb(51 65 85)" />
                <XAxis dataKey="day" tick={{ fontSize: 11 }} stroke="rgb(148 163 184)" />
                <YAxis tick={{ fontSize: 11 }} stroke="rgb(148 163 184)" />
                <Tooltip contentStyle={tooltipStyle} />
                <Line type="monotone" dataKey="price" stroke="#10b981" strokeWidth={2} dot={{ r: 3 }} name="Price" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* 5. Area Chart - Portfolio value over time */}
        <div
          className="rounded-xl border border-slate-700/80 bg-slate-900/50 p-6 group-data-[theme=light]:border-slate-200 group-data-[theme=light]:bg-white/80"
          data-testid="chart-area-portfolio"
          role="img"
          aria-label="Portfolio value over time"
        >
          <h3 className="text-sm font-medium text-slate-400 mb-4 group-data-[theme=light]:text-slate-600">
            Portfolio value (mock)
          </h3>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={MOCK_PORTFOLIO_DATA}>
                <defs>
                  <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#10b981" stopOpacity={0.4} />
                    <stop offset="100%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgb(51 65 85)" />
                <XAxis dataKey="week" tick={{ fontSize: 11 }} stroke="rgb(148 163 184)" />
                <YAxis tick={{ fontSize: 11 }} stroke="rgb(148 163 184)" />
                <Tooltip contentStyle={tooltipStyle} />
                <Area type="monotone" dataKey="value" stroke="#10b981" fill="url(#areaGradient)" name="Value ($)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* 6. Radar Chart - Asset allocation */}
        <div
          className="rounded-xl border border-slate-700/80 bg-slate-900/50 p-6 group-data-[theme=light]:border-slate-200 group-data-[theme=light]:bg-white/80"
          data-testid="chart-radar"
          role="img"
          aria-label="Asset allocation radar"
        >
          <h3 className="text-sm font-medium text-slate-400 mb-4 group-data-[theme=light]:text-slate-600">
            Asset allocation
          </h3>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart data={radarData}>
                <PolarGrid stroke="rgb(51 65 85)" />
                <PolarAngleAxis dataKey="subject" tick={{ fill: 'rgb(148 163 184)', fontSize: 11 }} />
                <PolarRadiusAxis angle={90} tick={{ fill: 'rgb(148 163 184)', fontSize: 10 }} />
                <Radar name="Allocation %" dataKey="value" stroke="#10b981" fill="#10b981" fillOpacity={0.3} />
                <Tooltip contentStyle={tooltipStyle} />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </section>
  );
}
