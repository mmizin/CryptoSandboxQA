'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';

const buttonBase =
  'rounded-lg px-4 py-2 text-sm font-medium flex items-center gap-1 transition-colors border-0 outline-none focus:outline-none bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 hover:text-emerald-300 group-data-[theme=light]:bg-emerald-50 group-data-[theme=light]:text-emerald-700 group-data-[theme=light]:hover:bg-emerald-100 group-data-[theme=light]:hover:text-emerald-800';

export function TradeDropdown() {
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

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={buttonBase}
        aria-expanded={open}
        aria-haspopup="true"
      >
        Trade
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
            href="/trade/spot"
            className="block px-4 py-2 text-sm text-slate-300 hover:bg-slate-800 hover:text-white group-data-[theme=light]:text-slate-700 group-data-[theme=light]:hover:bg-slate-100"
            role="menuitem"
            onClick={() => setOpen(false)}
          >
            Spot
          </Link>
          <Link
            href="/trade/futures"
            className="block px-4 py-2 text-sm text-slate-300 hover:bg-slate-800 hover:text-white group-data-[theme=light]:text-slate-700 group-data-[theme=light]:hover:bg-slate-100"
            role="menuitem"
            onClick={() => setOpen(false)}
          >
            Futures
          </Link>
        </div>
      )}
    </div>
  );
}
