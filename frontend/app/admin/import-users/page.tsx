'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/useAuth';
import { adminApi, type AdminCreatedUserResponse } from '@/lib/api';
import {
  getCsvTemplateBlob,
  MAX_IMPORT_FILE_BYTES,
  parseImportFileContent,
  validateRowsForDuplicatesAndFields,
  type AdminCreateUserPayload,
} from '@/lib/adminUserImport';

const buttonBase =
  'rounded-lg px-4 py-2 text-sm font-medium transition-colors border-0 outline-none focus:outline-none bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 hover:text-emerald-300 group-data-[theme=light]:bg-emerald-50 group-data-[theme=light]:text-emerald-700 group-data-[theme=light]:hover:bg-emerald-100 group-data-[theme=light]:hover:text-emerald-800';
const inputBase =
  'w-full px-4 py-3 rounded-xl bg-slate-800/80 border border-slate-600 text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50 transition-colors group-data-[theme=light]:bg-slate-100 group-data-[theme=light]:border-slate-300 group-data-[theme=light]:text-slate-900 group-data-[theme=light]:placeholder-slate-500';
const primaryBtn =
  'rounded-xl px-6 py-3.5 bg-gradient-to-r from-emerald-500 to-emerald-600 text-white font-medium hover:from-emerald-600 hover:to-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:ring-offset-2 focus:ring-offset-slate-900 transition-all duration-200 disabled:opacity-60 disabled:cursor-not-allowed group-data-[theme=light]:focus:ring-offset-white';
const compactInput =
  'rounded-lg border border-slate-600 bg-slate-800/80 px-3 py-2 text-sm text-white focus:border-emerald-500 focus:outline-none group-data-[theme=light]:border-slate-300 group-data-[theme=light]:bg-white group-data-[theme=light]:text-slate-900';

type Failure = { email: string; reason: string };

export type ImportSuccessRow = {
  request: AdminCreateUserPayload;
  response: AdminCreatedUserResponse;
};

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function cell(v: unknown): string {
  if (v === undefined || v === null || v === '') return '—';
  if (typeof v === 'object') return JSON.stringify(v);
  return String(v);
}

function TruncatedCell({ value, max = 48 }: { value: string; max?: number }) {
  const full = value || '—';
  const short = full.length > max ? `${full.slice(0, max)}…` : full;
  return (
    <span className="font-mono text-xs" title={full.length > max ? full : undefined}>
      {short}
    </span>
  );
}

export default function ImportUsersPage() {
  const { user, loading: authLoading, isAdmin } = useAuth(true);
  const router = useRouter();
  const abortedRef = useRef(false);

  const [phase, setPhase] = useState<'idle' | 'ready' | 'running' | 'done'>('idle');
  const [pending, setPending] = useState<{
    validRows: AdminCreateUserPayload[];
    preFailures: Failure[];
    fileName: string;
  } | null>(null);

  const [fileError, setFileError] = useState('');
  const [currentIndex, setCurrentIndex] = useState(0);
  const [totalToProcess, setTotalToProcess] = useState(0);
  const [successCount, setSuccessCount] = useState(0);
  const [failures, setFailures] = useState<Failure[]>([]);
  const [successes, setSuccesses] = useState<ImportSuccessRow[]>([]);

  const [showPasswords, setShowPasswords] = useState(false);
  const [successFilter, setSuccessFilter] = useState('');
  const [failureFilter, setFailureFilter] = useState('');
  const [profileFilter, setProfileFilter] = useState<'all' | 'with_username' | 'without_username'>('all');
  const [sortOrder, setSortOrder] = useState<'email_asc' | 'email_desc' | 'created_asc'>('email_asc');
  const [requestDelayMs, setRequestDelayMs] = useState(0);

  useEffect(() => {
    if (!user) return;
    if (user.role !== 'admin') {
      router.push('/dashboard');
    }
  }, [user, router]);

  useEffect(() => {
    return () => {
      abortedRef.current = true;
    };
  }, []);

  const downloadTemplate = useCallback(() => {
    const blob = getCsvTemplateBlob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'users-import-template.csv';
    a.click();
    URL.revokeObjectURL(url);
  }, []);

  const exportSuccessesJson = useCallback(() => {
    const payload = successes.map((s) => ({
      sent: s.request,
      created: s.response,
    }));
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `import-success-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [successes]);

  const runImport = useCallback(
    async (rows: AdminCreateUserPayload[], preFailures: Failure[]) => {
      abortedRef.current = false;
      setPhase('running');
      setFailures([...preFailures]);
      setSuccesses([]);
      setSuccessCount(0);
      setCurrentIndex(0);
      setTotalToProcess(rows.length);

      let ok = 0;
      const failList: Failure[] = [...preFailures];
      const okList: ImportSuccessRow[] = [];

      for (let i = 0; i < rows.length; i++) {
        if (abortedRef.current) break;
        setCurrentIndex(i + 1);
        const row = rows[i];
        try {
          if (requestDelayMs > 0) {
            await sleep(requestDelayMs);
          }
          const response = await adminApi.createUser(row);
          ok++;
          okList.push({ request: { ...row }, response });
          setSuccessCount(ok);
          setSuccesses([...okList]);
        } catch (e) {
          const msg = e instanceof Error ? e.message : 'Request failed';
          failList.push({ email: row.email, reason: msg });
          setFailures([...failList]);
        }
      }

      setPhase('done');
    },
    [requestDelayMs]
  );

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    setFileError('');
    if (!file) return;

    if (file.size > MAX_IMPORT_FILE_BYTES) {
      setFileError('File is too large. Maximum size is 5 MB');
      return;
    }

    const text = await file.text();
    const parsed = parseImportFileContent(file.name, text);
    if (!parsed.ok) {
      setFileError(parsed.fileError);
      setPending(null);
      setPhase((prev) => (prev === 'done' ? 'done' : 'idle'));
      return;
    }

    const { validRows, preFailures } = validateRowsForDuplicatesAndFields(parsed.rows);
    setSuccesses([]);
    setPending({ validRows, preFailures, fileName: file.name });
    setPhase('ready');
    setFailures([]);
  };

  const handleStartImport = () => {
    if (!pending || pending.validRows.length === 0) return;
    runImport(pending.validRows, pending.preFailures);
  };

  const reset = () => {
    setPhase('idle');
    setPending(null);
    setFileError('');
    setCurrentIndex(0);
    setTotalToProcess(0);
    setSuccessCount(0);
    setFailures([]);
    setSuccesses([]);
  };

  const filteredFailures = useMemo(() => {
    const q = failureFilter.trim().toLowerCase();
    if (!q) return failures;
    return failures.filter((f) => f.email.toLowerCase().includes(q) || f.reason.toLowerCase().includes(q));
  }, [failures, failureFilter]);

  const filteredAndSortedSuccesses = useMemo(() => {
    let list = [...successes];
    const q = successFilter.trim().toLowerCase();
    if (q) {
      list = list.filter((s) => {
        const p = s.request;
        const prof = s.response.profile;
        const blob = [
          s.response.id,
          p.email,
          p.displayName,
          p.username,
          p.fullName,
          prof?.username,
          prof?.fullName,
          p.location,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        return blob.includes(q);
      });
    }
    if (profileFilter === 'with_username') {
      list = list.filter((s) => s.request.username?.trim() || s.response.profile?.username);
    } else if (profileFilter === 'without_username') {
      list = list.filter((s) => !s.request.username?.trim() && !s.response.profile?.username);
    }
    list.sort((a, b) => {
      if (sortOrder === 'created_asc') {
        const ta = a.response.createdAt ? new Date(a.response.createdAt).getTime() : 0;
        const tb = b.response.createdAt ? new Date(b.response.createdAt).getTime() : 0;
        return ta - tb;
      }
      const ea = a.request.email.toLowerCase();
      const eb = b.request.email.toLowerCase();
      const cmp = ea < eb ? -1 : ea > eb ? 1 : 0;
      return sortOrder === 'email_desc' ? -cmp : cmp;
    });
    return list;
  }, [successes, successFilter, profileFilter, sortOrder]);

  if (authLoading) {
    return (
      <main className="min-h-screen px-4 py-8 sm:px-6 lg:px-8">
        <div className="mx-auto flex max-w-7xl items-center justify-center py-24">
          <span className="animate-pulse text-slate-500">Loading...</span>
        </div>
      </main>
    );
  }

  if (!user || !isAdmin) return null;

  const progressPct =
    totalToProcess > 0 ? Math.round((currentIndex / totalToProcess) * 100) : 0;

  const canRun = phase === 'ready' && pending && pending.validRows.length > 0;

  return (
    <main className="min-h-screen px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-white group-data-[theme=light]:text-slate-900">
              Bulk user import
            </h1>
            <p className="mt-2 max-w-xl text-sm leading-relaxed text-slate-400 group-data-[theme=light]:text-slate-600">
              Add many users at once from CSV or JSON. Invalid rows are skipped; the rest keep running.
            </p>
          </div>
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 rounded-xl border border-slate-600/80 bg-slate-800/50 px-4 py-2.5 text-sm font-medium text-slate-300 transition-colors hover:border-emerald-500/40 hover:bg-slate-800 hover:text-white group-data-[theme=light]:border-slate-200 group-data-[theme=light]:bg-white group-data-[theme=light]:text-slate-700 group-data-[theme=light]:hover:border-emerald-300 group-data-[theme=light]:hover:bg-emerald-50/80"
          >
            <svg className="h-4 w-4 opacity-70" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
            Dashboard
          </Link>
        </div>

        <div className="overflow-hidden rounded-2xl border border-slate-700/80 bg-slate-900/60 shadow-xl shadow-black/20 ring-1 ring-white/5 group-data-[theme=light]:border-slate-200 group-data-[theme=light]:bg-white group-data-[theme=light]:shadow-slate-200/50">
          <div className="border-b border-slate-700/80 bg-gradient-to-r from-emerald-500/[0.07] via-cyan-500/[0.05] to-transparent px-6 py-4 group-data-[theme=light]:border-slate-200 group-data-[theme=light]:from-emerald-50/90 group-data-[theme=light]:via-white group-data-[theme=light]:to-slate-50/80">
            <ol className="flex flex-wrap gap-x-8 gap-y-3 text-sm">
              {[
                { n: '1', t: 'Upload', d: 'CSV or JSON' },
                { n: '2', t: 'Review', d: 'Row counts' },
                { n: '3', t: 'Import', d: 'Saved to DB' },
              ].map((step) => (
                <li key={step.n} className="flex items-center gap-3">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-500/15 text-xs font-bold text-emerald-400 ring-1 ring-emerald-500/25 group-data-[theme=light]:bg-emerald-100 group-data-[theme=light]:text-emerald-800 group-data-[theme=light]:ring-emerald-200">
                    {step.n}
                  </span>
                  <span className="text-slate-200 group-data-[theme=light]:text-slate-800">
                    <span className="font-semibold">{step.t}</span>
                    <span className="block text-xs font-normal text-slate-500 group-data-[theme=light]:text-slate-500">
                      {step.d}
                    </span>
                  </span>
                </li>
              ))}
            </ol>
          </div>

          <div className="space-y-6 p-6 sm:p-8">
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={downloadTemplate}
                className="inline-flex items-center gap-2 rounded-xl border border-slate-600/80 bg-slate-800/40 px-4 py-2.5 text-sm font-medium text-slate-200 transition-all hover:border-emerald-500/35 hover:bg-emerald-500/10 hover:text-emerald-300 group-data-[theme=light]:border-slate-200 group-data-[theme=light]:bg-slate-50 group-data-[theme=light]:text-slate-800 group-data-[theme=light]:hover:border-emerald-300 group-data-[theme=light]:hover:bg-emerald-50"
              >
                <svg className="h-4 w-4 text-emerald-400/90" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                Download CSV template
              </button>
            </div>

            <details className="overflow-hidden rounded-xl border border-slate-700/60 bg-slate-800/30 open:border-emerald-500/25 open:ring-1 open:ring-emerald-500/10 open:[&_svg.import-chevron]:rotate-180 group-data-[theme=light]:border-slate-200 group-data-[theme=light]:bg-slate-50/80">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3.5 text-sm font-medium text-slate-300 transition-colors hover:text-white [&::-webkit-details-marker]:hidden group-data-[theme=light]:text-slate-700 group-data-[theme=light]:hover:text-slate-900">
                <span className="flex items-center gap-2">
                  <svg className="h-4 w-4 text-slate-500 group-data-[theme=light]:text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
                  </svg>
                  Advanced &amp; QA
                  <span className="rounded-md bg-slate-700/50 px-1.5 py-0.5 text-[10px] font-normal uppercase tracking-wide text-slate-400 group-data-[theme=light]:bg-slate-200 group-data-[theme=light]:text-slate-500">
                    Optional
                  </span>
                </span>
                <svg
                  className="import-chevron h-5 w-5 shrink-0 text-slate-500 transition-transform duration-200 group-data-[theme=light]:text-slate-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                  aria-hidden
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
              </summary>
              <div className="border-t border-slate-700/60 px-4 pb-4 pt-1 group-data-[theme=light]:border-slate-200">
                <label className="mt-2 flex max-w-md flex-col gap-2">
                  <span className="text-xs font-medium text-slate-400 group-data-[theme=light]:text-slate-600">
                    Delay between API requests (ms)
                  </span>
                  <div className="flex flex-wrap items-end gap-3">
                    <input
                      id="import-request-delay-ms"
                      type="number"
                      min={0}
                      max={60000}
                      step={50}
                      value={requestDelayMs}
                      onChange={(e) => setRequestDelayMs(Math.max(0, Number(e.target.value) || 0))}
                      className={`${compactInput} w-28`}
                      aria-describedby="import-request-delay-hint"
                    />
                    <p id="import-request-delay-hint" className="max-w-md text-[11px] leading-relaxed text-slate-500 group-data-[theme=light]:text-slate-500">
                      <span className="font-medium text-slate-400 group-data-[theme=light]:text-slate-600">0</span> = fastest.
                      Use <span className="whitespace-nowrap">200–500</span> to watch the progress bar move, or to mimic a slow network.
                    </p>
                  </div>
                </label>
              </div>
            </details>

            {(phase === 'idle' || phase === 'ready') && (
              <div className="space-y-5">
                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-200 group-data-[theme=light]:text-slate-800">
                    File
                  </label>
                  <div className="rounded-xl border border-dashed border-slate-600/90 bg-slate-800/40 p-1 transition-colors hover:border-emerald-500/40 hover:bg-slate-800/60 group-data-[theme=light]:border-slate-300 group-data-[theme=light]:bg-slate-50 group-data-[theme=light]:hover:border-emerald-400/60">
                    <input
                      type="file"
                      accept=".csv,.json,application/json,text/csv"
                      onChange={onFile}
                      className={`${inputBase} w-full max-w-xl border-0 bg-transparent cursor-pointer file:mr-4 file:rounded-lg file:border-0 file:bg-emerald-500/20 file:px-4 file:py-2.5 file:text-sm file:font-medium file:text-emerald-300 group-data-[theme=light]:file:bg-emerald-100 group-data-[theme=light]:file:text-emerald-800`}
                    />
                  </div>
                  <p className="mt-2 text-xs text-slate-500 group-data-[theme=light]:text-slate-500">
                    Accepted: <code className="rounded bg-slate-800/80 px-1.5 py-0.5 text-emerald-400/90 group-data-[theme=light]:bg-slate-200 group-data-[theme=light]:text-emerald-800">.csv</code>{' '}
                    or <code className="rounded bg-slate-800/80 px-1.5 py-0.5 text-emerald-400/90 group-data-[theme=light]:bg-slate-200 group-data-[theme=light]:text-emerald-800">.json</code> · max 5&nbsp;MB
                  </p>
                  {fileError && <p className="mt-2 text-sm text-red-400">{fileError}</p>}
                </div>

                {phase === 'ready' && pending && (
                  <div className="rounded-xl border border-emerald-500/25 bg-gradient-to-br from-emerald-500/[0.08] to-transparent p-5 ring-1 ring-emerald-500/10 group-data-[theme=light]:border-emerald-200 group-data-[theme=light]:from-emerald-50/50 group-data-[theme=light]:to-white group-data-[theme=light]:ring-emerald-100">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className="text-xs font-medium uppercase tracking-wide text-emerald-400/80 group-data-[theme=light]:text-emerald-700">
                          Ready
                        </p>
                        <p className="mt-1 text-sm text-slate-200 group-data-[theme=light]:text-slate-800">
                          <span className="font-semibold text-white group-data-[theme=light]:text-slate-900">{pending.fileName}</span>
                        </p>
                        <p className="mt-2 text-sm text-slate-400 group-data-[theme=light]:text-slate-600">
                          <span className="font-semibold text-emerald-400 group-data-[theme=light]:text-emerald-600">{pending.validRows.length}</span> to create
                          {pending.preFailures.length > 0 && (
                            <>
                              {' '}
                              ·{' '}
                              <span className="font-semibold text-amber-400 group-data-[theme=light]:text-amber-600">
                                {pending.preFailures.length}
                              </span>{' '}
                              skipped (validation)
                            </>
                          )}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={handleStartImport}
                        disabled={!canRun}
                        className={`${primaryBtn} shrink-0 px-8`}
                      >
                        Start import
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {phase === 'done' && (
              <div className="rounded-2xl border border-emerald-500/20 bg-gradient-to-br from-emerald-500/[0.12] via-slate-900/40 to-slate-900/60 p-6 ring-1 ring-emerald-500/10 group-data-[theme=light]:border-emerald-200 group-data-[theme=light]:from-emerald-50/90 group-data-[theme=light]:via-white group-data-[theme=light]:to-slate-50 group-data-[theme=light]:ring-emerald-100">
                <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex gap-4">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-emerald-500/20 text-emerald-400 ring-1 ring-emerald-500/30 group-data-[theme=light]:bg-emerald-100 group-data-[theme=light]:text-emerald-700 group-data-[theme=light]:ring-emerald-200">
                      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                      </svg>
                    </div>
                    <div>
                      <h2 className="text-lg font-semibold text-white group-data-[theme=light]:text-slate-900">
                        Run another import
                      </h2>
                      <p className="mt-1 max-w-md text-sm text-slate-400 group-data-[theme=light]:text-slate-600">
                        Clears this report and takes you back to file selection. Your previous results stay in the database.
                      </p>
                    </div>
                  </div>
                  <button type="button" onClick={reset} className={`${primaryBtn} shrink-0 px-8`}>
                    New import
                  </button>
                </div>
              </div>
            )}

          {phase === 'running' && (
            <div className="rounded-xl border border-cyan-500/20 bg-gradient-to-r from-cyan-500/[0.06] to-emerald-500/[0.06] p-5 ring-1 ring-cyan-500/10 group-data-[theme=light]:border-cyan-200 group-data-[theme=light]:from-cyan-50/50 group-data-[theme=light]:to-emerald-50/30 group-data-[theme=light]:ring-cyan-100">
              <p className="text-sm font-medium text-slate-200 group-data-[theme=light]:text-slate-800">
                Importing… <span className="text-emerald-400 group-data-[theme=light]:text-emerald-600">{currentIndex}</span> /{' '}
                {totalToProcess}
              </p>
              <div className="mt-3 h-2.5 max-w-lg overflow-hidden rounded-full bg-slate-700/80 group-data-[theme=light]:bg-slate-200">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-cyan-500 transition-all duration-300"
                  style={{ width: `${progressPct}%` }}
                />
              </div>
              <p className="mt-3 text-sm text-slate-400 group-data-[theme=light]:text-slate-600">
                Created so far:{' '}
                <span className="font-semibold text-emerald-400 group-data-[theme=light]:text-emerald-600">{successCount}</span>
              </p>
            </div>
          )}

          {phase === 'done' && (
            <div className="mt-10 space-y-8 border-t border-slate-700/80 pt-10 group-data-[theme=light]:border-slate-200">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-emerald-400/90 group-data-[theme=light]:text-emerald-700">
                  Results
                </p>
                <h2 className="mt-1 text-xl font-bold tracking-tight text-white group-data-[theme=light]:text-slate-900">
                  Import summary
                </h2>
                <p className="mt-2 text-sm text-slate-400 group-data-[theme=light]:text-slate-600">
                  <span className="font-medium text-emerald-400 group-data-[theme=light]:text-emerald-600">{successCount}</span>{' '}
                  created ·{' '}
                  <span className="font-medium text-red-400 group-data-[theme=light]:text-red-600">{failures.length}</span>{' '}
                  failed
                </p>
              </div>

              {successes.length > 0 && (
                <div>
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                    <h3 className="text-base font-semibold text-white group-data-[theme=light]:text-slate-900">
                      Created users (request payload + server response)
                    </h3>
                    <button type="button" onClick={exportSuccessesJson} className={buttonBase}>
                      Export JSON (QA)
                    </button>
                  </div>
                  <div className="mb-3 flex flex-wrap items-center gap-4">
                    <label className="flex items-center gap-2 text-sm text-slate-400 group-data-[theme=light]:text-slate-600">
                      <input
                        type="checkbox"
                        checked={showPasswords}
                        onChange={(e) => setShowPasswords(e.target.checked)}
                        className="rounded border-slate-600 text-emerald-600 focus:ring-emerald-500"
                      />
                      Show passwords (testing only)
                    </label>
                    <input
                      type="search"
                      placeholder="Filter by email, name, id…"
                      value={successFilter}
                      onChange={(e) => setSuccessFilter(e.target.value)}
                      className={`${compactInput} min-w-[200px] max-w-xs`}
                    />
                    <select
                      value={profileFilter}
                      onChange={(e) => setProfileFilter(e.target.value as typeof profileFilter)}
                      className={compactInput}
                    >
                      <option value="all">Profile: all</option>
                      <option value="with_username">Has username</option>
                      <option value="without_username">No username</option>
                    </select>
                    <select
                      value={sortOrder}
                      onChange={(e) => setSortOrder(e.target.value as typeof sortOrder)}
                      className={compactInput}
                    >
                      <option value="email_asc">Sort: email A→Z</option>
                      <option value="email_desc">Sort: email Z→A</option>
                      <option value="created_asc">Sort: created time</option>
                    </select>
                  </div>
                  <div className="overflow-x-auto rounded-lg border border-slate-700/80 group-data-[theme=light]:border-slate-200">
                    <table className="w-full min-w-[1200px] text-left text-xs">
                      <thead>
                        <tr className="border-b border-slate-700/80 bg-slate-800/50 group-data-[theme=light]:border-slate-200 group-data-[theme=light]:bg-slate-100/80">
                          {[
                            'user id',
                            'email',
                            'password (sent)',
                            'displayName',
                            'username',
                            'fullName',
                            'photoUrl',
                            'bio',
                            'websiteUrl',
                            'location',
                            'birthday',
                            'lang',
                            'timezone',
                            'preferences (sent)',
                            'role',
                            'createdAt',
                          ].map((h) => (
                            <th
                              key={h}
                              className="whitespace-nowrap px-2 py-2 font-medium text-slate-300 group-data-[theme=light]:text-slate-700"
                            >
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {filteredAndSortedSuccesses.map((s) => {
                          const p = s.request;
                          const r = s.response;
                          const pw = showPasswords ? p.password : '••••••••';
                          return (
                            <tr
                              key={r.id}
                              className="border-b border-slate-700/50 group-data-[theme=light]:border-slate-200"
                            >
                              <td className="px-2 py-2 font-mono text-slate-300 group-data-[theme=light]:text-slate-800">
                                <TruncatedCell value={r.id} max={36} />
                              </td>
                              <td className="px-2 py-2 text-slate-200 group-data-[theme=light]:text-slate-900">
                                {p.email}
                              </td>
                              <td className="px-2 py-2 font-mono text-amber-400/90">{pw}</td>
                              <td className="px-2 py-2">{cell(p.displayName)}</td>
                              <td className="px-2 py-2">{cell(p.username)}</td>
                              <td className="px-2 py-2">{cell(p.fullName)}</td>
                              <td className="px-2 py-2">
                                <TruncatedCell value={cell(p.photoUrl)} max={32} />
                              </td>
                              <td className="px-2 py-2">
                                <TruncatedCell value={cell(p.bio)} max={40} />
                              </td>
                              <td className="px-2 py-2">
                                <TruncatedCell value={cell(p.websiteUrl)} max={32} />
                              </td>
                              <td className="px-2 py-2">{cell(p.location)}</td>
                              <td className="px-2 py-2">{cell(p.birthday)}</td>
                              <td className="px-2 py-2">{cell(p.languageCode)}</td>
                              <td className="px-2 py-2">{cell(p.timezone)}</td>
                              <td className="px-2 py-2">
                                <TruncatedCell value={cell(p.preferences)} max={56} />
                              </td>
                              <td className="px-2 py-2">{cell(r.role)}</td>
                              <td className="px-2 py-2 whitespace-nowrap text-slate-400 group-data-[theme=light]:text-slate-600">
                                {r.createdAt ? new Date(r.createdAt).toISOString() : '—'}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  {filteredAndSortedSuccesses.length === 0 && successes.length > 0 && (
                    <p className="mt-2 text-sm text-amber-400">No rows match the current filters.</p>
                  )}
                </div>
              )}

              {failures.length > 0 && (
                <div>
                  <h3 className="mb-3 text-base font-semibold text-white group-data-[theme=light]:text-slate-900">
                    Failures
                  </h3>
                  <input
                    type="search"
                    placeholder="Filter failures…"
                    value={failureFilter}
                    onChange={(e) => setFailureFilter(e.target.value)}
                    className={`${compactInput} mb-3 max-w-xs`}
                  />
                  <div className="overflow-x-auto rounded-lg border border-slate-700/80 group-data-[theme=light]:border-slate-200">
                    <table className="w-full text-left text-sm">
                      <thead>
                        <tr className="border-b border-slate-700/80 bg-slate-800/50 group-data-[theme=light]:border-slate-200 group-data-[theme=light]:bg-slate-100/80">
                          <th className="px-4 py-2 font-medium text-slate-300 group-data-[theme=light]:text-slate-700">
                            Email
                          </th>
                          <th className="px-4 py-2 font-medium text-slate-300 group-data-[theme=light]:text-slate-700">
                            Reason
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredFailures.map((f, i) => (
                          <tr
                            key={`${f.email}-${i}`}
                            className="border-b border-slate-700/50 group-data-[theme=light]:border-slate-200"
                          >
                            <td className="px-4 py-2 text-slate-200 group-data-[theme=light]:text-slate-900">
                              {f.email}
                            </td>
                            <td className="px-4 py-2 text-red-400">{f.reason}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {filteredFailures.length === 0 && failures.length > 0 && (
                    <p className="mt-2 text-sm text-amber-400">No failures match the filter.</p>
                  )}
                </div>
              )}
            </div>
          )}
          </div>
        </div>
      </div>
    </main>
  );
}
