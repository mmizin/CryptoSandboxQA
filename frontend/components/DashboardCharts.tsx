'use client';

import { Fragment, useEffect, useMemo, useState } from 'react';
import type { AriaRole } from 'react';
import {
  DndContext,
  type DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  rectSortingStrategy,
  sortableKeyboardCoordinates,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
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

const ANALYTICS_BLOCK_IDS = [
  'balance-pie',
  'balance-bar',
  'portfolio-health',
  'line-trend',
  'area-portfolio',
  'radar-allocation',
] as const;

type AnalyticsBlockId = (typeof ANALYTICS_BLOCK_IDS)[number];

const DEFAULT_ANALYTICS_ORDER: AnalyticsBlockId[] = [...ANALYTICS_BLOCK_IDS];

const PORTFOLIO_ANALYTICS_ORDER_KEY = 'portfolio-analytics-block-order';

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

function isValidAnalyticsOrder(value: unknown): value is AnalyticsBlockId[] {
  if (!Array.isArray(value) || value.length !== ANALYTICS_BLOCK_IDS.length) {
    return false;
  }
  const set = new Set(value);
  if (set.size !== ANALYTICS_BLOCK_IDS.length) {
    return false;
  }
  return ANALYTICS_BLOCK_IDS.every((id) => set.has(id));
}

function shuffleAnalyticsOrder(order: AnalyticsBlockId[]): AnalyticsBlockId[] {
  const next = [...order];
  for (let i = next.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [next[i], next[j]] = [next[j], next[i]];
  }
  return next;
}

function DragHandleIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <circle cx="9" cy="6" r="1.5" />
      <circle cx="15" cy="6" r="1.5" />
      <circle cx="9" cy="12" r="1.5" />
      <circle cx="15" cy="12" r="1.5" />
      <circle cx="9" cy="18" r="1.5" />
      <circle cx="15" cy="18" r="1.5" />
    </svg>
  );
}

function SortableAnalyticsBlock({
  id,
  title,
  testId,
  role,
  ariaLabel,
  children,
}: {
  id: AnalyticsBlockId;
  title: string;
  testId: string;
  role?: AriaRole;
  ariaLabel: string;
  children: React.ReactNode;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
  });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 1 : undefined,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      data-testid={testId}
      {...attributes}
      {...listeners}
      aria-label={`Drag to reorder: ${title}. ${ariaLabel}`}
      className={`select-none rounded-xl border border-slate-700/80 bg-slate-900/50 p-6 outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50 group-data-[theme=light]:border-slate-200 group-data-[theme=light]:bg-white/80 cursor-grab touch-none active:cursor-grabbing ${
        isDragging ? 'opacity-90 shadow-xl ring-2 ring-emerald-500/40' : ''
      }`}
    >
      <div className="mb-4 flex items-center gap-2">
        <span
          className="shrink-0 rounded p-1.5 text-slate-500 group-data-[theme=light]:text-slate-500"
          aria-hidden
        >
          <DragHandleIcon />
        </span>
        <h3 className="min-w-0 flex-1 text-sm font-medium text-slate-400 group-data-[theme=light]:text-slate-600">
          {title}
        </h3>
      </div>
      <div role={role} aria-label={ariaLabel}>
        {children}
      </div>
    </div>
  );
}

export function DashboardCharts({ wallets, loading = false }: DashboardChartsProps) {
  const [analyticsOrder, setAnalyticsOrder] = useState<AnalyticsBlockId[]>(DEFAULT_ANALYTICS_ORDER);

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(PORTFOLIO_ANALYTICS_ORDER_KEY);
      if (!raw) return;
      const parsed: unknown = JSON.parse(raw);
      if (isValidAnalyticsOrder(parsed)) {
        setAnalyticsOrder(parsed);
      }
    } catch {
      /* ignore corrupt storage */
    }
  }, []);

  useEffect(() => {
    try {
      sessionStorage.setItem(PORTFOLIO_ANALYTICS_ORDER_KEY, JSON.stringify(analyticsOrder));
    } catch {
      /* sessionStorage unavailable */
    }
  }, [analyticsOrder]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 6 },
    }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const onDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setAnalyticsOrder((items) => {
      const oldIndex = items.indexOf(active.id as AnalyticsBlockId);
      const newIndex = items.indexOf(over.id as AnalyticsBlockId);
      if (oldIndex === -1 || newIndex === -1) return items;
      return arrayMove(items, oldIndex, newIndex);
    });
  };

  const shuffleBlocks = () => {
    setAnalyticsOrder((prev) => {
      let next = shuffleAnalyticsOrder(prev);
      if (prev.length > 1) {
        let guard = 0;
        while (next.every((id, i) => id === prev[i]) && guard < 8) {
          next = shuffleAnalyticsOrder(prev);
          guard += 1;
        }
      }
      return next;
    });
  };

  const pieData = useMemo(() => {
    const values = wallets.map((w) => Math.max(0, parseFloat(w.balance)));
    const total = values.reduce((s, v) => s + v, 0) || 1;
    return wallets
      .map((w, i) => ({
        name: w.asset,
        value: Math.max(0, parseFloat(w.balance)),
        percent: total > 0 ? ((values[i] / total) * 100).toFixed(1) : '0',
        fill: CHART_COLORS[i % CHART_COLORS.length],
      }))
      .filter((d) => d.value > 0);
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
      {
        subject: 'USD',
        value: total > 0 ? (parseFloat(usd?.balance || '0') / total) * 100 : 0,
        fullMark: 100,
      },
      {
        subject: 'BTC',
        value: total > 0 ? ((parseFloat(btc?.balance || '0') * 50000) / total) * 100 : 0,
        fullMark: 100,
      },
      {
        subject: 'ETH',
        value: total > 0 ? ((parseFloat(eth?.balance || '0') * 3000) / total) * 100 : 0,
        fullMark: 100,
      },
    ];
  }, [wallets]);

  const totalBalance = useMemo(() => {
    const usd = wallets.find((w) => w.asset === 'USD');
    const btc = wallets.find((w) => w.asset === 'BTC');
    const eth = wallets.find((w) => w.asset === 'ETH');
    return (
      parseFloat(usd?.balance || '0') +
      parseFloat(btc?.balance || '0') * 50000 +
      parseFloat(eth?.balance || '0') * 3000
    );
  }, [wallets]);

  const portfolioPercent = Math.min(100, Math.max(0, (totalBalance / 15000) * 100));

  const renderAnalyticsBlock = (blockId: AnalyticsBlockId) => {
    switch (blockId) {
      case 'balance-pie':
        return (
          <SortableAnalyticsBlock
            id={blockId}
            title="Balance distribution"
            testId="chart-balance-pie"
            role="img"
            ariaLabel="Wallet balance distribution"
          >
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
                      {pieData.map((e) => (
                        <Cell
                          key={e.name}
                          fill={e.fill}
                          stroke="transparent"
                          data-testid={`pie-segment-${e.name}`}
                        />
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
          </SortableAnalyticsBlock>
        );
      case 'balance-bar':
        return (
          <SortableAnalyticsBlock
            id={blockId}
            title="Asset balance comparison"
            testId="chart-balance-bar"
            role="img"
            ariaLabel="Asset balance comparison"
          >
            {barData.length === 0 ? (
              <div className="h-48 flex items-center justify-center text-slate-500" data-testid="chart-empty-state">
                No assets
              </div>
            ) : (
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={barData} layout="vertical" margin={{ left: 0, right: 20 }}>
                    <XAxis type="number" hide />
                    <YAxis
                      type="category"
                      dataKey="asset"
                      width={36}
                      tick={{ fontSize: 12 }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip contentStyle={tooltipStyle} formatter={(v) => [Number(v ?? 0).toFixed(4), 'Balance']} />
                    <Bar dataKey="balance" radius={[0, 4, 4, 0]} maxBarSize={28} fill="#10b981" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </SortableAnalyticsBlock>
        );
      case 'portfolio-health':
        return (
          <SortableAnalyticsBlock
            id={blockId}
            title="Portfolio health"
            testId="chart-progress"
            role="group"
            ariaLabel="Portfolio health indicator"
          >
            <div className="space-y-4">
              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-slate-400">Total value target</span>
                  <span className="text-slate-300" data-testid="progress-value">
                    {portfolioPercent.toFixed(0)}%
                  </span>
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
          </SortableAnalyticsBlock>
        );
      case 'line-trend':
        return (
          <SortableAnalyticsBlock
            id={blockId}
            title="Price trend (mock)"
            testId="chart-line-trend"
            role="img"
            ariaLabel="7-day mock price trend"
          >
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
          </SortableAnalyticsBlock>
        );
      case 'area-portfolio':
        return (
          <SortableAnalyticsBlock
            id={blockId}
            title="Portfolio value (mock)"
            testId="chart-area-portfolio"
            role="img"
            ariaLabel="Portfolio value over time"
          >
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
          </SortableAnalyticsBlock>
        );
      case 'radar-allocation':
        return (
          <SortableAnalyticsBlock
            id={blockId}
            title="Asset allocation"
            testId="chart-radar"
            role="img"
            ariaLabel="Asset allocation radar"
          >
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
          </SortableAnalyticsBlock>
        );
      default: {
        const _exhaustive: never = blockId;
        return _exhaustive;
      }
    }
  };

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
      className="mb-10 space-y-6"
      data-testid="dashboard-charts"
      role="region"
      aria-label="Portfolio analytics and charts"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-xl font-semibold text-white group-data-[theme=light]:text-slate-900">Portfolio Analytics</h2>
        <button
          type="button"
          onClick={shuffleBlocks}
          data-testid="shuffle-analytics-blocks"
          className="rounded-lg px-4 py-2 text-sm font-medium transition-colors border-0 outline-none focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 hover:text-emerald-300 group-data-[theme=light]:bg-emerald-50 group-data-[theme=light]:text-emerald-700 group-data-[theme=light]:hover:bg-emerald-100 group-data-[theme=light]:hover:text-emerald-800 self-start sm:self-auto"
        >
          Shuffle blocks
        </button>
      </div>

      <p className="text-xs text-slate-500 group-data-[theme=light]:text-slate-600">
        Drag any chart card by its background, title, grip, or chart area to reorder (move ~6px to start). Focus a card and
        use arrow keys to move. Order is kept for this browser tab session.
      </p>

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <SortableContext items={analyticsOrder} strategy={rectSortingStrategy}>
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {analyticsOrder.map((blockId) => (
              <Fragment key={blockId}>{renderAnalyticsBlock(blockId)}</Fragment>
            ))}
          </div>
        </SortableContext>
      </DndContext>
    </section>
  );
}
