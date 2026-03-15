'use client';

import Link from 'next/link';
import { useAuth } from '@/lib/useAuth';

function Logo() {
  return (
    <Link href="/" className="flex items-center gap-2.5 group">
      <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-gradient-to-br from-emerald-500 to-cyan-500 shadow-lg shadow-emerald-500/20 group-hover:shadow-emerald-500/30 transition-shadow">
        <svg
          viewBox="0 0 24 24"
          className="w-5 h-5 text-white"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M12 2L2 7l10 5 10-5-10-5z" />
          <path d="M2 17l10 5 10-5" />
        </svg>
      </div>
      <span className="text-lg font-semibold text-white tracking-tight">
        CryptoSandbox
      </span>
    </Link>
  );
}

export function Header() {
  const { user, loading } = useAuth(false);

  return (
    <header className="sticky top-0 z-50 w-full border-b border-slate-800/80 bg-slate-950/90 backdrop-blur-sm">
      <div className="flex h-14 w-full items-center justify-between pl-4 pr-4 sm:pl-4 sm:pr-6 lg:pl-6 lg:pr-8">
        <div className="flex-shrink-0">
          <Logo />
        </div>

        <nav className="flex items-center gap-3 sm:gap-4">
          {loading ? (
            <div className="h-9 w-24 animate-pulse rounded-lg bg-slate-800" />
          ) : !user ? (
            <>
              <Link
                href="/login"
                className="rounded-lg px-4 py-2 text-sm font-medium text-slate-300 transition-colors hover:bg-slate-800/80 hover:text-white"
              >
                Login
              </Link>
              <Link
                href="/register"
                className="rounded-lg bg-gradient-to-r from-emerald-500 to-emerald-600 px-4 py-2 text-sm font-medium text-white shadow-lg shadow-emerald-500/20 transition-all hover:from-emerald-600 hover:to-emerald-700 hover:shadow-emerald-500/25"
              >
                Sign up
              </Link>
            </>
          ) : (
            <div className="h-9" />
          )}
        </nav>
      </div>
    </header>
  );
}
