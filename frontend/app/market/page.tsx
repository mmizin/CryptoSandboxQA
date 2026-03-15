'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/useAuth';
import { ordersApi } from '@/lib/api';
import { useTicker } from '@/lib/useTicker';

export default function MarketPage() {
  const { user, loading: authLoading } = useAuth(true);
  const [symbol, setSymbol] = useState('BTC_USD');
  const [side, setSide] = useState<'buy' | 'sell'>('buy');
  const [orderType, setOrderType] = useState<'limit' | 'market'>('limit');
  const [quantity, setQuantity] = useState('');
  const [price, setPrice] = useState('');
  const [error, setError] = useState('');
  const [submitLoading, setSubmitLoading] = useState(false);
  const [orders, setOrders] = useState<unknown[]>([]);

  const ticker = useTicker(symbol);

  useEffect(() => {
    if (!user) return;
    ordersApi.list({ symbol }).then(setOrders).catch(console.error);
  }, [user, symbol]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const qty = parseFloat(quantity);
    if (isNaN(qty) || qty <= 0) return;
    if (orderType === 'limit' && (!price || parseFloat(price) <= 0)) {
      setError('Limit orders require a price');
      return;
    }
    setError('');
    setSubmitLoading(true);
    try {
      await ordersApi.create({
        symbol,
        side,
        type: orderType,
        quantity: qty,
        price: orderType === 'limit' ? parseFloat(price) : undefined,
      });
      setQuantity('');
      setPrice('');
      ordersApi.list({ symbol }).then(setOrders);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Order failed');
    } finally {
      setSubmitLoading(false);
    }
  };

  if (authLoading) return <p style={{ padding: '2rem' }}>Loading...</p>;
  if (!user) return null;

  return (
    <main className="min-h-screen transition-colors duration-200" style={{ maxWidth: 700, margin: '0 auto', padding: '2rem' }}>
      <div style={{ marginBottom: '2rem' }}>
        <Link href="/dashboard">Back to Dashboard</Link>
      </div>

      <section style={{ marginBottom: '2rem' }}>
        <h2>Live Price: {symbol}</h2>
        <p style={{ fontSize: '1.5rem', marginTop: '0.5rem' }}>
          {ticker ? `$${ticker.lastPrice.toLocaleString()}` : 'Connecting...'}
        </p>
        {ticker && <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Vol 24h: {ticker.volume24h.toLocaleString()}</p>}
      </section>

      <section style={{ marginBottom: '2rem' }}>
        <h2>Place Order</h2>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem', maxWidth: 400 }}>
          <select value={symbol} onChange={(e) => setSymbol(e.target.value)} style={{ padding: '0.5rem', background: 'var(--input-bg)', border: '1px solid var(--border)', borderRadius: 6 }}>
            <option value="BTC_USD">BTC/USD</option>
            <option value="ETH_USD">ETH/USD</option>
          </select>
          <select value={side} onChange={(e) => setSide(e.target.value as 'buy' | 'sell')} style={{ padding: '0.5rem', background: 'var(--input-bg)', border: '1px solid var(--border)', borderRadius: 6 }}>
            <option value="buy">Buy</option>
            <option value="sell">Sell</option>
          </select>
          <select value={orderType} onChange={(e) => setOrderType(e.target.value as 'limit' | 'market')} style={{ padding: '0.5rem', background: 'var(--input-bg)', border: '1px solid var(--border)', borderRadius: 6 }}>
            <option value="limit">Limit</option>
            <option value="market">Market</option>
          </select>
          <input type="number" placeholder="Quantity" value={quantity} onChange={(e) => setQuantity(e.target.value)} step="any" min="0" required />
          {orderType === 'limit' && (
            <input type="number" placeholder="Price" value={price} onChange={(e) => setPrice(e.target.value)} step="any" min="0" required={orderType === 'limit'} />
          )}
          {error && <p className="error">{error}</p>}
          <button type="submit" disabled={submitLoading}>
            {submitLoading ? 'Submitting...' : `${side} ${orderType}`}
          </button>
        </form>
      </section>

      <section>
        <h2>Recent Orders ({symbol})</h2>
        {Array.isArray(orders) && orders.length === 0 ? (
          <p style={{ color: 'var(--text-muted)' }}>No orders yet.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '1rem' }}>
            {(orders as Array<{ id: string; symbol: string; side: string; quantity: string; price: string | null; status: string }>).slice(0, 10).map((o) => (
              <div key={o.id} style={{ display: 'flex', gap: '1rem', padding: '0.5rem 0' }}>
                <span>{o.side}</span>
                <span>{o.quantity}</span>
                <span>@ {o.price ?? 'market'}</span>
                <span>{o.status}</span>
              </div>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
