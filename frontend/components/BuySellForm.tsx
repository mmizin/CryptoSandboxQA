'use client';

import { useState } from 'react';
import {
  validateForm,
  type FormState,
  type FormErrors,
  type PaymentMethod,
  AMOUNT_MIN,
  AMOUNT_MAX,
} from '@/lib/buySellValidation';
import { getMockPrice, MOCK_FEE_PERCENT } from '@/lib/buySellMockData';
import { CryptoSearchSelect } from '@/components/CryptoSearchSelect';
import { SubmitLoadingBar } from '@/components/SubmitLoadingBar';
import { awaitMinElapsedSince } from '@/lib/submitLoadingMinDuration';
import { ordersApi } from '@/lib/api';
import { useAuth } from '@/lib/useAuth';

const inputBase =
  'w-full px-4 py-3 rounded-xl bg-[var(--input-bg)] border text-[var(--text)] placeholder-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50 transition-colors';
const inputError = 'border-red-500 focus:ring-red-500/50 focus:border-red-500/50';
const inputNormal = 'border-[var(--border)]';

const tabBase =
  'rounded-lg px-4 py-2 text-sm font-medium transition-colors border-0 outline-none focus:outline-none';
const tabInactive =
  'bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 hover:text-emerald-300 group-data-[theme=light]:bg-emerald-50 group-data-[theme=light]:text-emerald-700 group-data-[theme=light]:hover:bg-emerald-100 group-data-[theme=light]:hover:text-emerald-800';
const tabActive =
  'bg-emerald-500/20 text-emerald-300 group-data-[theme=light]:bg-emerald-100 group-data-[theme=light]:text-emerald-800';

const initialState: FormState = {
  amount: '',
  currency: 'BTC',
  currencyPrice: 0,
  paymentMethod: 'sepa',
  iban: '',
  sepaName: '',
  sepaBankName: '',
  cardNumber: '',
  expiry: '',
  cvv: '',
};

export function BuySellForm() {
  const { user } = useAuth(false);
  const [mode, setMode] = useState<'buy' | 'sell'>('buy');
  const [state, setState] = useState<FormState>(initialState);
  const [errors, setErrors] = useState<FormErrors>({});
  const [touched, setTouched] = useState<Partial<Record<keyof FormState, boolean>>>({});
  const [submitLoading, setSubmitLoading] = useState(false);
  const [submitMessage, setSubmitMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const { valid, errors: validatedErrors } = validateForm(state);
  const displayErrors = Object.keys(errors).length > 0 ? errors : validatedErrors;
  const formValid = valid;

  const updateField = (field: keyof FormState, value: string) => {
    setState((s) => ({ ...s, [field]: value }));
    setErrors((e) => {
      const next = { ...e };
      delete next[field as keyof FormErrors];
      return next;
    });
    setSubmitMessage(null);
  };

  const markTouched = (field: keyof FormState) => {
    setTouched((t) => ({ ...t, [field]: true }));
  };

  const inputClass = (field: keyof FormErrors) =>
    `${inputBase} ${displayErrors[field] ? inputError : inputNormal}`;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const { valid: isValid, errors: errs } = validateForm(state);
    if (!isValid) {
      setErrors(errs);
      setTouched({
        amount: true,
        currency: true,
        iban: true,
        sepaName: true,
        sepaBankName: true,
        cardNumber: true,
        expiry: true,
        cvv: true,
      });
      return;
    }
    if (!user) {
      setSubmitMessage({ type: 'error', text: 'Please log in to buy or sell crypto.' });
      return;
    }
    const symbol = state.currency.toUpperCase();

    setErrors({});
    setSubmitLoading(true);
    const submitStartedAt = Date.now();
    setSubmitMessage(null);

    const usdAmount = parseFloat(state.amount);
    const price = state.currencyPrice || getMockPrice(state.currency);
    const cryptoQuantity = usdAmount / price; // Amount (USD) / price = crypto quantity
    const orderSymbol = `${symbol}_USD`;
    const side = mode;

    try {
      await ordersApi.create({
        symbol: orderSymbol,
        side,
        type: 'market',
        quantity: cryptoQuantity,
      });
      const fee = usdAmount * (MOCK_FEE_PERCENT / 100);
      setSubmitMessage({
        type: 'success',
        text: `${mode === 'buy' ? 'Buy' : 'Sell'} order placed: ${cryptoQuantity.toFixed(8)} ${symbol} ${mode === 'buy' ? `for $${usdAmount.toFixed(2)}` : ''} (fee: $${fee.toFixed(2)}). Balance updated.`,
      });
    } catch (err) {
      setSubmitMessage({
        type: 'error',
        text: err instanceof Error ? err.message : 'Order failed. Check your balance and try again.',
      });
    } finally {
      await awaitMinElapsedSince(submitStartedAt);
      setSubmitLoading(false);
    }
  };

  const handleReset = () => {
    setState(initialState);
    setErrors({});
    setTouched({});
    setSubmitMessage(null);
  };

  const price = state.currencyPrice || getMockPrice(state.currency);
  const amountNum = parseFloat(state.amount) || 0;
  const cryptoAmount = price > 0 ? amountNum / price : 0;
  const fee = amountNum * (MOCK_FEE_PERCENT / 100);
  const total = amountNum + fee;

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/50 shadow-xl shadow-black/20 p-6 sm:p-8 transition-colors duration-200 group-data-[theme=light]:border-slate-200 group-data-[theme=light]:bg-white group-data-[theme=light]:shadow-slate-200/50">
      {/* Buy / Sell tabs */}
      <div className="flex gap-2 mb-6">
        <button
          type="button"
          onClick={() => setMode('buy')}
          className={`${tabBase} ${mode === 'buy' ? tabActive : tabInactive}`}
        >
          Buy
        </button>
        <button
          type="button"
          onClick={() => setMode('sell')}
          className={`${tabBase} ${mode === 'sell' ? tabActive : tabInactive}`}
        >
          Sell
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Amount */}
        <div>
          <label htmlFor="amount" className="block text-sm font-medium text-slate-300 mb-2 group-data-[theme=light]:text-slate-700">
            Amount (USD)
            <span
              className="ml-1 text-slate-500 cursor-help"
              title={`Between ${AMOUNT_MIN} and ${AMOUNT_MAX} USD`}
            >
              ⓘ
            </span>
          </label>
          <input
            id="amount"
            type="number"
            placeholder="e.g. 100"
            value={state.amount}
            onChange={(e) => updateField('amount', e.target.value)}
            onBlur={() => markTouched('amount')}
            min={AMOUNT_MIN}
            max={AMOUNT_MAX}
            step="any"
            className={inputClass('amount')}
          />
          {(touched.amount || displayErrors.amount) && displayErrors.amount && (
            <p className="mt-1 text-sm text-red-400">{displayErrors.amount}</p>
          )}
        </div>

        {/* Cryptocurrency — searchable, all coins from API */}
        <div>
          <label htmlFor="currency" className="block text-sm font-medium text-slate-300 mb-2 group-data-[theme=light]:text-slate-700">
            Cryptocurrency
            <span className="ml-1 text-slate-500 cursor-help" title="Search and select from all available cryptocurrencies">
              ⓘ
            </span>
          </label>
          <CryptoSearchSelect
            value={state.currency}
            onChange={(symbol, price) => {
              setState((s) => ({ ...s, currency: symbol, currencyPrice: price }));
              setErrors((e) => {
                const next = { ...e };
                delete next.currency;
                return next;
              });
              setSubmitMessage(null);
            }}
            error={!!displayErrors.currency}
          />
          {displayErrors.currency && (
            <p className="mt-1 text-sm text-red-400">{displayErrors.currency}</p>
          )}
        </div>

        {/* Payment method tabs */}
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-2 group-data-[theme=light]:text-slate-700">
            Payment method
          </label>
          <div className="flex flex-wrap gap-2 mb-4">
            {(['sepa', 'card', 'applepay'] as const).map((pm) => (
              <button
                key={pm}
                type="button"
                onClick={() => updateField('paymentMethod', pm)}
                className={`${tabBase} ${state.paymentMethod === pm ? tabActive : tabInactive}`}
              >
                {pm === 'sepa' ? 'SEPA' : pm === 'card' ? 'Card' : 'Apple Pay'}
              </button>
            ))}
          </div>

          {/* SEPA fields */}
          {state.paymentMethod === 'sepa' && (
            <div className="space-y-4 p-4 rounded-xl bg-slate-800/50 group-data-[theme=light]:bg-slate-100/50">
              <div>
                <label htmlFor="iban" className="block text-sm font-medium text-slate-300 mb-2 group-data-[theme=light]:text-slate-700">
                  IBAN
                  <span className="ml-1 text-slate-500 cursor-help" title="International Bank Account Number, 15-34 chars">
                    ⓘ
                  </span>
                </label>
                <input
                  id="iban"
                  type="text"
                  placeholder="DE89370400440532013000"
                  value={state.iban}
                  onChange={(e) => updateField('iban', e.target.value.replace(/\s/g, '').toUpperCase().slice(0, 34))}
                  onBlur={() => markTouched('iban')}
                  maxLength={34}
                  className={inputClass('iban')}
                />
                {displayErrors.iban && <p className="mt-1 text-sm text-red-400">{displayErrors.iban}</p>}
              </div>
              <div>
                <label htmlFor="sepaName" className="block text-sm font-medium text-slate-300 mb-2 group-data-[theme=light]:text-slate-700">
                  Account holder name
                </label>
                <input
                  id="sepaName"
                  type="text"
                  placeholder="John Doe"
                  value={state.sepaName}
                  onChange={(e) => updateField('sepaName', e.target.value.slice(0, 100))}
                  onBlur={() => markTouched('sepaName')}
                  maxLength={100}
                  className={inputClass('sepaName')}
                />
                {displayErrors.sepaName && <p className="mt-1 text-sm text-red-400">{displayErrors.sepaName}</p>}
              </div>
              <div>
                <label htmlFor="sepaBankName" className="block text-sm font-medium text-slate-300 mb-2 group-data-[theme=light]:text-slate-700">
                  Bank name
                </label>
                <input
                  id="sepaBankName"
                  type="text"
                  placeholder="Commerzbank"
                  value={state.sepaBankName}
                  onChange={(e) => updateField('sepaBankName', e.target.value.slice(0, 100))}
                  onBlur={() => markTouched('sepaBankName')}
                  maxLength={100}
                  className={inputClass('sepaBankName')}
                />
                {displayErrors.sepaBankName && <p className="mt-1 text-sm text-red-400">{displayErrors.sepaBankName}</p>}
              </div>
            </div>
          )}

          {/* Card fields */}
          {state.paymentMethod === 'card' && (
            <div className="space-y-4 p-4 rounded-xl bg-slate-800/50 group-data-[theme=light]:bg-slate-100/50">
              <div>
                <label htmlFor="cardNumber" className="block text-sm font-medium text-slate-300 mb-2 group-data-[theme=light]:text-slate-700">
                  Card number
                </label>
                <input
                  id="cardNumber"
                  type="text"
                  placeholder="4111 1111 1111 1111"
                  value={state.cardNumber}
                  onChange={(e) => updateField('cardNumber', e.target.value.replace(/\D/g, '').slice(0, 19))}
                  onBlur={() => markTouched('cardNumber')}
                  maxLength={19}
                  className={inputClass('cardNumber')}
                />
                {displayErrors.cardNumber && <p className="mt-1 text-sm text-red-400">{displayErrors.cardNumber}</p>}
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="expiry" className="block text-sm font-medium text-slate-300 mb-2 group-data-[theme=light]:text-slate-700">
                    Expiry (MM/YY)
                  </label>
                  <input
                    id="expiry"
                    type="text"
                    placeholder="12/28"
                    value={state.expiry}
                    onChange={(e) => {
                      let v = e.target.value.replace(/\D/g, '');
                      if (v.length >= 2) v = v.slice(0, 2) + '/' + v.slice(2, 4);
                      updateField('expiry', v);
                    }}
                    onBlur={() => markTouched('expiry')}
                    maxLength={5}
                    className={inputClass('expiry')}
                  />
                  {displayErrors.expiry && <p className="mt-1 text-sm text-red-400">{displayErrors.expiry}</p>}
                </div>
                <div>
                  <label htmlFor="cvv" className="block text-sm font-medium text-slate-300 mb-2 group-data-[theme=light]:text-slate-700">
                    CVV
                    <span className="ml-1 text-slate-500 cursor-help" title="3 or 4 digits on the back of the card">
                      ⓘ
                    </span>
                  </label>
                  <input
                    id="cvv"
                    type="password"
                    placeholder="123"
                    value={state.cvv}
                    onChange={(e) => updateField('cvv', e.target.value.replace(/\D/g, '').slice(0, 4))}
                    onBlur={() => markTouched('cvv')}
                    maxLength={4}
                    className={inputClass('cvv')}
                  />
                  {displayErrors.cvv && <p className="mt-1 text-sm text-red-400">{displayErrors.cvv}</p>}
                </div>
              </div>
            </div>
          )}

          {/* Apple Pay — UI only */}
          {state.paymentMethod === 'applepay' && (
            <div className="p-4 rounded-xl bg-slate-800/50 group-data-[theme=light]:bg-slate-100/50">
              <button
                type="button"
                className="w-full py-4 px-6 rounded-xl bg-black text-white font-medium flex items-center justify-center gap-2 hover:opacity-90 transition-opacity"
                disabled
              >
                <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" />
                </svg>
                Pay with Apple Pay
              </button>
              <p className="mt-2 text-sm text-slate-500 group-data-[theme=light]:text-slate-600">
                Apple Pay integration coming soon.
              </p>
            </div>
          )}
        </div>

        {/* Transaction summary */}
        {state.amount && parseFloat(state.amount) > 0 && (
          <div className="rounded-xl border border-slate-700 group-data-[theme=light]:border-slate-200 p-4 space-y-2">
            <h3 className="text-sm font-medium text-slate-300 group-data-[theme=light]:text-slate-700">Summary</h3>
            <div className="flex justify-between text-sm">
              <span className="text-slate-400 group-data-[theme=light]:text-slate-600">{state.currency} amount</span>
              <span>{cryptoAmount.toFixed(8)} {state.currency}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-slate-400 group-data-[theme=light]:text-slate-600">Price</span>
              <span>${price.toLocaleString()} / {state.currency}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-slate-400 group-data-[theme=light]:text-slate-600">Fee ({MOCK_FEE_PERCENT}%)</span>
              <span>${fee.toFixed(2)}</span>
            </div>
            <div className="flex justify-between font-medium pt-2 border-t border-slate-700 group-data-[theme=light]:border-slate-200">
              <span>Total</span>
              <span>${total.toFixed(2)}</span>
            </div>
          </div>
        )}

        {submitMessage && (
          <p className={`text-sm ${submitMessage.type === 'success' ? 'text-green-400' : 'text-red-400'}`}>
            {submitMessage.text}
          </p>
        )}

        <SubmitLoadingBar active={submitLoading} label="Placing order…" />

        <div className="flex gap-4">
          <button
            type="submit"
            disabled={!formValid || submitLoading}
            className="flex-1 py-3.5 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600 text-white font-medium hover:from-emerald-600 hover:to-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all duration-200 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {submitLoading ? 'Processing...' : mode === 'buy' ? 'Buy' : 'Sell'}
          </button>
          <button
            type="button"
            onClick={handleReset}
            disabled={submitLoading}
            className="rounded-lg px-4 py-2 text-sm font-medium transition-colors border-0 outline-none focus:outline-none bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 hover:text-emerald-300 group-data-[theme=light]:bg-emerald-50 group-data-[theme=light]:text-emerald-700 group-data-[theme=light]:hover:bg-emerald-100 group-data-[theme=light]:hover:text-emerald-800 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-emerald-500/10 disabled:hover:text-emerald-400 group-data-[theme=light]:disabled:hover:bg-emerald-50 group-data-[theme=light]:disabled:hover:text-emerald-700"
          >
            Reset
          </button>
        </div>
      </form>
    </div>
  );
}
