'use client';

import Link from 'next/link';
import { useAuth } from '@/lib/useAuth';

export default function DepositCashPage() {
  const { user, loading: authLoading } = useAuth(true);

  if (authLoading) return <p style={{ padding: '2rem' }}>Loading...</p>;
  if (!user) return null;

  return (
    <main className="min-h-screen transition-colors duration-200" style={{ maxWidth: 600, margin: '0 auto', padding: '2rem' }}>
      <div style={{ marginBottom: '2rem' }}>
        <Link
          href="/dashboard"
          className="text-slate-400 hover:text-white group-data-[theme=light]:hover:text-slate-900"
        >
          ← Back to Dashboard
        </Link>
      </div>
      <h1 className="text-2xl font-bold mb-2">Deposit Cash</h1>
      <p className="text-slate-400 group-data-[theme=light]:text-slate-600 mb-6">
        Deposit cash (USD, EUR, etc.) to your account. Backend integration coming soon.
      </p>
      <div className="rounded-lg border border-slate-700 group-data-[theme=light]:border-slate-300 p-8 text-center text-slate-500 group-data-[theme=light]:text-slate-600">
        Placeholder — Deposit cash UI will be implemented with backend
      </div>
    </main>
  );
}
