'use client';

import { useAuth } from '@/lib/useAuth';

export function ImpersonationBanner() {
  const { impersonating, returnToAdmin } = useAuth(false);

  if (!impersonating) return null;

  return (
    <div className="flex items-center justify-center gap-4 border-b-2 border-amber-500/80 bg-amber-500/20 px-4 py-2.5 text-sm font-medium text-amber-200 group-data-[theme=light]:border-amber-600 group-data-[theme=light]:bg-amber-100 group-data-[theme=light]:text-amber-900">
      <span>
        You are currently logged in as <strong>{impersonating.email}</strong>.
      </span>
      <button
        type="button"
        onClick={() => returnToAdmin()}
        className="rounded-lg border border-amber-500/60 bg-amber-500/30 px-4 py-1.5 font-semibold text-amber-100 transition-colors hover:bg-amber-500/50 group-data-[theme=light]:border-amber-600 group-data-[theme=light]:bg-amber-200 group-data-[theme=light]:text-amber-900 group-data-[theme=light]:hover:bg-amber-300"
      >
        Return to Admin Account
      </button>
    </div>
  );
}
