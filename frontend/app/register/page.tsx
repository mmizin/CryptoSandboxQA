'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { authApi } from '@/lib/api';

export default function RegisterPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { access_token } = await authApi.register(email, password, displayName || undefined);
      localStorage.setItem('token', access_token);
      router.push('/dashboard');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex">
      {/* LEFT SIDE — Marketing */}
      <div className="hidden lg:flex lg:flex-1 relative overflow-hidden bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
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
            <h1 className="text-4xl xl:text-5xl font-semibold text-white tracking-tight leading-tight mb-6">
              Start practicing
              <span className="bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent"> crypto trading</span>
            </h1>
            <p className="text-lg text-slate-400 leading-relaxed">
              Create a free account to access the sandbox. Simulate orders, test strategies, and validate transactions — no real funds required.
            </p>
            <div className="mt-12 flex items-center gap-4 text-slate-500">
              <span className="flex items-center gap-2 text-sm">
                <svg className="w-5 h-5 text-emerald-500/80" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
                Risk-free sandbox
              </span>
              <span className="flex items-center gap-2 text-sm">
                <svg className="w-5 h-5 text-cyan-500/80" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Setup in seconds
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* RIGHT SIDE — Register form */}
      <div className="flex-1 flex items-center justify-center p-6 sm:p-8 lg:p-12 bg-slate-950">
        <div className="w-full max-w-md">
          {/* Logo / Brand — visible on mobile */}
          <div className="lg:hidden text-center mb-8">
            <h2 className="text-xl font-semibold text-white">CryptoSandboxQA</h2>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-900/50 shadow-xl shadow-black/20 p-8">
            <h2 className="text-2xl font-semibold text-white mb-2">Create account</h2>
            <p className="text-slate-400 text-sm mb-8">Get started with a free sandbox account</p>

            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-slate-300 mb-2">
                  Email
                </label>
                <input
                  id="email"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full px-4 py-3 rounded-xl bg-slate-800/80 border border-slate-700 text-white placeholder-slate-500
                    focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50
                    transition-colors"
                />
              </div>

              <div>
                <label htmlFor="displayName" className="block text-sm font-medium text-slate-300 mb-2">
                  Display name
                  <span className="text-slate-500 font-normal ml-1">(optional)</span>
                </label>
                <input
                  id="displayName"
                  type="text"
                  placeholder="Your name"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl bg-slate-800/80 border border-slate-700 text-white placeholder-slate-500
                    focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50
                    transition-colors"
                />
              </div>

              <div>
                <label htmlFor="password" className="block text-sm font-medium text-slate-300 mb-2">
                  Password
                </label>
                <input
                  id="password"
                  type="password"
                  placeholder="Min. 6 characters"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                  className="w-full px-4 py-3 rounded-xl bg-slate-800/80 border border-slate-700 text-white placeholder-slate-500
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
                {loading ? 'Creating account...' : 'Create account'}
              </button>
            </form>

            <p className="mt-6 text-center text-sm text-slate-400">
              Already have an account?{' '}
              <Link
                href="/"
                className="font-medium text-emerald-400 hover:text-emerald-300 transition-colors"
              >
                Sign in
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
