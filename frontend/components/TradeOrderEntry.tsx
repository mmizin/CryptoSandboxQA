'use client';

import { useState } from 'react';
import {
  validateOrderForm,
  type OrderType,
  type OrderFormState,
} from '@/lib/tradeOrderValidation';
import { MOCK_BALANCES, type TradeCoin } from '@/lib/tradeMockData';

interface TradeOrderEntryProps {
  selectedCoin: TradeCoin | null;
  onOrderSubmitted?: () => void;
}

const buttonBase =
  'rounded-lg px-4 py-2 text-sm font-medium transition-colors border-0 outline-none focus:outline-none bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 hover:text-emerald-300 group-data-[theme=light]:bg-emerald-50 group-data-[theme=light]:text-emerald-700 group-data-[theme=light]:hover:bg-emerald-100 group-data-[theme=light]:hover:text-emerald-800';

export function TradeOrderEntry({ selectedCoin, onOrderSubmitted }: TradeOrderEntryProps) {
  const [orderType, setOrderType] = useState<OrderType>('market');
  const [side, setSide] = useState<'buy' | 'sell'>('buy');
  const [amount, setAmount] = useState('');
  const [price, setPrice] = useState('');
  const [stopPrice, setStopPrice] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [submitLoading, setSubmitLoading] = useState(false);

  const currentPrice = selectedCoin?.price ?? 0;
  const balances = MOCK_BALANCES;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!selectedCoin) {
      setError('Select a coin first');
      return;
    }

    const state: OrderFormState = {
      orderType,
      side,
      amount,
      price,
      stopPrice,
    };

    const { valid, errors } = validateOrderForm(
      state,
      currentPrice,
      balances,
      'USD',
      selectedCoin.symbol
    );

    if (!valid) {
      const first = Object.values(errors).find(Boolean);
      setError(first ?? 'Validation failed');
      return;
    }

    setSubmitLoading(true);

    // Mock: 90% success, 10% error for QA testing
    const mockSuccess = Math.random() > 0.1;
    setTimeout(() => {
      setSubmitLoading(false);
      if (mockSuccess) {
        setSuccess('Order placed successfully (mock)');
        setAmount('');
        setPrice('');
        setStopPrice('');
        onOrderSubmitted?.();
      } else {
        setError('Order failed (mock error scenario)');
      }
    }, 500);
  };

  const handleReset = () => {
    setAmount('');
    setPrice('');
    setStopPrice('');
    setError('');
    setSuccess('');
  };

  const inputClass =
    'rounded-lg border border-slate-600 bg-slate-800/80 px-3 py-2 text-sm text-white focus:border-emerald-500 focus:outline-none w-full group-data-[theme=light]:border-slate-300 group-data-[theme=light]:bg-white group-data-[theme=light]:text-slate-900';

  return (
    <div className="rounded-xl border border-slate-700/80 bg-slate-900/50 p-4 group-data-[theme=light]:border-slate-200 group-data-[theme=light]:bg-white/80">
      <h3 className="text-sm font-medium text-white group-data-[theme=light]:text-slate-900 mb-4">
        Order Entry
      </h3>
      {selectedCoin && (
        <p className="text-xs text-slate-500 mb-3 group-data-[theme=light]:text-slate-500">
          Balance: USD {balances.USD?.toLocaleString()} | {selectedCoin.symbol}{' '}
          {balances[selectedCoin.symbol]?.toFixed(8) ?? '0'}
        </p>
      )}
      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="flex gap-2">
          {(['market', 'limit', 'stop-limit'] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setOrderType(t)}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg capitalize transition-colors ${
                orderType === t
                  ? 'bg-emerald-500/20 text-emerald-400 ring-1 ring-emerald-500/40'
                  : 'bg-slate-800/80 text-slate-400 hover:bg-slate-700/80 hover:text-slate-300 group-data-[theme=light]:bg-slate-100 group-data-[theme=light]:text-slate-600 group-data-[theme=light]:hover:bg-slate-200'
              }`}
            >
              {t.replace('-', ' ')}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setSide('buy')}
            className={`flex-1 py-2 text-sm font-medium rounded-lg transition-colors ${
              side === 'buy'
                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                : 'bg-slate-800/50 text-slate-400 border border-slate-600 group-data-[theme=light]:border-slate-300'
            }`}
          >
            Buy
          </button>
          <button
            type="button"
            onClick={() => setSide('sell')}
            className={`flex-1 py-2 text-sm font-medium rounded-lg transition-colors ${
              side === 'sell'
                ? 'bg-red-500/20 text-red-400 border border-red-500/40'
                : 'bg-slate-800/50 text-slate-400 border border-slate-600 group-data-[theme=light]:border-slate-300'
            }`}
          >
            Sell
          </button>
        </div>
        <div>
          <label className="block text-xs text-slate-400 mb-1 group-data-[theme=light]:text-slate-600">
            Amount
          </label>
          <input
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.00"
            step="any"
            min="0"
            required
            className={inputClass}
          />
        </div>
        {(orderType === 'limit' || orderType === 'stop-limit') && (
          <div>
            <label className="block text-xs text-slate-400 mb-1 group-data-[theme=light]:text-slate-600">
              Price
            </label>
            <input
              type="number"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              placeholder={currentPrice > 0 ? currentPrice.toString() : '0'}
              step="any"
              min="0"
              required={orderType === 'limit' || orderType === 'stop-limit'}
              className={inputClass}
            />
          </div>
        )}
        {orderType === 'stop-limit' && (
          <div>
            <label className="block text-xs text-slate-400 mb-1 group-data-[theme=light]:text-slate-600">
              Stop Price
            </label>
            <input
              type="number"
              value={stopPrice}
              onChange={(e) => setStopPrice(e.target.value)}
              placeholder="0"
              step="any"
              min="0"
              required
              className={inputClass}
            />
          </div>
        )}
        {error && <p className="text-sm text-red-400">{error}</p>}
        {success && <p className="text-sm text-emerald-400">{success}</p>}
        <div className="flex gap-2 pt-1">
          <button type="submit" disabled={submitLoading || !selectedCoin} className={buttonBase}>
            {submitLoading ? 'Submitting...' : 'Submit'}
          </button>
          <button type="button" onClick={handleReset} className={buttonBase}>
            Reset
          </button>
        </div>
      </form>
    </div>
  );
}
