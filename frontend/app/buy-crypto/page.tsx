'use client';

import Link from 'next/link';
import { useAuth } from '@/lib/useAuth';
import { BuySellForm } from '@/components/BuySellForm';

export default function BuyCryptoPage() {
  const { user } = useAuth(false);
  return (
    <main className="min-h-screen transition-colors duration-200 px-4 py-6 sm:px-6 sm:py-8">
      <div className="max-w-2xl mx-auto">
        <div className="mb-6">
          <Link
            href={user ? '/dashboard' : '/'}
            className="text-slate-400 hover:text-white group-data-[theme=light]:hover:text-slate-900 transition-colors"
          >
            ← {user ? 'Back to Dashboard' : 'Back to home'}
          </Link>
        </div>
        <h1 className="text-2xl font-bold text-white group-data-[theme=light]:text-slate-900 mb-2">
          Buy and Sell
        </h1>
        <p className="text-slate-400 group-data-[theme=light]:text-slate-600 mb-6">
          Buy and sell crypto with SEPA, card, Apple Pay, and more. Backend integration coming soon.
        </p>
        <BuySellForm />
      </div>
    </main>
  );
}
