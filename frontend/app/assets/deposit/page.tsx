'use client';

import Link from 'next/link';
import { useAuth } from '@/lib/useAuth';

const cardClass =
  'rounded-xl border border-slate-700/80 bg-slate-900/50 p-6 transition-colors group-data-[theme=light]:border-slate-200 group-data-[theme=light]:bg-white/80 hover:border-emerald-500/30 hover:bg-slate-800/50 group-data-[theme=light]:hover:border-emerald-300 group-data-[theme=light]:hover:bg-emerald-50/30';

const ctaTitle = 'block font-medium text-white group-data-[theme=light]:text-slate-900';
const ctaDesc = 'block text-sm text-slate-400 mt-1 group-data-[theme=light]:text-slate-600';

export default function AssetsDepositHubPage() {
  const { user, loading: authLoading } = useAuth(true);

  if (authLoading) {
    return (
      <main className="min-h-screen transition-colors duration-200 px-4 py-6 sm:px-6 sm:py-8">
        <div className="max-w-2xl mx-auto flex items-center justify-center py-24">
          <span className="text-slate-500 animate-pulse">Loading...</span>
        </div>
      </main>
    );
  }
  if (!user) return null;

  return (
    <main className="min-h-screen transition-colors duration-200 px-4 py-6 sm:px-6 sm:py-8">
      <div className="max-w-2xl mx-auto">
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
        <p className="text-slate-400 group-data-[theme=light]:text-slate-600 mb-8">
          Add funds to your account. Choose fiat or crypto — same flows as the dedicated deposit pages.
        </p>

        <div className="grid gap-4 sm:grid-cols-2">
          <Link href="/deposit-cash" className={`${cardClass} block transition-colors`}>
            <span className={ctaTitle}>Deposit cash</span>
            <span className={ctaDesc}>USD, EUR, and other fiat via card or SEPA</span>
          </Link>
          <Link href="/deposit-crypto" className={`${cardClass} block transition-colors`}>
            <span className={ctaTitle}>Deposit crypto</span>
            <span className={ctaDesc}>BTC, ETH, and more to your sandbox wallet</span>
          </Link>
        </div>
      </div>
    </main>
  );
}
