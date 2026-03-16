'use client';

import Link from 'next/link';
import { useAuth } from '@/lib/useAuth';
import { CryptoCalculatorForm } from '@/components/CryptoCalculatorForm';

export default function CalculatePage() {
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
          Crypto Calculator
        </h1>
        <p className="text-slate-400 group-data-[theme=light]:text-slate-600 mb-6">
          Convert between crypto and fiat currencies with real-time rates. Backend integration coming soon.
        </p>
        <CryptoCalculatorForm />
      </div>
    </main>
  );
}
