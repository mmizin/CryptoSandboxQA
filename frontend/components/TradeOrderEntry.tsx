'use client';

import { useState, useEffect } from 'react';
import {
  validateOrderForm,
  type OrderType,
  type OrderFormState,
} from '@/lib/tradeOrderValidation';
import { type TradeCoin } from '@/lib/tradeMockData';
import { SubmitLoadingBar } from '@/components/SubmitLoadingBar';
import { awaitMinElapsedSince } from '@/lib/submitLoadingMinDuration';
import { ordersApi, walletsApi } from '@/lib/api';
import { type WorkingOrder } from '@/lib/orderTriggers';

interface TradeOrderEntryProps {
  selectedCoin: TradeCoin | null;
  marketType?: 'spot' | 'futures';
  currentPrice?: number;
  onOrderSubmitted?: () => void;
  onOrderCreated?: (order: WorkingOrder) => void;
  fixedSide?: 'buy' | 'sell';
}

const buttonBase =
  'rounded-lg px-4 py-2 text-sm font-medium transition-colors border-0 outline-none focus:outline-none bg-slate-700/60 text-slate-300 hover:bg-slate-600/80 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-slate-700/60 disabled:hover:text-slate-300 group-data-[theme=light]:bg-slate-100 group-data-[theme=light]:text-slate-600 group-data-[theme=light]:hover:bg-slate-200 group-data-[theme=light]:hover:text-slate-900 group-data-[theme=light]:disabled:hover:bg-slate-100 group-data-[theme=light]:disabled:hover:text-slate-600';

const submitButtonBuy =
  'rounded-lg px-4 py-2 text-sm font-medium border-0 outline-none focus:outline-none bg-gradient-to-r from-emerald-500 to-emerald-600 text-white hover:from-emerald-600 hover:to-emerald-700 focus:ring-2 focus:ring-emerald-500/50 transition-all duration-200 disabled:opacity-60 disabled:cursor-not-allowed';

const submitButtonSell =
  'rounded-lg px-4 py-2 text-sm font-medium border-0 outline-none focus:outline-none bg-gradient-to-r from-red-500 to-red-600 text-white hover:from-red-600 hover:to-red-700 focus:ring-2 focus:ring-red-500/50 transition-all duration-200 disabled:opacity-60 disabled:cursor-not-allowed';

export function TradeOrderEntry({ selectedCoin, marketType = 'spot', currentPrice: currentPriceProp, onOrderSubmitted, onOrderCreated, fixedSide }: TradeOrderEntryProps) {
  const [orderType, setOrderType] = useState<OrderType>('market');
  const [side, setSide] = useState<'buy' | 'sell'>(fixedSide ?? 'buy');
  const [amount, setAmount] = useState('');
  const [amountInUsd, setAmountInUsd] = useState(false);
  const [price, setPrice] = useState('');
  const [stopPrice, setStopPrice] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [submitLoading, setSubmitLoading] = useState(false);
  const [initialStatus, setInitialStatus] = useState<'open' | 'filled' | 'cancelled'>('open');
  const [balances, setBalances] = useState<Record<string, number>>({});

  useEffect(() => {
    walletsApi
      .list()
      .then((wallets) => {
        const map: Record<string, number> = {};
        for (const w of wallets) {
          map[w.asset] = parseFloat(w.balance);
        }
        setBalances(map);
      })
      .catch(() => setBalances({}));
  }, [success]); // Refetch after successful order

  const currentPrice = currentPriceProp ?? selectedCoin?.price ?? 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!selectedCoin) {
      setError('Select a coin first');
      return;
    }

    const symbol = selectedCoin.symbol.toUpperCase();

    const state: OrderFormState = {
      orderType,
      side,
      amount,
      amountInUsd: side === 'buy' && amountInUsd,
      price,
      stopPrice,
    };

    const { valid, errors } = validateOrderForm(
      state,
      currentPrice,
      balances,
      'USD',
      symbol
    );

    if (!valid) {
      const first = Object.values(errors).find(Boolean);
      setError(first ?? 'Validation failed');
      return;
    }

    const quantity =
      side === 'buy' && amountInUsd && currentPrice > 0
        ? Math.round((parseFloat(amount) / currentPrice) * 1e8) / 1e8
        : parseFloat(amount);

    const apiType = orderType === 'stop-limit' ? 'stop' : orderType;

    setSubmitLoading(true);
    const submitStartedAt = Date.now();
    try {
      const created = await ordersApi.create({
        symbol: `${symbol}_USD`,
        side,
        type: apiType,
        quantity,
        price: (orderType === 'limit' || orderType === 'stop-limit') ? parseFloat(price) : undefined,
        stopPrice: orderType === 'stop-limit' ? parseFloat(stopPrice) : undefined,
        marketType,
        initialStatus: initialStatus !== 'open' ? initialStatus : undefined,
      }) as { id: string };

      if ((orderType === 'limit' || orderType === 'stop-limit') && initialStatus === 'open' && onOrderCreated) {
        onOrderCreated({
          id: created.id,
          symbol,
          side,
          orderType: apiType as 'limit' | 'stop',
          price: orderType === 'limit' || orderType === 'stop-limit' ? parseFloat(price) : null,
          stopPrice: orderType === 'stop-limit' ? parseFloat(stopPrice) : null,
          quantity,
        });
      }

      setSuccess('Order placed successfully');
      setAmount('');
      setPrice('');
      setStopPrice('');
      onOrderSubmitted?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Order failed');
    } finally {
      await awaitMinElapsedSince(submitStartedAt);
      setSubmitLoading(false);
    }
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
      <h3 className={`text-sm font-semibold mb-4 ${
        fixedSide === 'buy'
          ? 'text-emerald-400 group-data-[theme=light]:text-emerald-700'
          : fixedSide === 'sell'
          ? 'text-red-400 group-data-[theme=light]:text-red-700'
          : 'text-white group-data-[theme=light]:text-slate-900'
      }`}>
        {fixedSide === 'buy' ? 'Buy' : fixedSide === 'sell' ? 'Sell' : 'Order Entry'}
        {fixedSide && selectedCoin ? ` ${selectedCoin.symbol}` : ''}
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
              className={`px-3 py-1.5 text-xs font-medium rounded-lg capitalize transition-colors border-0 outline-none focus:outline-none ${
                orderType === t
                  ? 'bg-emerald-500/20 text-emerald-400 ring-1 ring-emerald-500/40 group-data-[theme=light]:bg-emerald-100 group-data-[theme=light]:text-emerald-800'
                  : 'bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 hover:text-emerald-300 group-data-[theme=light]:bg-emerald-50 group-data-[theme=light]:text-emerald-700 group-data-[theme=light]:hover:bg-emerald-100 group-data-[theme=light]:hover:text-emerald-800'
              }`}
            >
              {t.replace('-', ' ')}
            </button>
          ))}
        </div>
        {!fixedSide && (
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setSide('buy')}
              className={`flex-1 py-2 text-sm font-medium rounded-lg transition-colors border-0 outline-none focus:outline-none ${
                side === 'buy'
                  ? 'bg-emerald-500/40 text-emerald-300 ring-2 ring-emerald-400/50 shadow-sm shadow-emerald-500/20 group-data-[theme=light]:bg-emerald-200 group-data-[theme=light]:text-emerald-950 group-data-[theme=light]:ring-emerald-500/40'
                  : 'bg-slate-800/50 text-slate-400 hover:bg-slate-700/80 hover:text-slate-300 group-data-[theme=light]:bg-slate-100 group-data-[theme=light]:text-slate-600 group-data-[theme=light]:hover:bg-slate-200'
              }`}
            >
              Buy
            </button>
            <button
              type="button"
              onClick={() => setSide('sell')}
              className={`flex-1 py-2 text-sm font-medium rounded-lg transition-colors border-0 outline-none focus:outline-none ${
                side === 'sell'
                  ? 'bg-red-500/40 text-red-300 ring-2 ring-red-400/50 shadow-sm shadow-red-500/20 group-data-[theme=light]:bg-red-200 group-data-[theme=light]:text-red-950 group-data-[theme=light]:ring-red-500/40'
                  : 'bg-red-500/10 text-red-400/90 hover:bg-red-500/20 hover:text-red-300 group-data-[theme=light]:bg-red-50 group-data-[theme=light]:text-red-700 group-data-[theme=light]:hover:bg-red-100 group-data-[theme=light]:hover:text-red-800'
              }`}
            >
              Sell
            </button>
          </div>
        )}
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="block text-xs text-slate-400 group-data-[theme=light]:text-slate-600">
              Amount
            </label>
            {side === 'buy' && (
              <label className="flex items-center gap-1.5 text-xs text-slate-400 cursor-pointer group-data-[theme=light]:text-slate-600">
                <input
                  type="checkbox"
                  checked={amountInUsd}
                  onChange={(e) => setAmountInUsd(e.target.checked)}
                  className="rounded border-slate-600 bg-slate-800 text-emerald-500 focus:ring-emerald-500"
                />
                <span>in USD</span>
              </label>
            )}
          </div>
          <input
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder={side === 'buy' && amountInUsd ? '0.00 (USD to spend)' : `0.00 (${selectedCoin?.symbol ?? 'crypto'})`}
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
        <div>
          <label className="block text-xs text-slate-400 mb-1 group-data-[theme=light]:text-slate-600">
            Order status (testing)
          </label>
          <select
            value={initialStatus}
            onChange={(e) => setInitialStatus(e.target.value as 'open' | 'filled' | 'cancelled')}
            className={inputClass}
          >
            <option value="open">Open</option>
            <option value="filled">Filled</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>
        {error && <p className="text-sm text-red-400">{error}</p>}
        {success && <p className="text-sm text-emerald-400">{success}</p>}
        <SubmitLoadingBar active={submitLoading} label="Placing order…" />
        <div className="flex gap-2 pt-1">
          <button
            type="submit"
            disabled={submitLoading || !selectedCoin}
            className={(fixedSide ?? side) === 'buy' ? submitButtonBuy : submitButtonSell}
          >
            {submitLoading ? 'Submitting...' : 'Submit'}
          </button>
          <button type="button" onClick={handleReset} disabled={submitLoading} className={buttonBase}>
            Reset
          </button>
        </div>
      </form>
    </div>
  );
}
