'use client';

import Link from 'next/link';
import { useAuth } from '@/lib/useAuth';
import { DepositCryptoForm } from '@/components/DepositCryptoForm';

export default function DepositCryptoPage() {
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
            href="/dashboard"
            className="text-slate-400 hover:text-white group-data-[theme=light]:hover:text-slate-900 transition-colors"
          >
            ← Back to Dashboard
          </Link>
        </div>
        <h1 className="text-2xl font-bold text-white group-data-[theme=light]:text-slate-900 mb-2">
          Deposit Crypto
        </h1>
        <p className="text-slate-400 group-data-[theme=light]:text-slate-600 mb-6">
          Deposit crypto (BTC, ETH, etc.) to your wallet. Backend integration coming soon.
        </p>
        <DepositCryptoForm />
      </div>
    </main>
  );
}
