'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/useAuth';
import { ordersApi } from '@/lib/api';

export default function HistoryPage() {
  const { user, loading: authLoading } = useAuth(true);
  const [orders, setOrders] = useState<unknown[]>([]);

  useEffect(() => {
    if (!user) return;
    ordersApi.list().then(setOrders).catch(console.error);
  }, [user]);

  if (authLoading) return <p style={{ padding: '2rem' }}>Loading...</p>;
  if (!user) return null;

  return (
    <main style={{ maxWidth: 700, margin: '0 auto', padding: '2rem' }}>
      <div style={{ marginBottom: '2rem' }}>
        <Link href="/dashboard">Back to Dashboard</Link>
      </div>
      <h1>Order History</h1>
      {Array.isArray(orders) && orders.length === 0 ? (
        <p style={{ color: '#8b949e', marginTop: '1rem' }}>No orders.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '1rem' }}>
          {(orders as Array<{ id: string; symbol: string; side: string; type: string; quantity: string; filledQuantity: string; price: string | null; status: string; createdAt: string }>).map((o) => (
            <div key={o.id} style={{ padding: '1rem', border: '1px solid #30363d', borderRadius: 6 }}>
              <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                <span><strong>{o.side}</strong> {o.symbol}</span>
                <span>{o.type}</span>
                <span>Qty: {o.quantity} (filled: {o.filledQuantity})</span>
                <span>Price: {o.price ?? 'market'}</span>
                <span style={{ color: o.status === 'filled' ? '#3fb950' : o.status === 'cancelled' ? '#f85149' : '#8b949e' }}>{o.status}</span>
              </div>
              <div style={{ fontSize: '0.85rem', color: '#8b949e', marginTop: '0.5rem' }}>
                {new Date(o.createdAt).toLocaleString()}
              </div>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
