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

function getInitials(displayName: string | null, email: string): string {
  if (displayName && displayName.trim()) {
    const parts = displayName.trim().split(/\s+/);
    if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    return displayName.slice(0, 2).toUpperCase();
  }
  return email.slice(0, 2).toUpperCase();
}

function ProfileDropdown({ user, logout }: { user: { displayName: string | null; email: string }; logout: () => void }) {
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

  const initials = getInitials(user.displayName, user.email);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center justify-center w-9 h-9 rounded-full bg-gradient-to-br from-emerald-500/20 to-cyan-500/20 text-emerald-400 ring-1 ring-emerald-500/30 transition-all hover:from-emerald-500/30 hover:to-cyan-500/30 hover:ring-emerald-500/50 focus:outline-none focus:ring-2 focus:ring-emerald-500 group-data-[theme=light]:from-emerald-100 group-data-[theme=light]:to-cyan-100 group-data-[theme=light]:text-emerald-700 group-data-[theme=light]:ring-emerald-300 group-data-[theme=light]:hover:from-emerald-200 group-data-[theme=light]:hover:to-cyan-200"
        aria-expanded={open}
        aria-haspopup="true"
        aria-label="Profile menu"
      >
        <span className="text-sm font-semibold">{initials}</span>
      </button>
      {open && (
        <div
          className="absolute right-0 top-full mt-1.5 min-w-[180px] rounded-lg bg-slate-900/95 py-1 shadow-xl backdrop-blur-sm group-data-[theme=light]:bg-white/95 border border-slate-800/50 group-data-[theme=light]:border-slate-200"
          role="menu"
        >
          <Link
            href="/profile"
            className="flex items-center gap-2 px-4 py-2.5 text-sm text-slate-300 transition-colors hover:bg-slate-800 hover:text-white group-data-[theme=light]:text-slate-700 group-data-[theme=light]:hover:bg-slate-100"
            role="menuitem"
            onClick={() => setOpen(false)}
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
            Profile
          </Link>
          <Link
            href="/profile/portfolio"
            className="flex items-center gap-2 px-4 py-2.5 text-sm text-slate-300 transition-colors hover:bg-slate-800 hover:text-white group-data-[theme=light]:text-slate-700 group-data-[theme=light]:hover:bg-slate-100"
            role="menuitem"
            onClick={() => setOpen(false)}
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3" />
            </svg>
            Portfolio
          </Link>
          <Link
            href="/profile/settings"
            className="flex items-center gap-2 px-4 py-2.5 text-sm text-slate-300 transition-colors hover:bg-slate-800 hover:text-white group-data-[theme=light]:text-slate-700 group-data-[theme=light]:hover:bg-slate-100"
            role="menuitem"
            onClick={() => setOpen(false)}
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            Settings
          </Link>
          <div className="my-1 border-t border-slate-700/80 group-data-[theme=light]:border-slate-200" />
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              logout();
            }}
            className="!bg-transparent !border-0 flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm text-slate-300 transition-colors hover:!bg-slate-800 hover:text-white group-data-[theme=light]:text-slate-700 group-data-[theme=light]:hover:!bg-slate-100"
            role="menuitem"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            Logout
          </button>
        </div>
      )}
    </div>
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
      className="flex items-center justify-center w-9 h-9 rounded-full border-0 outline-none focus:outline-none bg-slate-700/80 ring-1 ring-slate-600/80 text-slate-100 transition-colors hover:bg-slate-600 hover:text-white hover:ring-slate-500 group-data-[theme=light]:bg-slate-200/80 group-data-[theme=light]:ring-slate-300/60 group-data-[theme=light]:text-slate-700 group-data-[theme=light]:hover:bg-slate-300 group-data-[theme=light]:hover:text-slate-900"
    >
      {theme === 'dark' ? (
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v2.25m6.364.386l-1.591 1.591M21 12h-2.25m-.386 6.364l-1.591-1.591M12 18.75V21m-4.773-4.227l-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z" />
        </svg>
      ) : (
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M21.752 15.002A9.718 9.718 0 0118 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 003 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 009.002-5.998z" />
        </svg>
      )}
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
            <ProfileDropdown user={user} logout={logout} />
          )}
          <ThemeToggle />
        </nav>
      </div>
    </header>
  );
}
