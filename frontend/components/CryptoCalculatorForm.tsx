'use client';

import { useState, useMemo } from 'react';
import {
  validateAmount,
  validateCryptoSelection,
  validateFiatSelection,
  type CalculatorErrors,
} from '@/lib/calculatorValidation';
import {
  FIAT_OPTIONS,
  getMockRate,
  getMockLastUpdate,
} from '@/lib/calculatorMockData';
import { CryptoSearchSelect } from '@/components/CryptoSearchSelect';

const inputBase =
  'w-full px-4 py-3 rounded-xl bg-[var(--input-bg)] border text-[var(--text)] placeholder-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50 transition-colors';
const inputError = 'border-red-500 focus:ring-red-500/50 focus:border-red-500/50';
const inputNormal = 'border-[var(--border)]';

const selectBase =
  'w-full px-4 py-3 rounded-xl bg-[var(--input-bg)] border text-[var(--text)] focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50 transition-colors appearance-none cursor-pointer';
const selectError = 'border-red-500 focus:ring-red-500/50 focus:border-red-500/50';
const selectNormal = 'border-[var(--border)]';

const tabBase =
  'rounded-lg px-4 py-2 text-sm font-medium transition-colors border-0 outline-none focus:outline-none';
const tabInactive =
  'bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 hover:text-emerald-300 group-data-[theme=light]:bg-emerald-50 group-data-[theme=light]:text-emerald-700 group-data-[theme=light]:hover:bg-emerald-100 group-data-[theme=light]:hover:text-emerald-800';
const tabActive =
  'bg-emerald-500/20 text-emerald-300 group-data-[theme=light]:bg-emerald-100 group-data-[theme=light]:text-emerald-800';

type Direction = 'cryptoToFiat' | 'fiatToCrypto';

const DEFAULT_CRYPTO = 'BTC';
const DEFAULT_FIAT = 'USD';

export function CryptoCalculatorForm() {
  const [direction, setDirection] = useState<Direction>('cryptoToFiat');
  const [amount, setAmount] = useState('');
  const [crypto, setCrypto] = useState(DEFAULT_CRYPTO);
  const [fiat, setFiat] = useState(DEFAULT_FIAT);
  const [errors, setErrors] = useState<CalculatorErrors>({});
  const [touched, setTouched] = useState({ amount: false, crypto: false, fiat: false });
  const [ratesLoading] = useState(false); // Placeholder for future backend

  const amountErr = touched.amount ? validateAmount(amount) : undefined;
  const cryptoErr = touched.crypto ? validateCryptoSelection(crypto) : undefined;
  const fiatErr = touched.fiat ? validateFiatSelection(fiat) : undefined;
  const displayErrors: CalculatorErrors = {
    ...errors,
    amount: amountErr ?? errors.amount,
    crypto: cryptoErr ?? errors.crypto,
    fiat: fiatErr ?? errors.fiat,
  };

  const rate = useMemo(() => getMockRate(crypto, fiat), [crypto, fiat]);
  const lastUpdate = useMemo(() => getMockLastUpdate(), []);

  const amountNum = parseFloat(amount) || 0;
  const convertedAmount = useMemo(() => {
    if (!rate || amountNum <= 0) return null;
    if (direction === 'cryptoToFiat') return amountNum * rate;
    return amountNum / rate;
  }, [amountNum, rate, direction]);

  const inputClass = (hasError: boolean) =>
    `${inputBase} ${hasError ? inputError : inputNormal}`;
  const selectClass = (hasError: boolean) =>
    `${selectBase} ${hasError ? selectError : selectNormal}`;

  const updateAmount = (value: string) => {
    setAmount(value);
    setErrors((e) => {
      const next = { ...e };
      delete next.amount;
      return next;
    });
  };

  const updateCrypto = (value: string) => {
    setCrypto(value);
    setErrors((e) => {
      const next = { ...e };
      delete next.crypto;
      return next;
    });
  };

  const updateFiat = (value: string) => {
    setFiat(value);
    setErrors((e) => {
      const next = { ...e };
      delete next.fiat;
      return next;
    });
  };

  const handleClear = () => {
    setAmount('');
    setCrypto(DEFAULT_CRYPTO);
    setFiat(DEFAULT_FIAT);
    setErrors({});
    setTouched({ amount: false, crypto: false, fiat: false });
  };

  const formatConverted = (val: number): string => {
    if (val >= 1_000_000) return val.toLocaleString(undefined, { maximumFractionDigits: 0 });
    if (val >= 1) return val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return val.toFixed(8);
  };

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/50 shadow-xl shadow-black/20 p-6 sm:p-8 transition-colors duration-200 group-data-[theme=light]:border-slate-200 group-data-[theme=light]:bg-white group-data-[theme=light]:shadow-slate-200/50">
      {/* Direction toggle */}
      <div className="flex gap-2 mb-6">
        <button
          type="button"
          onClick={() => setDirection('cryptoToFiat')}
          className={`${tabBase} ${direction === 'cryptoToFiat' ? tabActive : tabInactive}`}
        >
          Crypto → Fiat
        </button>
        <button
          type="button"
          onClick={() => setDirection('fiatToCrypto')}
          className={`${tabBase} ${direction === 'fiatToCrypto' ? tabActive : tabInactive}`}
        >
          Fiat → Crypto
        </button>
      </div>

      <div className="space-y-6">
        {/* Source: crypto or fiat based on direction */}
        {direction === 'cryptoToFiat' ? (
          <div>
            <label
              htmlFor="crypto-select"
              className="block text-sm font-medium text-slate-300 mb-2 group-data-[theme=light]:text-slate-700"
            >
              Cryptocurrency
            </label>
            <CryptoSearchSelect
              value={crypto}
              onChange={(symbol) => {
                updateCrypto(symbol);
                setTouched((t) => ({ ...t, crypto: true }));
              }}
              error={!!displayErrors.crypto}
            />
            {displayErrors.crypto && (
              <p className="mt-1 text-sm text-red-400">{displayErrors.crypto}</p>
            )}
          </div>
        ) : (
          <div>
            <label
              htmlFor="fiat-select"
              className="block text-sm font-medium text-slate-300 mb-2 group-data-[theme=light]:text-slate-700"
            >
              Fiat currency
            </label>
            <select
              id="fiat-select"
              value={fiat}
              onChange={(e) => updateFiat(e.target.value)}
              onBlur={() => setTouched((t) => ({ ...t, fiat: true }))}
              className={selectClass(!!displayErrors.fiat)}
            >
              {FIAT_OPTIONS.map((f) => (
                <option key={f.symbol} value={f.symbol}>
                  {f.name} ({f.symbol})
                </option>
              ))}
            </select>
            {displayErrors.fiat && (
              <p className="mt-1 text-sm text-red-400">{displayErrors.fiat}</p>
            )}
          </div>
        )}

        {/* Amount input */}
        <div>
          <label
            htmlFor="amount"
            className="block text-sm font-medium text-slate-300 mb-2 group-data-[theme=light]:text-slate-700"
          >
            Amount
            <span className="ml-1 text-slate-500 group-data-[theme=light]:text-slate-600">
              ({direction === 'cryptoToFiat' ? crypto : fiat})
            </span>
          </label>
          <div className="relative">
            <input
              id="amount"
              type="text"
              inputMode="decimal"
              placeholder="e.g. 1"
              value={amount}
              onChange={(e) => {
                const v = e.target.value;
                if (v === '' || /^-?\d*\.?\d*$/.test(v)) updateAmount(v);
              }}
              onBlur={() => setTouched((t) => ({ ...t, amount: true }))}
              className={inputClass(!!displayErrors.amount)}
            />
            {ratesLoading && (
              <div className="absolute right-4 top-1/2 -translate-y-1/2">
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-emerald-500/30 border-t-emerald-500" />
              </div>
            )}
          </div>
          {displayErrors.amount && (
            <p className="mt-1 text-sm text-red-400">{displayErrors.amount}</p>
          )}
        </div>

        {/* Target: fiat or crypto based on direction */}
        {direction === 'cryptoToFiat' ? (
          <div>
            <label
              htmlFor="fiat-select-target"
              className="block text-sm font-medium text-slate-300 mb-2 group-data-[theme=light]:text-slate-700"
            >
              Convert to
            </label>
            <select
              id="fiat-select-target"
              value={fiat}
              onChange={(e) => updateFiat(e.target.value)}
              onBlur={() => setTouched((t) => ({ ...t, fiat: true }))}
              className={selectClass(!!displayErrors.fiat)}
            >
              {FIAT_OPTIONS.map((f) => (
                <option key={f.symbol} value={f.symbol}>
                  {f.name} ({f.symbol})
                </option>
              ))}
            </select>
            {displayErrors.fiat && (
              <p className="mt-1 text-sm text-red-400">{displayErrors.fiat}</p>
            )}
          </div>
        ) : (
          <div>
            <label
              htmlFor="crypto-select-target"
              className="block text-sm font-medium text-slate-300 mb-2 group-data-[theme=light]:text-slate-700"
            >
              Convert to
            </label>
            <CryptoSearchSelect
              value={crypto}
              onChange={(symbol) => {
                updateCrypto(symbol);
                setTouched((t) => ({ ...t, crypto: true }));
              }}
              error={!!displayErrors.crypto}
            />
            {displayErrors.crypto && (
              <p className="mt-1 text-sm text-red-400">{displayErrors.crypto}</p>
            )}
          </div>
        )}

        {/* Conversion summary */}
        {amountNum > 0 && rate > 0 && convertedAmount != null && (
          <div className="rounded-xl border border-slate-700 group-data-[theme=light]:border-slate-200 p-4 space-y-2">
            <h3 className="text-sm font-medium text-slate-300 group-data-[theme=light]:text-slate-700">
              Conversion
            </h3>
            <div className="text-xl font-semibold text-emerald-400 group-data-[theme=light]:text-emerald-600 py-2">
              {direction === 'cryptoToFiat'
                ? `${amount} ${crypto} = ${formatConverted(convertedAmount)} ${fiat}`
                : `${amount} ${fiat} = ${convertedAmount.toFixed(8)} ${crypto}`}
            </div>
            <div className="flex justify-between text-sm text-slate-400 group-data-[theme=light]:text-slate-600">
              <span>Rate</span>
              <span>
                1 {crypto} = {formatConverted(rate)} {fiat}
              </span>
            </div>
            <div className="flex justify-between text-xs text-slate-500 group-data-[theme=light]:text-slate-500 pt-1">
              <span>Rates last updated</span>
              <span>{lastUpdate.toLocaleTimeString()}</span>
            </div>
          </div>
        )}

        <button
          type="button"
          onClick={handleClear}
          className="rounded-lg px-4 py-2 text-sm font-medium transition-colors border-0 outline-none focus:outline-none bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 hover:text-emerald-300 group-data-[theme=light]:bg-emerald-50 group-data-[theme=light]:text-emerald-700 group-data-[theme=light]:hover:bg-emerald-100 group-data-[theme=light]:hover:text-emerald-800"
        >
          Clear
        </button>
      </div>
    </div>
  );
}
