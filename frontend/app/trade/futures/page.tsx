'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/useAuth';
import { TradeCoinTable } from '@/components/TradeCoinTable';
import { TradePriceChart } from '@/components/TradePriceChart';
import { TradeOrderEntry } from '@/components/TradeOrderEntry';
import { TradeOrdersTabs } from '@/components/TradeOrdersTabs';
import { TRADE_COINS, type TradeCoin } from '@/lib/tradeMockData';

const buttonBase =
  'rounded-lg px-4 py-2 text-sm font-medium flex items-center gap-1 transition-colors border-0 outline-none focus:outline-none bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 hover:text-emerald-300 group-data-[theme=light]:bg-emerald-50 group-data-[theme=light]:text-emerald-700 group-data-[theme=light]:hover:bg-emerald-100 group-data-[theme=light]:hover:text-emerald-800';

export default function TradeFuturesPage() {
  const { user, loading: authLoading } = useAuth(true);
  const [selectedCoin, setSelectedCoin] = useState<TradeCoin | null>(
    () => TRADE_COINS[0] ?? null
  );
  const [ordersRefreshKey, setOrdersRefreshKey] = useState(0);

  if (authLoading) {
    return (
      <main className="min-h-screen transition-colors duration-200 px-4 py-8">
        <div className="max-w-6xl mx-auto flex items-center justify-center py-24">
          <span className="text-slate-500 animate-pulse">Loading...</span>
        </div>
      </main>
    );
  }
  if (!user) return null;

  return (
    <main className="min-h-screen transition-colors duration-200 px-4 py-6 sm:px-6 lg:px-8">
      <div className="max-w-6xl mx-auto">
        <div className="mb-6 flex flex-wrap items-center gap-4">
          <Link href="/dashboard" className={buttonBase}>
            ← Back
          </Link>
          <h1 className="text-2xl font-bold text-white group-data-[theme=light]:text-slate-900">
            Trade Futures
          </h1>
        </div>
        <p className="text-slate-400 group-data-[theme=light]:text-slate-600 mb-6">
          Select a coin to view chart and place orders. Orders use the same spot engine (BTC, ETH).
        </p>

        <div className="grid gap-6 lg:grid-cols-3 mb-6">
          <div className="lg:col-span-1">
            <TradeCoinTable selectedCoin={selectedCoin} onSelectCoin={setSelectedCoin} />
          </div>
          <div className="lg:col-span-2 space-y-4">
            <TradePriceChart coin={selectedCoin} />
            <TradeOrderEntry
              selectedCoin={selectedCoin}
              onOrderSubmitted={() => setOrdersRefreshKey((k) => k + 1)}
            />
          </div>
        </div>

        <TradeOrdersTabs refreshTrigger={ordersRefreshKey} />
      </div>
    </main>
  );
}
