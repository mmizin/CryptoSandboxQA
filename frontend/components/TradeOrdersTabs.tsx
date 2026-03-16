'use client';

import { useState, useMemo, useEffect, useCallback } from 'react';
import { type TradeOrder } from '@/lib/tradeMockData';
import { ordersApi } from '@/lib/api';

type Tab = 'active' | 'history';
type OrderStatus = 'open' | 'filled' | 'cancelled';

interface ApiOrder {
  id: string;
  symbol: string;
  side: string;
  type: string;
  quantity: string | number;
  price: string | number | null;
  filledQuantity?: string | number;
  status: string;
  createdAt: string;
}

function mapApiOrderToTradeOrder(o: ApiOrder): TradeOrder {
  const baseSymbol = o.symbol.includes('_') ? o.symbol.split('_')[0] : o.symbol;
  let status: OrderStatus = 'open';
  if (o.status === 'filled') status = 'filled';
  else if (o.status === 'partially_filled') status = 'open';
  else if (['cancelled', 'rejected', 'expired'].includes(o.status)) status = 'cancelled';

  return {
    id: o.id,
    symbol: baseSymbol,
    orderType: (o.type === 'market' ? 'market' : 'limit') as 'market' | 'limit' | 'stop-limit',
    side: o.side as 'buy' | 'sell',
    amount: typeof o.quantity === 'number' ? o.quantity : parseFloat(String(o.quantity)) || 0,
    price: o.price != null ? (typeof o.price === 'number' ? o.price : parseFloat(String(o.price))) : null,
    status,
    createdAt: typeof o.createdAt === 'string' ? o.createdAt : new Date(o.createdAt).toISOString(),
  };
}

interface TradeOrdersTabsProps {
  marketType?: 'spot' | 'futures';
  refreshTrigger?: number;
}

const buttonBase =
  'rounded-lg px-4 py-2 text-sm font-medium transition-colors border-0 outline-none focus:outline-none bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 hover:text-emerald-300 group-data-[theme=light]:bg-emerald-50 group-data-[theme=light]:text-emerald-700 group-data-[theme=light]:hover:bg-emerald-100 group-data-[theme=light]:hover:text-emerald-800';

const sortButtonBase =
  'rounded-lg px-3 py-1.5 text-sm font-medium flex items-center gap-1 transition-colors border-0 outline-none focus:outline-none bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 hover:text-emerald-300 group-data-[theme=light]:bg-emerald-50 group-data-[theme=light]:text-emerald-700 group-data-[theme=light]:hover:bg-emerald-100 group-data-[theme=light]:hover:text-emerald-800';

type SortField = 'symbol' | 'orderType' | 'amount' | 'price' | 'status' | 'createdAt';

export function TradeOrdersTabs({ marketType = 'spot', refreshTrigger }: TradeOrdersTabsProps) {
  const [orders, setOrders] = useState<TradeOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusChangingId, setStatusChangingId] = useState<string | null>(null);

  const loadOrders = useCallback(() => {
    setLoading(true);
    ordersApi
      .list({ marketType, limit: 100 })
      .then((res) => {
        const data = (res.data || []) as ApiOrder[];
        setOrders(data.map(mapApiOrderToTradeOrder));
      })
      .catch((err) => {
        setOrders([]);
        setError(err instanceof Error ? err.message : 'Failed to load orders');
      })
      .finally(() => setLoading(false));
  }, [marketType]);

  useEffect(() => {
    setError(null);
    loadOrders();
  }, [loadOrders, refreshTrigger]);

  const handleSetStatus = async (orderId: string, status: string) => {
    setStatusChangingId(orderId);
    try {
      await ordersApi.setStatus(orderId, status);
      loadOrders();
    } catch {
      setError('Failed to update order status');
    } finally {
      setStatusChangingId(null);
    }
  };

  const [activeTab, setActiveTab] = useState<Tab>('active');
  const [coinFilter, setCoinFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState<OrderStatus | ''>('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [sort, setSort] = useState<{ by: SortField; order: 'asc' | 'desc' }>({
    by: 'createdAt',
    order: 'desc',
  });

  const filteredOrders = useMemo(() => {
    let list = orders.filter((o) => {
      if (activeTab === 'active') return o.status === 'open';
      return true; // History: show all orders (open, filled, cancelled)
    });
    if (coinFilter) {
      list = list.filter((o) => o.symbol === coinFilter);
    }
    if (activeTab === 'history' && statusFilter) {
      list = list.filter((o) => o.status === statusFilter);
    }
    if (dateFrom) {
      const d = new Date(dateFrom).getTime();
      list = list.filter((o) => new Date(o.createdAt).getTime() >= d);
    }
    if (dateTo) {
      const d = new Date(dateTo).setHours(23, 59, 59, 999);
      list = list.filter((o) => new Date(o.createdAt).getTime() <= d);
    }
    list.sort((a, b) => {
      const aVal = a[sort.by] as string | number | null;
      const bVal = b[sort.by] as string | number | null;
      let cmp = 0;
      if (aVal == null && bVal == null) cmp = 0;
      else if (aVal == null) cmp = 1;
      else if (bVal == null) cmp = -1;
      else if (typeof aVal === 'number' && typeof bVal === 'number') cmp = aVal - bVal;
      else cmp = String(aVal).localeCompare(String(bVal));
      return sort.order === 'asc' ? cmp : -cmp;
    });
    return list;
  }, [orders, activeTab, coinFilter, statusFilter, dateFrom, dateTo, sort]);

  const handleSort = (field: SortField) => {
    setSort((prev) => {
      if (prev.by === field) {
        return { by: field, order: prev.order === 'asc' ? 'desc' : 'asc' };
      }
      return { by: field, order: 'desc' };
    });
  };

  const coins = useMemo(() => Array.from(new Set(orders.map((o) => o.symbol))).sort(), [orders]);

  const SortHeader = ({ field, label, align = 'left' }: { field: SortField; label: string; align?: 'left' | 'right' }) => {
    const active = sort.by === field;
    return (
      <button
        type="button"
        onClick={() => handleSort(field)}
        className={`${sortButtonBase} w-full min-w-0 ${align === 'right' ? 'justify-end' : 'justify-start'} ${active ? 'ring-1 ring-emerald-500/30' : ''}`}
      >
        {label}
        {active && <span className="shrink-0">{sort.order === 'asc' ? '↑' : '↓'}</span>}
      </button>
    );
  };

  return (
    <div className="rounded-xl border border-slate-700/80 bg-slate-900/50 overflow-hidden group-data-[theme=light]:border-slate-200 group-data-[theme=light]:bg-white/80">
      <div className="flex gap-2 p-4 border-b border-slate-700/80 group-data-[theme=light]:border-slate-200">
        <button
          type="button"
          onClick={() => setActiveTab('active')}
          className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors border-0 outline-none focus:outline-none ${
            activeTab === 'active'
              ? 'bg-emerald-500/20 text-emerald-300 group-data-[theme=light]:bg-emerald-100 group-data-[theme=light]:text-emerald-800'
              : 'bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 hover:text-emerald-300 group-data-[theme=light]:bg-emerald-50 group-data-[theme=light]:text-emerald-700 group-data-[theme=light]:hover:bg-emerald-100 group-data-[theme=light]:hover:text-emerald-800'
          }`}
        >
          Active Orders
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('history')}
          className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors border-0 outline-none focus:outline-none ${
            activeTab === 'history'
              ? 'bg-emerald-500/20 text-emerald-300 group-data-[theme=light]:bg-emerald-100 group-data-[theme=light]:text-emerald-800'
              : 'bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 hover:text-emerald-300 group-data-[theme=light]:bg-emerald-50 group-data-[theme=light]:text-emerald-700 group-data-[theme=light]:hover:bg-emerald-100 group-data-[theme=light]:hover:text-emerald-800'
          }`}
        >
          Order History
        </button>
      </div>
      <div className="p-4 border-b border-slate-700/80 group-data-[theme=light]:border-slate-200">
        <div className="flex flex-wrap gap-3">
          <select
            value={coinFilter}
            onChange={(e) => setCoinFilter(e.target.value)}
            className="rounded-lg border border-slate-600 bg-slate-800/80 px-3 py-2 text-sm text-white focus:border-emerald-500 focus:outline-none w-32 group-data-[theme=light]:border-slate-300 group-data-[theme=light]:bg-white group-data-[theme=light]:text-slate-900"
          >
            <option value="">All coins</option>
            {coins.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          {activeTab === 'history' && (
            <>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as OrderStatus | '')}
                className="rounded-lg border border-slate-600 bg-slate-800/80 px-3 py-2 text-sm text-white focus:border-emerald-500 focus:outline-none w-36 group-data-[theme=light]:border-slate-300 group-data-[theme=light]:bg-white group-data-[theme=light]:text-slate-900"
              >
                <option value="">All statuses</option>
                <option value="open">Open</option>
                <option value="filled">Completed</option>
                <option value="cancelled">Cancelled</option>
              </select>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="rounded-lg border border-slate-600 bg-slate-800/80 px-3 py-2 text-sm text-white focus:border-emerald-500 focus:outline-none group-data-[theme=light]:border-slate-300 group-data-[theme=light]:bg-white group-data-[theme=light]:text-slate-900"
              />
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="rounded-lg border border-slate-600 bg-slate-800/80 px-3 py-2 text-sm text-white focus:border-emerald-500 focus:outline-none group-data-[theme=light]:border-slate-300 group-data-[theme=light]:bg-white group-data-[theme=light]:text-slate-900"
              />
            </>
          )}
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-700/80 group-data-[theme=light]:border-slate-200">
              <th className="text-left py-3 px-4 font-medium text-slate-400 group-data-[theme=light]:text-slate-600">
                <SortHeader field="symbol" label="Coin" />
              </th>
              <th className="text-left py-3 px-4 font-medium text-slate-400 group-data-[theme=light]:text-slate-600">
                <SortHeader field="orderType" label="Order Type" />
              </th>
              <th className="text-right py-3 px-4 font-medium text-slate-400 group-data-[theme=light]:text-slate-600">
                <SortHeader field="amount" label="Amount" align="right" />
              </th>
              <th className="text-right py-3 px-4 font-medium text-slate-400 group-data-[theme=light]:text-slate-600">
                <SortHeader field="price" label="Price" align="right" />
              </th>
              <th className="text-left py-3 px-4 font-medium text-slate-400 group-data-[theme=light]:text-slate-600">
                <SortHeader field="status" label="Status" />
              </th>
              <th className="text-right py-3 px-4 font-medium text-slate-400 group-data-[theme=light]:text-slate-600">
                <SortHeader field="createdAt" label="Date" align="right" />
              </th>
              <th className="text-left py-3 px-4 font-medium text-slate-400 group-data-[theme=light]:text-slate-600">
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {!loading && filteredOrders.map((o) => (
              <tr
                key={o.id}
                className="border-b border-slate-800/80 hover:bg-slate-800/60 group-data-[theme=light]:border-slate-100 group-data-[theme=light]:hover:bg-slate-50"
              >
                <td className="py-3 px-4 text-left font-medium text-white group-data-[theme=light]:text-slate-900">
                  {o.symbol}
                </td>
                <td className="py-3 px-4 text-left text-slate-300 group-data-[theme=light]:text-slate-700 capitalize">
                  {o.orderType.replace('-', ' ')}
                </td>
                <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-300 group-data-[theme=light]:text-slate-700">
                  {typeof o.amount === 'number' ? o.amount.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 8 }) : o.amount}
                </td>
                <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-300 group-data-[theme=light]:text-slate-700">
                  {o.price != null ? o.price.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 }) : 'Market'}
                </td>
                <td className="py-3 px-4 text-left">
                  <span
                    className={`capitalize ${
                      o.status === 'open'
                        ? 'text-amber-400'
                        : o.status === 'filled'
                          ? 'text-emerald-400'
                          : 'text-red-400'
                    }`}
                  >
                    {o.status}
                  </span>
                </td>
                <td className="py-3 px-4 text-right text-slate-400 group-data-[theme=light]:text-slate-600 text-xs tabular-nums whitespace-nowrap">
                  {new Date(o.createdAt).toLocaleString()}
                </td>
                <td className="py-3 px-4">
                  {(o.status === 'open' || o.status === 'cancelled') && (
                    <select
                      value=""
                      onChange={(e) => {
                        const v = e.target.value;
                        if (v) handleSetStatus(o.id, v);
                        e.target.value = '';
                      }}
                      disabled={statusChangingId === o.id}
                      className="rounded border border-slate-600 bg-slate-800/80 px-2 py-1 text-xs text-white focus:border-emerald-500 focus:outline-none group-data-[theme=light]:border-slate-300 group-data-[theme=light]:bg-white group-data-[theme=light]:text-slate-900"
                    >
                      <option value="">Set status…</option>
                      {o.status === 'open' && (
                        <>
                          <option value="filled">Mark Filled</option>
                          <option value="cancelled">Cancel</option>
                        </>
                      )}
                      {o.status === 'cancelled' && <option value="open">Reopen</option>}
                    </select>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {error && (
        <div className="p-8 text-center text-red-400 group-data-[theme=light]:text-red-600">
          {error}
        </div>
      )}
      {loading && !error && (
        <div className="p-8 text-center text-slate-500 group-data-[theme=light]:text-slate-500">
          Loading orders...
        </div>
      )}
      {!loading && !error && filteredOrders.length === 0 && (
        <div className="p-8 text-center text-slate-500 group-data-[theme=light]:text-slate-500">
          No orders found
        </div>
      )}
    </div>
  );
}
