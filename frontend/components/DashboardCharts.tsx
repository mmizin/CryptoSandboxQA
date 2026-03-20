'use client';

import { Fragment, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
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

const DEFAULT_VISIBLE_ORDER: AnalyticsBlockId[] = [...ANALYTICS_BLOCK_IDS];

const PORTFOLIO_ANALYTICS_ORDER_KEY = 'portfolio-analytics-block-order';
const PORTFOLIO_ANALYTICS_HIDDEN_KEY = 'portfolio-analytics-block-hidden';

const ANALYTICS_BLOCK_META: Record<AnalyticsBlockId, { title: string; blurb: string }> = {
  'balance-pie': { title: 'Balance distribution', blurb: 'Pie chart of wallet balances' },
  'balance-bar': { title: 'Asset balance comparison', blurb: 'Horizontal bars per asset' },
  'portfolio-health': { title: 'Portfolio health', blurb: 'Progress toward value target' },
  'line-trend': { title: 'Price trend (mock)', blurb: '7-day mock price line' },
  'area-portfolio': { title: 'Portfolio value (mock)', blurb: 'Area chart over weeks' },
  'radar-allocation': { title: 'Asset allocation', blurb: 'Radar mix USD / BTC / ETH' },
};

function sortIdsByCatalog(ids: AnalyticsBlockId[]) {
  return [...ids].sort((a, b) => ANALYTICS_BLOCK_IDS.indexOf(a) - ANALYTICS_BLOCK_IDS.indexOf(b));
}

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

/** Legacy: full permutation of all block ids (length 6). */
function isLegacyFullOrder(value: unknown): value is AnalyticsBlockId[] {
  if (!Array.isArray(value) || value.length !== ANALYTICS_BLOCK_IDS.length) {
    return false;
  }
  const set = new Set(value);
  if (set.size !== ANALYTICS_BLOCK_IDS.length) {
    return false;
  }
  return ANALYTICS_BLOCK_IDS.every((id) => set.has(id));
}

function isValidVisibleOrder(value: unknown): value is AnalyticsBlockId[] {
  if (!Array.isArray(value)) return false;
  const set = new Set(value);
  if (set.size !== value.length) return false;
  return value.every((id) => ANALYTICS_BLOCK_IDS.includes(id));
}

function isValidHiddenIds(value: unknown): value is AnalyticsBlockId[] {
  if (!Array.isArray(value)) return false;
  const set = new Set(value);
  if (set.size !== value.length) return false;
  return value.every((id) => ANALYTICS_BLOCK_IDS.includes(id));
}

function readPortfolioAnalyticsFromSession(): {
  visibleOrder: AnalyticsBlockId[];
  hiddenIds: AnalyticsBlockId[];
} {
  try {
    const rawOrder = sessionStorage.getItem(PORTFOLIO_ANALYTICS_ORDER_KEY);
    if (!rawOrder) {
      return { visibleOrder: [...DEFAULT_VISIBLE_ORDER], hiddenIds: [] };
    }
    const parsedOrder: unknown = JSON.parse(rawOrder);
    const rawHidden = sessionStorage.getItem(PORTFOLIO_ANALYTICS_HIDDEN_KEY);

    if (rawHidden == null && isLegacyFullOrder(parsedOrder)) {
      return { visibleOrder: parsedOrder, hiddenIds: [] };
    }

    if (!isValidVisibleOrder(parsedOrder)) {
      return { visibleOrder: [...DEFAULT_VISIBLE_ORDER], hiddenIds: [] };
    }

    if (rawHidden == null) {
      const vis = new Set(parsedOrder);
      return {
        visibleOrder: parsedOrder,
        hiddenIds: sortIdsByCatalog(ANALYTICS_BLOCK_IDS.filter((id) => !vis.has(id))),
      };
    }

    const parsedHidden: unknown = JSON.parse(rawHidden);
    const vis = new Set(parsedOrder);
    if (isValidHiddenIds(parsedHidden)) {
      const hiddenOnly = sortIdsByCatalog(parsedHidden.filter((id) => !vis.has(id)));
      const union = new Set([...parsedOrder, ...hiddenOnly]);
      const recover = ANALYTICS_BLOCK_IDS.filter((id) => !union.has(id));
      return {
        visibleOrder: recover.length ? [...parsedOrder, ...recover] : parsedOrder,
        hiddenIds: hiddenOnly,
      };
    }
    return {
      visibleOrder: parsedOrder,
      hiddenIds: sortIdsByCatalog(ANALYTICS_BLOCK_IDS.filter((id) => !vis.has(id))),
    };
  } catch {
    return { visibleOrder: [...DEFAULT_VISIBLE_ORDER], hiddenIds: [] };
  }
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
  customizeMode,
  onRemove,
  children,
}: {
  id: AnalyticsBlockId;
  title: string;
  testId: string;
  role?: AriaRole;
  ariaLabel: string;
  customizeMode: boolean;
  onRemove: () => void;
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
      className={`select-none rounded-xl border border-slate-700/80 bg-slate-900/50 p-6 outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50 group-data-[theme=light]:border-slate-200 group-data-[theme=light]:bg-white/80 cursor-grab touch-none active:cursor-grabbing motion-reduce:transition-none transition-[box-shadow,opacity,transform] duration-200 ${
        isDragging ? 'opacity-90 shadow-xl ring-2 ring-emerald-500/40' : ''
      } ${
        customizeMode
          ? 'ring-1 ring-slate-500/35 group-data-[theme=light]:ring-slate-300 group-data-[theme=light]:ring-slate-400/60'
          : ''
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
        {customizeMode && (
          <button
            type="button"
            data-testid={`remove-analytics-block-${id}`}
            aria-label={`Remove ${title} from dashboard`}
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              onRemove();
            }}
            className="shrink-0 rounded-md border border-transparent p-1.5 text-slate-400 hover:border-red-500/25 hover:bg-red-500/10 hover:text-red-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-500/40 group-data-[theme=light]:text-slate-500 group-data-[theme=light]:hover:border-red-200 group-data-[theme=light]:hover:bg-red-50 group-data-[theme=light]:hover:text-red-600"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>
      <div role={role} aria-label={ariaLabel}>
        {children}
      </div>
    </div>
  );
}

export function DashboardCharts({ wallets, loading = false }: DashboardChartsProps) {
  const [visibleOrder, setVisibleOrder] = useState<AnalyticsBlockId[]>(DEFAULT_VISIBLE_ORDER);
  const [hiddenIds, setHiddenIds] = useState<AnalyticsBlockId[]>([]);
  const [layoutHydrated, setLayoutHydrated] = useState(false);
  const [customizeMode, setCustomizeMode] = useState(false);
  const [addMenuOpen, setAddMenuOpen] = useState(false);
  const [undoRemove, setUndoRemove] = useState<{ id: AnalyticsBlockId; title: string } | null>(null);
  const addMenuRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const { visibleOrder: nextVisible, hiddenIds: nextHidden } = readPortfolioAnalyticsFromSession();
    setVisibleOrder(nextVisible);
    setHiddenIds(nextHidden);
    setLayoutHydrated(true);
  }, []);

  useEffect(() => {
    if (!layoutHydrated) return;
    try {
      sessionStorage.setItem(PORTFOLIO_ANALYTICS_ORDER_KEY, JSON.stringify(visibleOrder));
      sessionStorage.setItem(PORTFOLIO_ANALYTICS_HIDDEN_KEY, JSON.stringify(hiddenIds));
    } catch {
      /* sessionStorage unavailable */
    }
  }, [layoutHydrated, visibleOrder, hiddenIds]);

  useEffect(() => {
    if (!undoRemove) return;
    const t = window.setTimeout(() => setUndoRemove(null), 5000);
    return () => window.clearTimeout(t);
  }, [undoRemove]);

  useEffect(() => {
    if (!addMenuOpen) return;
    const onDown = (e: MouseEvent) => {
      const el = addMenuRef.current;
      if (el && !el.contains(e.target as Node)) setAddMenuOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [addMenuOpen]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 6 },
    }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const onDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setVisibleOrder((items) => {
      const oldIndex = items.indexOf(active.id as AnalyticsBlockId);
      const newIndex = items.indexOf(over.id as AnalyticsBlockId);
      if (oldIndex === -1 || newIndex === -1) return items;
      return arrayMove(items, oldIndex, newIndex);
    });
  };

  const shuffleBlocks = () => {
    setVisibleOrder((prev) => {
      if (prev.length === 0) return prev;
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

  const removeBlock = (id: AnalyticsBlockId) => {
    if (visibleOrder.length === 1) {
      if (
        !window.confirm(
          'Remove the last chart block? You can add it back with “Add block” when you’re done customizing.'
        )
      ) {
        return;
      }
    }
    setVisibleOrder((prev) => prev.filter((x) => x !== id));
    setHiddenIds((prev) => sortIdsByCatalog([...prev, id]));
    setUndoRemove({ id, title: ANALYTICS_BLOCK_META[id].title });
  };

  const addBlock = (id: AnalyticsBlockId) => {
    setHiddenIds((prev) => prev.filter((x) => x !== id));
    setVisibleOrder((prev) => [...prev, id]);
    setAddMenuOpen(false);
    setUndoRemove(null);
  };

  const undoLastRemove = () => {
    if (!undoRemove) return;
    const { id } = undoRemove;
    setHiddenIds((prev) => prev.filter((x) => x !== id));
    setVisibleOrder((prev) => (prev.includes(id) ? prev : [...prev, id]));
    setUndoRemove(null);
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
            customizeMode={customizeMode}
            onRemove={() => removeBlock(blockId)}
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
            customizeMode={customizeMode}
            onRemove={() => removeBlock(blockId)}
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
            customizeMode={customizeMode}
            onRemove={() => removeBlock(blockId)}
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
            customizeMode={customizeMode}
            onRemove={() => removeBlock(blockId)}
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
            customizeMode={customizeMode}
            onRemove={() => removeBlock(blockId)}
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
            customizeMode={customizeMode}
            onRemove={() => removeBlock(blockId)}
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
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <h2 className="text-xl font-semibold text-white group-data-[theme=light]:text-slate-900">Portfolio Analytics</h2>
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
          <button
            type="button"
            data-testid="customize-analytics-layout"
            aria-pressed={customizeMode}
            onClick={() => {
              setCustomizeMode((v) => !v);
              setAddMenuOpen(false);
            }}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors border-0 outline-none focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50 self-start sm:self-auto ${
              customizeMode
                ? 'ring-1 ring-emerald-500/30 bg-emerald-500/20 text-emerald-300 group-data-[theme=light]:bg-emerald-100 group-data-[theme=light]:text-emerald-800 group-data-[theme=light]:ring-emerald-400/40'
                : 'bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 hover:text-emerald-300 group-data-[theme=light]:bg-emerald-50 group-data-[theme=light]:text-emerald-700 group-data-[theme=light]:hover:bg-emerald-100 group-data-[theme=light]:hover:text-emerald-800'
            }`}
          >
            {customizeMode ? 'Done customizing' : 'Customize layout'}
          </button>

          <div className="relative self-start sm:self-auto" ref={addMenuRef}>
            <button
              type="button"
              data-testid="add-analytics-block-menu"
              aria-haspopup="menu"
              aria-expanded={addMenuOpen}
              disabled={hiddenIds.length === 0}
              title={hiddenIds.length === 0 ? 'All blocks are visible' : 'Add a hidden chart block'}
              onClick={() => setAddMenuOpen((o) => !o)}
              className="rounded-lg border border-slate-600 bg-slate-800/80 px-4 py-2 text-sm font-medium text-slate-200 outline-none transition-colors hover:bg-slate-800 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-500/50 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900 disabled:cursor-not-allowed disabled:opacity-45 group-data-[theme=light]:border-slate-300 group-data-[theme=light]:bg-white group-data-[theme=light]:text-slate-900 group-data-[theme=light]:hover:bg-slate-50 group-data-[theme=light]:focus-visible:ring-offset-white disabled:hover:bg-slate-800/80 group-data-[theme=light]:disabled:hover:bg-white"
            >
              Add block
            </button>
            {addMenuOpen && hiddenIds.length > 0 && (
              <div
                className="absolute right-0 z-20 mt-2 w-[min(100vw-2rem,20rem)] rounded-xl border border-slate-700/80 bg-slate-900/95 py-1 shadow-xl backdrop-blur-sm group-data-[theme=light]:border-slate-200 group-data-[theme=light]:bg-white"
                role="menu"
                aria-label="Hidden chart blocks"
              >
                <p className="px-3 pt-2 pb-1 text-xs font-medium text-slate-500 group-data-[theme=light]:text-slate-600">
                  Add back to grid
                </p>
                <ul className="max-h-64 overflow-y-auto py-1">
                  {hiddenIds.map((hid) => (
                    <li key={hid}>
                      <button
                        type="button"
                        role="menuitem"
                        data-testid={`add-analytics-block-${hid}`}
                        onClick={() => addBlock(hid)}
                        className="flex w-full flex-col items-start gap-0.5 px-3 py-2.5 text-left text-sm text-white hover:bg-slate-800 focus:outline-none focus-visible:bg-slate-800 group-data-[theme=light]:text-slate-900 group-data-[theme=light]:hover:bg-slate-100 group-data-[theme=light]:focus-visible:bg-slate-100"
                      >
                        <span className="font-medium text-slate-100 group-data-[theme=light]:text-slate-900">
                          {ANALYTICS_BLOCK_META[hid].title}
                        </span>
                        <span className="text-xs text-slate-400 group-data-[theme=light]:text-slate-600">
                          {ANALYTICS_BLOCK_META[hid].blurb}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={shuffleBlocks}
            disabled={visibleOrder.length < 2}
            data-testid="shuffle-analytics-blocks"
            className="rounded-lg px-4 py-2 text-sm font-medium transition-colors border-0 outline-none focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 hover:text-emerald-300 group-data-[theme=light]:bg-emerald-50 group-data-[theme=light]:text-emerald-700 group-data-[theme=light]:hover:bg-emerald-100 group-data-[theme=light]:hover:text-emerald-800 self-start sm:self-auto disabled:opacity-45 disabled:cursor-not-allowed"
          >
            Shuffle blocks
          </button>
        </div>
      </div>

      {undoRemove && (
        <div
          className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-700/80 bg-slate-900/50 px-4 py-3 text-sm text-slate-300 motion-safe:transition-opacity motion-safe:duration-200 group-data-[theme=light]:border-slate-200 group-data-[theme=light]:bg-white/90 group-data-[theme=light]:text-slate-700"
          data-testid="analytics-undo-remove"
          role="status"
        >
          <span>
            Removed “{undoRemove.title}”.{' '}
            <span className="text-slate-500 group-data-[theme=light]:text-slate-600">Undo within a few seconds.</span>
          </span>
          <button
            type="button"
            data-testid="analytics-undo-remove-button"
            onClick={undoLastRemove}
            className="shrink-0 rounded-lg border border-slate-600 bg-slate-800/80 px-3 py-1.5 text-sm font-medium text-slate-200 outline-none transition-colors hover:bg-slate-800 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-500/50 group-data-[theme=light]:border-slate-300 group-data-[theme=light]:bg-white group-data-[theme=light]:text-slate-900 group-data-[theme=light]:hover:bg-slate-50"
          >
            Undo
          </button>
        </div>
      )}

      <p className="text-xs text-slate-500 group-data-[theme=light]:text-slate-600">
        Turn on Customize layout to remove cards; use Add block to restore hidden ones. Drag any chart card to reorder (~6px
        to start); arrow keys work when a card is focused. Layout and visibility persist for this browser tab.
      </p>

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <SortableContext items={visibleOrder} strategy={rectSortingStrategy}>
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {visibleOrder.length === 0 ? (
              <div
                className="flex flex-col items-center justify-center gap-4 rounded-xl border border-dashed border-slate-600 bg-slate-900/30 py-16 text-center md:col-span-2 lg:col-span-3 group-data-[theme=light]:border-slate-300 group-data-[theme=light]:bg-slate-50/80"
                data-testid="analytics-blocks-empty"
              >
                <p className="max-w-sm text-sm text-slate-400 group-data-[theme=light]:text-slate-600">
                  No chart blocks on the dashboard. Add one from the menu above to bring analytics back.
                </p>
                <button
                  type="button"
                  data-testid="analytics-empty-add-block"
                  disabled={hiddenIds.length === 0}
                  onClick={() => hiddenIds.length > 0 && setAddMenuOpen(true)}
                  className="rounded-lg border border-slate-600 bg-slate-800/80 px-4 py-2 text-sm font-medium text-slate-200 outline-none transition-colors hover:bg-slate-800 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-500/50 disabled:cursor-not-allowed disabled:opacity-45 group-data-[theme=light]:border-slate-300 group-data-[theme=light]:bg-white group-data-[theme=light]:text-slate-900 group-data-[theme=light]:hover:bg-slate-50 disabled:hover:bg-slate-800/80 group-data-[theme=light]:disabled:hover:bg-white"
                >
                  Add a block
                </button>
              </div>
            ) : (
              visibleOrder.map((blockId) => (
                <Fragment key={blockId}>{renderAnalyticsBlock(blockId)}</Fragment>
              ))
            )}
          </div>
        </SortableContext>
      </DndContext>
    </section>
  );
}
