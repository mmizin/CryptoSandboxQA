'use client';

import { useRouter } from 'next/navigation';
import { MarketsCryptoTable } from '@/components/MarketsCryptoTable';
import { useAuth } from '@/lib/useAuth';

export default function MarketsPricesPage() {
  const router = useRouter();
  const { user } = useAuth(false);

  const handleBack = () => {
    if (typeof window !== 'undefined' && window.history.length > 1) {
      router.back();
    } else {
      router.push(user ? '/dashboard' : '/');
    }
  };

  return (
    <main className="min-h-screen transition-colors duration-200 px-4 py-6 sm:px-6 lg:px-8">
      <div className="max-w-6xl mx-auto">
        <div className="mb-6">
          <button
            type="button"
            onClick={handleBack}
            className="rounded-lg px-4 py-2 text-sm font-medium flex items-center gap-1 transition-colors border-0 outline-none focus:outline-none bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 hover:text-emerald-300 group-data-[theme=light]:bg-emerald-50 group-data-[theme=light]:text-emerald-700 group-data-[theme=light]:hover:bg-emerald-100 group-data-[theme=light]:hover:text-emerald-800"
          >
            ← Back
          </button>
        </div>
        <h1 className="text-2xl font-bold text-white group-data-[theme=light]:text-slate-900 mb-2">
          Crypto Prices
        </h1>
        <p className="text-slate-400 group-data-[theme=light]:text-slate-600 mb-6">
          Live cryptocurrency prices from the market.
        </p>
        <MarketsCryptoTable defaultLimit={10} showPopularHighlight />
      </div>
    </main>
  );
}
