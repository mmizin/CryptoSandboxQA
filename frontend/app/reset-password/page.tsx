'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { authApi } from '@/lib/api';

export default function ResetPasswordPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (newPassword !== confirm) {
      setError('Passwords do not match');
      return;
    }
    setLoading(true);
    try {
      await authApi.resetPasswordWithCode(email.trim(), code.trim(), newPassword);
      setSuccess(true);
      setTimeout(() => {
        router.push('/');
        router.refresh();
      }, 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Reset failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-slate-950 group-data-[theme=light]:bg-slate-50">
      <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900/50 shadow-xl p-8 group-data-[theme=light]:border-slate-200 group-data-[theme=light]:bg-white">
        <h1 className="text-2xl font-semibold text-white mb-2 group-data-[theme=light]:text-slate-900">
          Reset password
        </h1>
        <p className="text-slate-400 text-sm mb-8 group-data-[theme=light]:text-slate-600">
          Enter the 8-digit code from your email and choose a new password.
        </p>

        {success ? (
          <p className="text-sm text-emerald-400 group-data-[theme=light]:text-emerald-600">
            Password updated. Redirecting to sign in…
          </p>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5">
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
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3 rounded-xl bg-[var(--input-bg)] border border-[var(--border)] text-[var(--text)]
                  focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50 transition-colors"
              />
            </div>
            <div>
              <label
                htmlFor="code"
                className="block text-sm font-medium text-slate-300 mb-2 group-data-[theme=light]:text-slate-700"
              >
                Reset code
              </label>
              <input
                id="code"
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                placeholder="12345678"
                required
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 8))}
                className="w-full px-4 py-3 rounded-xl bg-[var(--input-bg)] border border-[var(--border)] text-[var(--text)] tracking-widest font-mono
                  focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50 transition-colors"
              />
            </div>
            <div>
              <label
                htmlFor="newPassword"
                className="block text-sm font-medium text-slate-300 mb-2 group-data-[theme=light]:text-slate-700"
              >
                New password
              </label>
              <input
                id="newPassword"
                type="password"
                autoComplete="new-password"
                required
                minLength={6}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full px-4 py-3 rounded-xl bg-[var(--input-bg)] border border-[var(--border)] text-[var(--text)]
                  focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50 transition-colors"
              />
            </div>
            <div>
              <label
                htmlFor="confirm"
                className="block text-sm font-medium text-slate-300 mb-2 group-data-[theme=light]:text-slate-700"
              >
                Confirm password
              </label>
              <input
                id="confirm"
                type="password"
                autoComplete="new-password"
                required
                minLength={6}
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                className="w-full px-4 py-3 rounded-xl bg-[var(--input-bg)] border border-[var(--border)] text-[var(--text)]
                  focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50 transition-colors"
              />
            </div>
            {error && <p className="text-sm text-red-400">{error}</p>}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600 text-white font-medium
                hover:from-emerald-600 hover:to-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:ring-offset-2 focus:ring-offset-slate-900
                transition-all duration-200 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {loading ? 'Updating…' : 'Update password'}
            </button>
          </form>
        )}

        <p className="mt-6 text-center text-sm text-slate-400 group-data-[theme=light]:text-slate-600">
          <Link
            href="/forgot-password"
            className="font-medium text-emerald-400 hover:text-emerald-300 transition-colors group-data-[theme=light]:text-emerald-600 group-data-[theme=light]:hover:text-emerald-700"
          >
            Request a new code
          </Link>
          {' · '}
          <Link
            href="/"
            className="font-medium text-emerald-400 hover:text-emerald-300 transition-colors group-data-[theme=light]:text-emerald-600 group-data-[theme=light]:hover:text-emerald-700"
          >
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
