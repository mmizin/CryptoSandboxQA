'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/useAuth';
import { walletsApi, ordersApi } from '@/lib/api';
import { DashboardCharts } from '@/components/DashboardCharts';

export default function DashboardPage() {
  const { user, loading: authLoading } = useAuth(true);
  const [wallets, setWallets] = useState<Array<{ asset: string; balance: string }>>([]);
  const [walletsLoading, setWalletsLoading] = useState(true);
  const [orders, setOrders] = useState<unknown[]>([]);
  const [depositAsset, setDepositAsset] = useState('USD');
  const [depositAmount, setDepositAmount] = useState('');
  const [depositError, setDepositError] = useState('');
  const [depositLoading, setDepositLoading] = useState(false);

  useEffect(() => {
    if (!user) return;
    setWalletsLoading(true);
    walletsApi.list()
      .then(setWallets)
      .catch(console.error)
      .finally(() => setWalletsLoading(false));
    ordersApi.list({ status: 'open' }).then(setOrders).catch(console.error);
  }, [user]);

  const handleDeposit = async (e: React.FormEvent) => {
    e.preventDefault();
    const amt = parseFloat(depositAmount);
    if (isNaN(amt) || amt <= 0) return;
    setDepositError('');
    setDepositLoading(true);
    try {
      await walletsApi.deposit(depositAsset, amt);
      setDepositAmount('');
      walletsApi.list().then(setWallets);
    } catch (err) {
      setDepositError(err instanceof Error ? err.message : 'Deposit failed');
    } finally {
      setDepositLoading(false);
    }
  };

  if (authLoading) {
    return (
      <main className="min-h-screen transition-colors duration-200 px-4 py-8 sm:px-6 lg:px-8">
        <div className="max-w-6xl mx-auto flex items-center justify-center py-24">
          <span className="text-slate-500 animate-pulse">Loading...</span>
        </div>
      </main>
    );
  }
  if (!user) return null;

  const buttonBase =
    'rounded-lg px-4 py-2 text-sm font-medium transition-colors border-0 outline-none focus:outline-none bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 hover:text-emerald-300 group-data-[theme=light]:bg-emerald-50 group-data-[theme=light]:text-emerald-700 group-data-[theme=light]:hover:bg-emerald-100 group-data-[theme=light]:hover:text-emerald-800';

  const cardClass =
    'rounded-xl border border-slate-700/80 bg-slate-900/50 p-6 transition-colors group-data-[theme=light]:border-slate-200 group-data-[theme=light]:bg-white/80';
  const cardTitle =
    'text-lg font-semibold text-white mb-4 group-data-[theme=light]:text-slate-900';

  const quickActions = [
    { href: '/profile', label: 'Profile', desc: 'Edit your photo and account info' },
    { href: '/market', label: 'Trade spot', desc: 'Place orders on the market' },
    { href: '/markets/prices', label: 'View prices', desc: 'Crypto prices and rankings' },
    { href: '/buy-crypto', label: 'Buy crypto', desc: 'Buy and sell with ease' },
    { href: '/deposit-cash', label: 'Deposit cash', desc: 'Add funds to your balance' },
    { href: '/deposit-crypto', label: 'Deposit crypto', desc: 'Deposit BTC, ETH, etc. to your wallet' },
  ];

  return (
    <main className="min-h-screen transition-colors duration-200 px-4 py-8 sm:px-6 lg:px-8">
      <div className="max-w-6xl mx-auto">
        {/* Hero / Welcome */}
        <div className="mb-10">
          <h1 className="text-3xl font-bold text-white tracking-tight mb-2 group-data-[theme=light]:text-slate-900">
            Welcome back
          </h1>
          <p className="text-slate-400 group-data-[theme=light]:text-slate-600">
            {user.displayName || user.email} — Your secure crypto trading sandbox
          </p>
        </div>

        {/* Portfolio Analytics — Multiple chart types for QA testing */}
        <DashboardCharts wallets={wallets} loading={walletsLoading} />

        {/* Power your trading — OKX-style quick actions */}
        <section className="mb-10">
          <h2 className="text-xl font-semibold text-white mb-6 group-data-[theme=light]:text-slate-900">
            Power your trading
          </h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {quickActions.map((a) => (
              <Link
                key={a.href}
                href={a.href}
                className={`${cardClass} block hover:border-emerald-500/30 hover:bg-slate-800/50 group-data-[theme=light]:hover:border-emerald-300 group-data-[theme=light]:hover:bg-emerald-50/30 transition-colors`}
              >
                <span className="block font-medium text-white group-data-[theme=light]:text-slate-900">
                  {a.label}
                </span>
                <span className="block text-sm text-slate-400 mt-1 group-data-[theme=light]:text-slate-600">
                  {a.desc}
                </span>
              </Link>
            ))}
          </div>
        </section>

        {/* Wallets + Deposit side by side on desktop */}
        <div className="grid gap-6 lg:grid-cols-2 mb-10">
          <section className={cardClass}>
            <h2 className={cardTitle}>Wallets</h2>
            {wallets.length === 0 ? (
              <p className="text-slate-500 group-data-[theme=light]:text-slate-500">
                No wallets yet.
              </p>
            ) : (
              <div className="space-y-3">
                {wallets.map((w) => (
                  <div
                    key={w.asset}
                    className="flex items-center justify-between py-3 px-4 rounded-lg bg-slate-800/50 group-data-[theme=light]:bg-slate-100"
                  >
                    <span className="font-medium text-white group-data-[theme=light]:text-slate-900">
                      {w.asset}
                    </span>
                    <span className="font-mono text-slate-300 group-data-[theme=light]:text-slate-700">
                      {Number(w.balance).toFixed(8)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className={cardClass}>
            <h2 className={cardTitle}>Deposit (training)</h2>
            <p className="text-sm text-slate-400 mb-4 group-data-[theme=light]:text-slate-600">
              Add funds to test orders — no real money.
            </p>
            <form onSubmit={handleDeposit} className="space-y-4">
              <div className="flex gap-3 flex-wrap">
                <select
                  value={depositAsset}
                  onChange={(e) => setDepositAsset(e.target.value)}
                  className="rounded-lg border border-slate-600 bg-slate-800/80 px-3 py-2 text-sm text-white focus:border-emerald-500 focus:outline-none group-data-[theme=light]:border-slate-300 group-data-[theme=light]:bg-white group-data-[theme=light]:text-slate-900"
                >
                  <option value="USD">USD</option>
                  <option value="BTC">BTC</option>
                  <option value="ETH">ETH</option>
                </select>
                <input
                  type="number"
                  placeholder="Amount"
                  value={depositAmount}
                  onChange={(e) => setDepositAmount(e.target.value)}
                  step="any"
                  min="0"
                  required
                  className="rounded-lg border border-slate-600 bg-slate-800/80 px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-emerald-500 focus:outline-none w-32 group-data-[theme=light]:border-slate-300 group-data-[theme=light]:bg-white group-data-[theme=light]:text-slate-900"
                />
                <button type="submit" disabled={depositLoading} className={buttonBase}>
                  {depositLoading ? 'Depositing...' : 'Deposit'}
                </button>
              </div>
              {depositError && (
                <p className="text-sm text-red-400">{depositError}</p>
              )}
            </form>
          </section>
        </div>

        {/* Open Orders */}
        <section className={cardClass}>
          <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
            <h2 className={cardTitle}>Open Orders</h2>
            <div className="flex gap-2">
              <Link href="/market" className={buttonBase}>
                Market
              </Link>
              <Link href="/history" className={buttonBase}>
                History
              </Link>
            </div>
          </div>
          {orders.length === 0 ? (
            <p className="text-slate-500 group-data-[theme=light]:text-slate-500">
              No open orders.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-700/80 group-data-[theme=light]:border-slate-200">
                    <th className="text-left py-2 text-slate-400 group-data-[theme=light]:text-slate-600">
                      Side
                    </th>
                    <th className="text-left py-2 text-slate-400 group-data-[theme=light]:text-slate-600">
                      Symbol
                    </th>
                    <th className="text-left py-2 text-slate-400 group-data-[theme=light]:text-slate-600">
                      Qty
                    </th>
                    <th className="text-left py-2 text-slate-400 group-data-[theme=light]:text-slate-600">
                      Price
                    </th>
                    <th className="text-left py-2 text-slate-400 group-data-[theme=light]:text-slate-600">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {(
                    orders as Array<{
                      id: string;
                      symbol: string;
                      side: string;
                      quantity: string;
                      price: string | null;
                      status: string;
                    }>
                  ).map((o) => (
                    <tr
                      key={o.id}
                      className="border-b border-slate-800/80 group-data-[theme=light]:border-slate-100"
                    >
                      <td className="py-3 text-white group-data-[theme=light]:text-slate-900 capitalize">
                        {o.side}
                      </td>
                      <td className="py-3 text-slate-300 group-data-[theme=light]:text-slate-700">
                        {o.symbol}
                      </td>
                      <td className="py-3 text-slate-300 group-data-[theme=light]:text-slate-700">
                        {o.quantity}
                      </td>
                      <td className="py-3 text-slate-300 group-data-[theme=light]:text-slate-700">
                        {o.price ?? 'market'}
                      </td>
                      <td className="py-3 text-slate-400 group-data-[theme=light]:text-slate-600">
                        {o.status}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
