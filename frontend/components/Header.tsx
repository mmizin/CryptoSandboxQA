'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/useAuth';
import { useTheme } from '@/lib/useTheme';

function DepositCryptoDropdown() {
  const { user, loading } = useAuth(false);
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleDepositClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    if (!loading && !user) {
      e.preventDefault();
      setOpen(false);
      router.push('/login');
      return;
    }
    setOpen(false);
  };

  const buttonBase =
    'rounded-lg px-4 py-2 text-sm font-medium flex items-center gap-1 transition-colors border-0 outline-none focus:outline-none bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 hover:text-emerald-300 group-data-[theme=light]:bg-emerald-50 group-data-[theme=light]:text-emerald-700 group-data-[theme=light]:hover:bg-emerald-100 group-data-[theme=light]:hover:text-emerald-800';

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={buttonBase}
        aria-expanded={open}
        aria-haspopup="true"
      >
        Deposit crypto
        <svg
          className={`h-4 w-4 transition-transform ${open ? 'rotate-180' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && (
        <div
          className="absolute left-0 top-full mt-1 min-w-[200px] rounded-lg bg-slate-900/95 py-1 shadow-xl backdrop-blur-sm group-data-[theme=light]:bg-white/95"
          role="menu"
        >
          <Link
            href="/deposit-cash"
            className="block px-4 py-2 text-sm text-slate-300 hover:bg-slate-800 hover:text-white group-data-[theme=light]:text-slate-700 group-data-[theme=light]:hover:bg-slate-100"
            role="menuitem"
            onClick={handleDepositClick}
          >
            Deposit cash
          </Link>
          <Link
            href="/deposit-crypto"
            className="block px-4 py-2 text-sm text-slate-300 hover:bg-slate-800 hover:text-white group-data-[theme=light]:text-slate-700 group-data-[theme=light]:hover:bg-slate-100"
            role="menuitem"
            onClick={handleDepositClick}
          >
            Deposit crypto
          </Link>
        </div>
      )}
    </div>
  );
}

function MarketsDropdown() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const buttonBase =
    'rounded-lg px-4 py-2 text-sm font-medium flex items-center gap-1 transition-colors border-0 outline-none focus:outline-none bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 hover:text-emerald-300 group-data-[theme=light]:bg-emerald-50 group-data-[theme=light]:text-emerald-700 group-data-[theme=light]:hover:bg-emerald-100 group-data-[theme=light]:hover:text-emerald-800';

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={buttonBase}
        aria-expanded={open}
        aria-haspopup="true"
      >
        Markets
        <svg
          className={`h-4 w-4 transition-transform ${open ? 'rotate-180' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && (
        <div
          className="absolute left-0 top-full mt-1 min-w-[200px] rounded-lg bg-slate-900/95 py-1 shadow-xl backdrop-blur-sm group-data-[theme=light]:bg-white/95"
          role="menu"
        >
          <Link
            href="/markets/prices"
            className="block px-4 py-2 text-sm text-slate-300 hover:bg-slate-800 hover:text-white group-data-[theme=light]:text-slate-700 group-data-[theme=light]:hover:bg-slate-100"
            role="menuitem"
            onClick={() => setOpen(false)}
          >
            Prices
          </Link>
          <Link
            href="/markets/rankings/spot"
            className="block px-4 py-2 text-sm text-slate-300 hover:bg-slate-800 hover:text-white group-data-[theme=light]:text-slate-700 group-data-[theme=light]:hover:bg-slate-100"
            role="menuitem"
            onClick={() => setOpen(false)}
          >
            Spot Rankings
          </Link>
          <Link
            href="/markets/trading-data/overview"
            className="block px-4 py-2 text-sm text-slate-300 hover:bg-slate-800 hover:text-white group-data-[theme=light]:text-slate-700 group-data-[theme=light]:hover:bg-slate-100"
            role="menuitem"
            onClick={() => setOpen(false)}
          >
            Trading Data Overview
          </Link>
        </div>
      )}
    </div>
  );
}

function BuyCryptoDropdown() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const buttonBase =
    'rounded-lg px-4 py-2 text-sm font-medium flex items-center gap-1 transition-colors border-0 outline-none focus:outline-none bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 hover:text-emerald-300 group-data-[theme=light]:bg-emerald-50 group-data-[theme=light]:text-emerald-700 group-data-[theme=light]:hover:bg-emerald-100 group-data-[theme=light]:hover:text-emerald-800';

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={buttonBase}
        aria-expanded={open}
        aria-haspopup="true"
      >
        Buy crypto
        <svg
          className={`h-4 w-4 transition-transform ${open ? 'rotate-180' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && (
        <div
          className="absolute left-0 top-full mt-1 min-w-[200px] rounded-lg bg-slate-900/95 py-1 shadow-xl backdrop-blur-sm group-data-[theme=light]:bg-white/95"
          role="menu"
        >
          <Link
            href="/buy-crypto"
            className="block px-4 py-2 text-sm text-slate-300 hover:bg-slate-800 hover:text-white group-data-[theme=light]:text-slate-700 group-data-[theme=light]:hover:bg-slate-100"
            role="menuitem"
            onClick={() => setOpen(false)}
          >
            Buy and sell
          </Link>
          <Link
            href="/calculate"
            className="block px-4 py-2 text-sm text-slate-300 hover:bg-slate-800 hover:text-white group-data-[theme=light]:text-slate-700 group-data-[theme=light]:hover:bg-slate-100"
            role="menuitem"
            onClick={() => setOpen(false)}
          >
            Crypto calculator
          </Link>
        </div>
      )}
    </div>
  );
}

function Logo() {
  const { user } = useAuth(false);
  return (
    <Link href={user ? '/dashboard' : '/'} className="flex items-center gap-2.5 group">
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
      <span className="text-lg font-semibold text-white tracking-tight group-data-[theme=light]:text-slate-900">
        CryptoSandbox
      </span>
    </Link>
  );
}

function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
      title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}
      className="flex items-center gap-2 rounded-lg border-0 outline-none focus:outline-none bg-slate-800/60 px-3 py-2 text-sm font-medium text-slate-200 transition-colors hover:bg-slate-700/80 hover:text-white group-data-[theme=light]:bg-slate-200/80 group-data-[theme=light]:text-slate-700 group-data-[theme=light]:hover:bg-slate-300 group-data-[theme=light]:hover:text-slate-900"
    >
      {theme === 'dark' ? (
        <svg className="h-5 w-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v2.25m6.364.386l-1.591 1.591M21 12h-2.25m-.386 6.364l-1.591-1.591M12 18.75V21m-4.773-4.227l-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z" />
        </svg>
      ) : (
        <svg className="h-5 w-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M21.752 15.002A9.718 9.718 0 0118 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 003 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 009.002-5.998z" />
        </svg>
      )}
      <span className="hidden sm:inline">Theme</span>
    </button>
  );
}

export function Header() {
  const { user, loading, logout } = useAuth(false);

  return (
    <header className="sticky top-0 z-50 h-14 w-full shrink-0 border-b border-slate-800/80 bg-slate-950/90 backdrop-blur-sm group-data-[theme=light]:border-slate-200 group-data-[theme=light]:bg-white/90">
      <div className="flex h-full w-full items-center justify-between pl-4 pr-4 sm:pl-4 sm:pr-6 lg:pl-6 lg:pr-8">
        <div className="flex items-center gap-2 sm:gap-4">
          <Logo />
          <BuyCryptoDropdown />
          <DepositCryptoDropdown />
          <MarketsDropdown />
        </div>

        <nav className="flex items-center gap-2 sm:gap-4 ml-auto">
          {loading ? (
            <div className="h-9 w-24 animate-pulse rounded-lg bg-slate-800 group-data-[theme=light]:bg-slate-200" />
          ) : !user ? (
            <>
              <Link
                href="/login"
                className="rounded-lg px-4 py-2 text-sm font-medium text-slate-300 transition-colors hover:bg-slate-800/80 hover:text-white group-data-[theme=light]:text-slate-600 group-data-[theme=light]:hover:bg-slate-200 group-data-[theme=light]:hover:text-slate-900"
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
            <>
              <Link
                href="/profile"
                className="rounded-lg px-4 py-2 text-sm font-medium transition-colors border-0 outline-none focus:outline-none bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 hover:text-emerald-300 group-data-[theme=light]:bg-emerald-50 group-data-[theme=light]:text-emerald-700 group-data-[theme=light]:hover:bg-emerald-100 group-data-[theme=light]:hover:text-emerald-800"
              >
                Profile
              </Link>
              <button
                type="button"
                onClick={logout}
                className="rounded-lg px-4 py-2 text-sm font-medium transition-colors border-0 outline-none focus:outline-none bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 hover:text-emerald-300 group-data-[theme=light]:bg-emerald-50 group-data-[theme=light]:text-emerald-700 group-data-[theme=light]:hover:bg-emerald-100 group-data-[theme=light]:hover:text-emerald-800"
              >
                Logout
              </button>
            </>
          )}
          <ThemeToggle />
        </nav>
      </div>
    </header>
  );
}
