'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/useAuth';
import { portfolioApi } from '@/lib/api';

const cardClass =
  'rounded-xl border border-slate-700/80 bg-slate-900/50 p-6 transition-colors group-data-[theme=light]:border-slate-200 group-data-[theme=light]:bg-white/80';

function formatPrice(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

export default function PortfolioPage() {
  const { user, loading: authLoading } = useAuth(true);
  const [summary, setSummary] = useState<{
    totalValueUsd: string;
    assets: Array<{ symbol: string; amount: string; priceUsd: string; valueUsd: string }>;
  } | null>(null);

  useEffect(() => {
    if (!user) return;
    portfolioApi.getSummary().then(setSummary).catch(console.error);
  }, [user]);

  if (authLoading) return <p className="p-8">Loading...</p>;
  if (!user) return null;

  const totalValue = summary ? parseFloat(summary.totalValueUsd) : 0;
  const assets = summary?.assets ?? [];

  return (
    <main className="min-h-screen transition-colors duration-200 px-4 py-8 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        <div className="mb-6">
          <Link
            href="/profile"
            className="text-sm text-slate-400 hover:text-white transition-colors group-data-[theme=light]:hover:text-slate-900"
          >
            ← Back to Profile
          </Link>
        </div>

        <h1 className="text-2xl font-bold text-white mb-6 group-data-[theme=light]:text-slate-900">
          Portfolio
        </h1>

        <section className={cardClass}>
          <div className="mb-4">
            <span className="text-sm text-slate-400 group-data-[theme=light]:text-slate-600">Total value</span>
            <p className="text-xl font-semibold text-emerald-400 group-data-[theme=light]:text-emerald-600">
              {formatPrice(totalValue)}
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-700/80 group-data-[theme=light]:border-slate-200">
                  <th className="text-left py-3 px-2 text-slate-400 group-data-[theme=light]:text-slate-600 font-medium">
                    Coin
                  </th>
                  <th className="text-right py-3 px-2 text-slate-400 group-data-[theme=light]:text-slate-600 font-medium">
                    Amount
                  </th>
                  <th className="text-right py-3 px-2 text-slate-400 group-data-[theme=light]:text-slate-600 font-medium">
                    Current price
                  </th>
                  <th className="text-right py-3 px-2 text-slate-400 group-data-[theme=light]:text-slate-600 font-medium">
                    Total value
                  </th>
                </tr>
              </thead>
              <tbody>
                {assets.map((h) => (
                  <tr
                    key={h.symbol}
                    className="border-b border-slate-800/80 group-data-[theme=light]:border-slate-100 last:border-0"
                  >
                    <td className="py-3 px-2 font-medium text-white group-data-[theme=light]:text-slate-900">
                      {h.symbol}
                    </td>
                    <td className="py-3 px-2 text-right text-slate-300 group-data-[theme=light]:text-slate-700">
                      {parseFloat(h.amount).toLocaleString()}
                    </td>
                    <td className="py-3 px-2 text-right text-slate-300 group-data-[theme=light]:text-slate-700">
                      {formatPrice(parseFloat(h.priceUsd))}
                    </td>
                    <td className="py-3 px-2 text-right font-medium text-emerald-400 group-data-[theme=light]:text-emerald-600">
                      {formatPrice(parseFloat(h.valueUsd))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </main>
  );
}
