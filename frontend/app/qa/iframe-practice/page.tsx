import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Iframe form practice | CryptoSandboxQA',
  description: 'Same-origin iframe with a training form for QA automation (frameLocator, labels, data-testid).',
};

const IFRAME_SRC = '/qa/iframe-form.html';

export default function IframePracticePage() {
  return (
    <main className="min-h-screen transition-colors duration-200 px-4 py-6 sm:px-6 sm:py-8">
      <div className="max-w-3xl mx-auto">
        <div className="mb-6">
          <Link
            href="/"
            className="text-slate-400 hover:text-white group-data-[theme=light]:hover:text-slate-900 transition-colors"
          >
            ← Back to home
          </Link>
        </div>
        <h1 className="text-2xl font-bold text-white group-data-[theme=light]:text-slate-900 mb-2">
          Iframe form practice
        </h1>
        <p className="text-slate-400 group-data-[theme=light]:text-slate-600 mb-6">
          The widget below loads <code className="text-emerald-400/90 group-data-[theme=light]:text-emerald-700">/qa/iframe-form.html</code>{' '}
          in a same-origin iframe. In tools like Playwright, interact with fields using{' '}
          <code className="text-emerald-400/90 group-data-[theme=light]:text-emerald-700">frameLocator</code> (or
          equivalent) — selectors on the <strong className="text-slate-300 group-data-[theme=light]:text-slate-800">page</strong> will not find
          inputs inside the frame unless you scope to the frame first.
        </p>

        <div className="rounded-xl border border-slate-700/80 bg-slate-900/50 group-data-[theme=light]:border-slate-200 group-data-[theme=light]:bg-white/80 p-4 sm:p-6 mb-6">
          <p className="text-sm text-slate-400 group-data-[theme=light]:text-slate-600 mb-3">
            <span className="font-medium text-slate-300 group-data-[theme=light]:text-slate-800">Challenge:</span> fill
            email and amount, accept terms, submit, then assert the success message — all from inside the iframe.
          </p>
          <div className="rounded-lg overflow-hidden border border-slate-700/60 group-data-[theme=light]:border-slate-200 bg-slate-950 group-data-[theme=light]:bg-slate-100">
            <iframe
              title="Training deposit widget"
              src={IFRAME_SRC}
              data-testid="practice-iframe"
              className="w-full min-h-[520px] border-0 bg-transparent"
            />
          </div>
        </div>

        <div className="rounded-xl border border-slate-700/80 bg-slate-900/30 group-data-[theme=light]:border-slate-200 group-data-[theme=light]:bg-slate-50 p-4 sm:p-5 text-sm text-slate-400 group-data-[theme=light]:text-slate-600 space-y-2">
          <p className="font-medium text-slate-300 group-data-[theme=light]:text-slate-800">Stable hooks in the iframe</p>
          <ul className="list-disc pl-5 space-y-1">
            <li>
              <code className="text-emerald-400/90 group-data-[theme=light]:text-emerald-700">data-testid</code>:{' '}
              <code className="text-slate-300 group-data-[theme=light]:text-slate-800">iframe-email</code>,{' '}
              <code className="text-slate-300 group-data-[theme=light]:text-slate-800">iframe-amount</code>,{' '}
              <code className="text-slate-300 group-data-[theme=light]:text-slate-800">iframe-reference</code>,{' '}
              <code className="text-slate-300 group-data-[theme=light]:text-slate-800">iframe-terms</code>,{' '}
              <code className="text-slate-300 group-data-[theme=light]:text-slate-800">iframe-submit</code>,{' '}
              <code className="text-slate-300 group-data-[theme=light]:text-slate-800">iframe-success</code>
            </li>
            <li>
              Labels are wired with <code className="text-emerald-400/90 group-data-[theme=light]:text-emerald-700">for</code> /{' '}
              <code className="text-emerald-400/90 group-data-[theme=light]:text-emerald-700">id</code> so{' '}
              <code className="text-slate-300 group-data-[theme=light]:text-slate-800">getByLabel</code> works inside the
              frame.
            </li>
          </ul>
        </div>
      </div>
    </main>
  );
}
