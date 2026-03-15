'use client';

import Link from 'next/link';
import { useAuth } from '@/lib/useAuth';

export default function BuyCryptoPage() {
  const { user } = useAuth(false);
  return (
    <main className="min-h-screen transition-colors duration-200" style={{ maxWidth: 600, margin: '0 auto', padding: '2rem' }}>
      <div style={{ marginBottom: '2rem' }}>
        <Link
          href={user ? '/dashboard' : '/'}
          className="text-slate-400 hover:text-white group-data-[theme=light]:hover:text-slate-900"
        >
          ← {user ? 'Back to Dashboard' : 'Back to home'}
        </Link>
      </div>
      <h1 className="text-2xl font-bold mb-2">Buy and Sell</h1>
      <p className="text-slate-400 group-data-[theme=light]:text-slate-600 mb-6">
        Buy and sell crypto with SEPA, card, Apple Pay, and more. Backend integration coming soon.
      </p>
      <div className="rounded-lg border border-slate-700 group-data-[theme=light]:border-slate-300 p-8 text-center text-slate-500 group-data-[theme=light]:text-slate-600">
        Placeholder — Buy/Sell UI will be implemented with backend
      </div>
    </main>
  );
}
