'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useAuth } from '@/lib/useAuth';
import { DepositCashForm } from '@/components/DepositCashForm';
import { DepositCryptoForm } from '@/components/DepositCryptoForm';

const panelBase =
  'rounded-xl border p-4 sm:p-5 transition-[border-color,box-shadow,opacity,background-color] duration-200 flex flex-col min-h-0 min-w-0 h-full';
const panelActive =
  'border-emerald-500/40 bg-slate-900/60 ring-1 ring-emerald-500/30 group-data-[theme=light]:border-emerald-300 group-data-[theme=light]:bg-white group-data-[theme=light]:ring-emerald-200 ' +
  'hover:border-emerald-500/60 hover:ring-emerald-500/50 hover:shadow-lg hover:shadow-emerald-500/10';
const panelInactive =
  'border-slate-700/60 bg-slate-900/30 opacity-55 group-data-[theme=light]:border-slate-200 group-data-[theme=light]:bg-slate-50/80 ' +
  'hover:opacity-95 hover:border-emerald-500/45 hover:ring-1 hover:ring-emerald-500/30 hover:bg-slate-900/50 hover:shadow-md hover:shadow-black/20 ' +
  'group-data-[theme=light]:hover:border-emerald-300 group-data-[theme=light]:hover:bg-emerald-50/70 group-data-[theme=light]:hover:shadow-emerald-900/5';

export default function AssetsDepositHubPage() {
  const { user, loading: authLoading } = useAuth(true);
  const [activeMode, setActiveMode] = useState<'cash' | 'crypto'>('cash');

  if (authLoading) {
    return (
      <main className="min-h-screen transition-colors duration-200 px-4 py-6 sm:px-6 sm:py-8">
        <div className="max-w-6xl mx-auto flex items-center justify-center py-24">
          <span className="text-slate-500 animate-pulse">Loading...</span>
        </div>
      </main>
    );
  }
  if (!user) return null;

  return (
    <main className="min-h-screen transition-colors duration-200 px-4 py-6 sm:px-6 sm:py-8">
      <div className="max-w-6xl mx-auto">
        <div className="mb-6">
          <Link
            href="/assets"
            className="text-slate-400 hover:text-white group-data-[theme=light]:hover:text-slate-900 transition-colors text-sm"
          >
            ← Back to My assets
          </Link>
        </div>

        <h1 className="text-2xl font-bold text-white group-data-[theme=light]:text-slate-900 mb-2">
          Deposit
        </h1>
        <p className="text-slate-400 group-data-[theme=light]:text-slate-600 mb-8 max-w-2xl">
          Add funds to your account. Select cash or crypto — the other side stays inactive until you switch.
        </p>

        <div className="grid gap-6 lg:grid-cols-2 lg:gap-8 lg:items-stretch">
          <section
            className={`${panelBase} ${activeMode === 'cash' ? panelActive : panelInactive} ${activeMode !== 'cash' ? 'cursor-pointer' : ''}`}
            onClick={() => {
              if (activeMode !== 'cash') setActiveMode('cash');
            }}
          >
            <button
              type="button"
              onClick={() => setActiveMode('cash')}
              className="text-left w-full mb-4 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900 group-data-[theme=light]:focus-visible:ring-offset-white"
            >
              <span className="block text-lg font-semibold text-white group-data-[theme=light]:text-slate-900">
                Deposit cash
              </span>
              <span className="block text-sm text-slate-400 mt-1 group-data-[theme=light]:text-slate-600">
                USD, EUR, and other fiat via card or SEPA
              </span>
            </button>
            <div className="flex-1 min-h-0 min-w-0 flex flex-col [&>div]:h-full [&>div]:min-h-0">
              <DepositCashForm disabled={activeMode !== 'cash'} />
            </div>
          </section>

          <section
            className={`${panelBase} ${activeMode === 'crypto' ? panelActive : panelInactive} ${activeMode !== 'crypto' ? 'cursor-pointer' : ''}`}
            onClick={() => {
              if (activeMode !== 'crypto') setActiveMode('crypto');
            }}
          >
            <button
              type="button"
              onClick={() => setActiveMode('crypto')}
              className="text-left w-full mb-4 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900 group-data-[theme=light]:focus-visible:ring-offset-white"
            >
              <span className="block text-lg font-semibold text-white group-data-[theme=light]:text-slate-900">
                Deposit crypto
              </span>
              <span className="block text-sm text-slate-400 mt-1 group-data-[theme=light]:text-slate-600">
                BTC, ETH, and more to your sandbox wallet
              </span>
            </button>
            <div className="flex-1 min-h-0 min-w-0 flex flex-col [&>div]:h-full [&>div]:min-h-0">
              <DepositCryptoForm disabled={activeMode !== 'crypto'} />
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
