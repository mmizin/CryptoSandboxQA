'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { authApi, twoFactorApi } from '@/lib/api';
import { TwoFactorVerificationModal } from '@/components/TwoFactorVerificationModal';

export default function HomePage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [show2fa, setShow2fa] = useState(false);
  const [twoFaError, setTwoFaError] = useState('');
  const [resendSuccess, setResendSuccess] = useState(false);
  const router = useRouter();

  const performLogin = async () => {
    const { access_token } = await authApi.login(email, password);
    localStorage.setItem('token', access_token);
    router.push('/dashboard');
    router.refresh();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (twoFactorApi.is2FaRequired()) {
        setShow2fa(true);
        setLoading(false);
        return;
      }
      await performLogin();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign in failed');
    } finally {
      setLoading(false);
    }
  };

  const handle2faSubmit = async (code: string) => {
    setTwoFaError('');
    setLoading(true);
    try {
      const result = await twoFactorApi.verify(
        { tempToken: '', code },
        { email, password }
      );
      setShow2fa(false);
      localStorage.setItem('token', result.access_token);
      router.push('/dashboard');
      router.refresh();
    } catch (err) {
      setTwoFaError(err instanceof Error ? err.message : 'Verification failed');
    } finally {
      setLoading(false);
    }
  };

  const handle2faResend = async () => {
    setTwoFaError('');
    setResendSuccess(true);
    setTimeout(() => setResendSuccess(false), 3000);
  };

  const handle2faClose = () => {
    setShow2fa(false);
    setTwoFaError('');
    setResendSuccess(false);
  };

  return (
    <div className="min-h-screen flex transition-colors duration-200">
      {/* LEFT SIDE — Marketing */}
      <div className="hidden lg:flex lg:flex-1 relative overflow-hidden bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 group-data-[theme=light]:from-slate-200 group-data-[theme=light]:via-slate-100 group-data-[theme=light]:to-slate-200">
        {/* Subtle gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-emerald-900/20 via-transparent to-cyan-900/10 pointer-events-none" />
        {/* Abstract decorative shapes */}
        <div className="absolute top-1/4 left-1/4 w-72 h-72 rounded-full bg-emerald-500/10 blur-3xl" />
        <div className="absolute bottom-1/3 right-1/4 w-96 h-96 rounded-full bg-cyan-500/10 blur-3xl" />
        <div className="absolute top-1/2 right-1/2 w-48 h-48 rounded-full bg-blue-500/5 blur-2xl" />
        {/* Grid pattern */}
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: `linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px),
              linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)`,
            backgroundSize: '48px 48px',
          }}
        />
        <div className="relative z-10 flex flex-col justify-center px-16 xl:px-24 2xl:px-32">
          <div className="max-w-lg">
            <h1 className="text-4xl xl:text-5xl font-semibold text-white tracking-tight leading-tight mb-6 group-data-[theme=light]:text-slate-900">
              Practice crypto trading
              <span className="block mt-1 bg-gradient-to-r from-emerald-400 via-cyan-400 to-blue-400 bg-clip-text text-transparent">for testing purposes</span>
            </h1>
            <p className="text-lg text-slate-400 leading-relaxed group-data-[theme=light]:text-slate-600">
              Create a free account to access the QA sandbox. Simulate orders, test strategies, and validate transactions — for testing purposes only, no real funds required.
            </p>
            <div className="mt-12 flex flex-wrap items-center gap-6 text-slate-500 group-data-[theme=light]:text-slate-600">
              <span className="flex items-center gap-2 text-sm">
                <svg className="w-5 h-5 text-emerald-500/80 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
                Test-only environment
              </span>
              <span className="flex items-center gap-2 text-sm">
                <svg className="w-5 h-5 text-cyan-500/80 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                UI & API ready
              </span>
              <span className="flex items-center gap-2 text-sm">
                <svg className="w-5 h-5 text-blue-500/80 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                Load test ready
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* RIGHT SIDE — Login form */}
      <div className="flex-1 flex items-center justify-center p-6 sm:p-8 lg:p-12 bg-slate-950 group-data-[theme=light]:bg-slate-50">
        <div className="w-full max-w-md">
          {/* Logo / Brand — visible on mobile when left panel is hidden */}
          <div className="lg:hidden text-center mb-8">
            <h2 className="text-xl font-semibold text-white group-data-[theme=light]:text-slate-900">CryptoSandboxQA</h2>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-900/50 shadow-xl shadow-black/20 p-8 transition-colors duration-200 group-data-[theme=light]:border-slate-200 group-data-[theme=light]:bg-white group-data-[theme=light]:shadow-slate-200/50">
            <h2 className="text-2xl font-semibold text-white mb-2 group-data-[theme=light]:text-slate-900">Welcome back</h2>
            <p className="text-slate-400 text-sm mb-8 group-data-[theme=light]:text-slate-600">Sign in to your account to continue</p>

            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-slate-300 mb-2 group-data-[theme=light]:text-slate-700">
                  Email
                </label>
                <input
                  id="email"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl bg-[var(--input-bg)] border border-[var(--border)] text-[var(--text)] placeholder-[var(--text-muted)]
                    focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50
                    transition-colors"
                />
              </div>

              <div>
                <label htmlFor="password" className="block text-sm font-medium text-slate-300 mb-2 group-data-[theme=light]:text-slate-700">
                  Password
                </label>
                <input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl bg-[var(--input-bg)] border border-[var(--border)] text-[var(--text)] placeholder-[var(--text-muted)]
                    focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50
                    transition-colors"
                />
              </div>

              {error && (
                <p className="text-sm text-red-400">{error}</p>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3.5 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600 text-white font-medium
                  hover:from-emerald-600 hover:to-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:ring-offset-2 focus:ring-offset-slate-900
                  transition-all duration-200 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {loading ? 'Signing in...' : 'Sign in'}
              </button>
            </form>

            <p className="mt-6 text-center text-sm text-slate-400 group-data-[theme=light]:text-slate-600">
              Don&apos;t have an account?{' '}
              <Link
                href="/register"
                className="font-medium text-emerald-400 hover:text-emerald-300 transition-colors group-data-[theme=light]:text-emerald-600 group-data-[theme=light]:hover:text-emerald-700"
              >
                Create account
              </Link>
            </p>
          </div>
        </div>
      </div>

      <TwoFactorVerificationModal
        isOpen={show2fa}
        onClose={handle2faClose}
        onSubmit={handle2faSubmit}
        onResend={handle2faResend}
        loading={loading}
        error={twoFaError}
        resendSuccess={resendSuccess}
      />
    </div>
  );
}
