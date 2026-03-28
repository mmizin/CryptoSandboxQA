'use client';

import { useState } from 'react';
import Link from 'next/link';
import { authApi } from '@/lib/api';
import { EMAIL_MAX_LENGTH, validateEmail } from '@/lib/authFieldConstraints';

const inputBase =
  'w-full px-4 py-3 rounded-xl bg-[var(--input-bg)] border text-[var(--text)] placeholder-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-colors';
const inputOk = 'border-[var(--border)] focus:border-emerald-500/50';
const inputErr = 'border-red-500 focus:ring-red-500/50 focus:border-red-500/50';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [fieldError, setFieldError] = useState<string | undefined>();
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setMessage('');
    const emailErr = validateEmail(email);
    if (emailErr) {
      setFieldError(emailErr);
      return;
    }
    setFieldError(undefined);
    setLoading(true);
    try {
      const res = await authApi.forgotPassword(email.trim());
      setMessage(res.message);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Request failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-slate-950 group-data-[theme=light]:bg-slate-50">
      <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900/50 shadow-xl p-8 group-data-[theme=light]:border-slate-200 group-data-[theme=light]:bg-white">
        <h1 className="text-2xl font-semibold text-white mb-2 group-data-[theme=light]:text-slate-900">
          Forgot password
        </h1>
        <p className="text-slate-400 text-sm mb-8 group-data-[theme=light]:text-slate-600">
          We&apos;ll email you an 8-digit code if this address is registered.
        </p>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label
              htmlFor="email"
              className="block text-sm font-medium text-slate-300 mb-2 group-data-[theme=light]:text-slate-700"
            >
              Email
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              required
              placeholder="you@example.com"
              value={email}
              maxLength={EMAIL_MAX_LENGTH}
              aria-invalid={!!fieldError}
              data-testid="forgot-password-email"
              onChange={(e) => {
                setEmail(e.target.value);
                setFieldError(undefined);
              }}
              className={`${inputBase} ${fieldError ? inputErr : inputOk}`}
            />
            {fieldError && (
              <p className="mt-1 text-sm text-red-400" data-testid="forgot-password-email-error">
                {fieldError}
              </p>
            )}
          </div>
          {error && <p className="text-sm text-red-400">{error}</p>}
          {message && <p className="text-sm text-emerald-400 group-data-[theme=light]:text-emerald-600">{message}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600 text-white font-medium
              hover:from-emerald-600 hover:to-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:ring-offset-2 focus:ring-offset-slate-900
              transition-all duration-200 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {loading ? 'Sending…' : 'Send reset code'}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-slate-400 group-data-[theme=light]:text-slate-600">
          <Link
            href="/reset-password"
            className="font-medium text-emerald-400 hover:text-emerald-300 transition-colors group-data-[theme=light]:text-emerald-600 group-data-[theme=light]:hover:text-emerald-700"
          >
            I already have a code
          </Link>
          {' · '}
          <Link
            href="/"
            className="font-medium text-emerald-400 hover:text-emerald-300 transition-colors group-data-[theme=light]:text-emerald-600 group-data-[theme=light]:hover:text-emerald-700"
          >
            Back to sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
