'use client';

const MESSAGE = 'for testing purposes only';
const SEPARATOR = ' ✦ ';

function MarqueeContent() {
  const text = `${MESSAGE}${SEPARATOR}`;
  return (
    <>
      <span>{text.repeat(8)}</span>
      <span>{text.repeat(8)}</span>
    </>
  );
}

export function RunningBanner() {
  return (
    <div className="relative overflow-hidden border-b border-slate-700/60 bg-gradient-to-r from-slate-800/95 via-slate-700/90 to-slate-800/95 group-data-[theme=light]:from-slate-200 group-data-[theme=light]:via-slate-100 group-data-[theme=light]:to-slate-200">
      <div className="flex h-9 items-center">
        <div className="marquee-track inline-flex items-center whitespace-nowrap py-2">
          <span className="px-4 text-sm font-semibold uppercase tracking-[0.25em] text-red-400 group-data-[theme=light]:text-red-600">
            <MarqueeContent />
          </span>
        </div>
      </div>
    </div>
  );
}
