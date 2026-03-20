'use client';

interface SubmitLoadingBarProps {
  active: boolean;
  /** Shown next to the bar; keep short for form footers */
  label?: string;
}

/**
 * Indeterminate progress bar for async form submits (buy/sell, deposits, orders).
 * Must render inside a parent with `group` + `group-data-[theme=light]` for theme styling.
 */
export function SubmitLoadingBar({ active, label = 'Processing…' }: SubmitLoadingBarProps) {
  if (!active) return null;

  return (
    <div className="space-y-2" role="status" aria-live="polite" aria-busy="true">
      <p className="text-xs font-medium text-amber-400 group-data-[theme=light]:text-amber-600">
        {label}
      </p>
      <div
        className="relative h-2 w-full overflow-hidden rounded-full bg-slate-700/70 ring-1 ring-slate-600/40 group-data-[theme=light]:bg-slate-200 group-data-[theme=light]:ring-slate-300/70"
        aria-hidden
      >
        <div className="absolute inset-y-0 left-0 w-[38%] rounded-full bg-gradient-to-r from-emerald-600 via-emerald-400 to-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.35)] animate-submit-bar" />
      </div>
    </div>
  );
}
