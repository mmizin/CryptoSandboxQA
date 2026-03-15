'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/useAuth';
import { walletsApi, ordersApi } from '@/lib/api';

export default function DashboardPage() {
  const { user, loading: authLoading, logout } = useAuth(true);
  const [wallets, setWallets] = useState<Array<{ asset: string; balance: string }>>([]);
  const [orders, setOrders] = useState<unknown[]>([]);
  const [depositAsset, setDepositAsset] = useState('USD');
  const [depositAmount, setDepositAmount] = useState('');
  const [depositError, setDepositError] = useState('');
  const [depositLoading, setDepositLoading] = useState(false);

  useEffect(() => {
    if (!user) return;
    walletsApi.list().then(setWallets).catch(console.error);
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

  if (authLoading) return <p style={{ padding: '2rem' }}>Loading...</p>;
  if (!user) return null;

  return (
    <main style={{ maxWidth: 600, margin: '0 auto', padding: '2rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <h1>Dashboard</h1>
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
          <span style={{ color: '#8b949e' }}>{user.email}</span>
          <Link href="/market">Market</Link>
          <Link href="/history">History</Link>
          <button onClick={logout} style={{ background: 'transparent', border: '1px solid #30363d' }}>Logout</button>
        </div>
      </div>

      <section style={{ marginBottom: '2rem' }}>
        <h2 style={{ marginBottom: '1rem' }}>Wallets</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {wallets.map((w) => (
            <div key={w.asset} style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
              <strong>{w.asset}:</strong>
              <span>{Number(w.balance).toFixed(8)}</span>
            </div>
          ))}
        </div>
      </section>

      <section style={{ marginBottom: '2rem' }}>
        <h2 style={{ marginBottom: '1rem' }}>Deposit (training)</h2>
        <form onSubmit={handleDeposit} style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <select
            value={depositAsset}
            onChange={(e) => setDepositAsset(e.target.value)}
            style={{ padding: '0.5rem', background: '#161b22', border: '1px solid #30363d', borderRadius: 6 }}
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
          />
          <button type="submit" disabled={depositLoading}>
            Deposit
          </button>
          {depositError && <span className="error">{depositError}</span>}
        </form>
      </section>

      <section>
        <h2 style={{ marginBottom: '1rem' }}>Open Orders</h2>
        {orders.length === 0 ? (
          <p style={{ color: '#8b949e' }}>No open orders.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {(orders as Array<{ id: string; symbol: string; side: string; quantity: string; price: string | null; status: string }>).map((o) => (
              <div key={o.id} style={{ display: 'flex', gap: '1rem', padding: '0.5rem 0' }}>
                <span>{o.side} {o.symbol}</span>
                <span>Qty: {o.quantity}</span>
                <span>Price: {o.price ?? 'market'}</span>
                <span>{o.status}</span>
              </div>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
