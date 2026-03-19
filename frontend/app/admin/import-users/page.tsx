'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/useAuth';
import { adminApi } from '@/lib/api';
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
type Failure = { email: string; reason: string };

export default function ImportUsersPage() {
  const { user, loading: authLoading, isAdmin } = useAuth(true);
  const router = useRouter();
  const abortedRef = useRef(false);

  const [fileError, setFileError] = useState('');
  const [phase, setPhase] = useState<'idle' | 'running' | 'done'>('idle');
  const [currentIndex, setCurrentIndex] = useState(0);
  const [totalToProcess, setTotalToProcess] = useState(0);
  const [successCount, setSuccessCount] = useState(0);
  const [failures, setFailures] = useState<Failure[]>([]);

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

  const runImport = useCallback(
    async (rows: AdminCreateUserPayload[], preFailures: Failure[]) => {
      abortedRef.current = false;
      setPhase('running');
      setFailures([...preFailures]);
      setSuccessCount(0);
      setCurrentIndex(0);
      setTotalToProcess(rows.length);

      let ok = 0;
      const failList: Failure[] = [...preFailures];

      for (let i = 0; i < rows.length; i++) {
        if (abortedRef.current) break;
        setCurrentIndex(i + 1);
        const row = rows[i];
        try {
          await adminApi.createUser(row);
          ok++;
          setSuccessCount(ok);
        } catch (e) {
          const msg = e instanceof Error ? e.message : 'Request failed';
          failList.push({ email: row.email, reason: msg });
          setFailures([...failList]);
        }
      }

      setPhase('done');
    },
    []
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
      return;
    }

    const { validRows, preFailures } = validateRowsForDuplicatesAndFields(parsed.rows);
    await runImport(validRows, preFailures);
  };

  const reset = () => {
    setPhase('idle');
    setFileError('');
    setCurrentIndex(0);
    setTotalToProcess(0);
    setSuccessCount(0);
    setFailures([]);
  };

  if (authLoading) {
    return (
      <main className="min-h-screen px-4 py-8 sm:px-6 lg:px-8">
        <div className="mx-auto flex max-w-3xl items-center justify-center py-24">
          <span className="animate-pulse text-slate-500">Loading...</span>
        </div>
      </main>
    );
  }

  if (!user || !isAdmin) return null;

  const progressPct =
    totalToProcess > 0 ? Math.round((currentIndex / totalToProcess) * 100) : 0;

  return (
    <main className="min-h-screen px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-3xl">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <h1 className="text-2xl font-bold text-white group-data-[theme=light]:text-slate-900">
            Create users from file
          </h1>
          <Link href="/dashboard" className={buttonBase}>
            ← Back to Dashboard
          </Link>
        </div>

        <div className="rounded-xl border border-slate-700/80 bg-slate-900/50 p-6 group-data-[theme=light]:border-slate-200 group-data-[theme=light]:bg-white/80">
          <p className="mb-4 text-sm text-slate-400 group-data-[theme=light]:text-slate-600">
            Upload a <strong className="text-slate-300 group-data-[theme=light]:text-slate-800">CSV</strong> or{' '}
            <strong className="text-slate-300 group-data-[theme=light]:text-slate-800">JSON</strong> file. Users are
            created in the database one at a time; failures are collected and listed at the end without stopping the
            import.
          </p>

          <div className="mb-4 flex flex-wrap gap-3">
            <button type="button" onClick={downloadTemplate} className={buttonBase}>
              Download CSV template
            </button>
          </div>

          {phase === 'idle' || phase === 'done' ? (
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-300 group-data-[theme=light]:text-slate-700">
                Choose file
              </label>
              <input
                type="file"
                accept=".csv,.json,application/json,text/csv"
                onChange={onFile}
                className={`${inputBase} cursor-pointer file:mr-4 file:rounded-lg file:border-0 file:bg-emerald-500/20 file:px-3 file:py-2 file:text-sm file:text-emerald-300 group-data-[theme=light]:file:bg-emerald-100 group-data-[theme=light]:file:text-emerald-800`}
              />
              {fileError && <p className="mt-2 text-sm text-red-400">{fileError}</p>}
              {phase === 'done' && (
                <button type="button" onClick={reset} className={`${buttonBase} mt-4`}>
                  Import another file
                </button>
              )}
            </div>
          ) : null}

          {phase === 'running' && (
            <div className="mt-2">
              <p className="mb-2 text-sm text-slate-300 group-data-[theme=light]:text-slate-700">
                Processing user {currentIndex} of {totalToProcess}…
              </p>
              <div className="h-2 w-full overflow-hidden rounded-full bg-slate-700/80 group-data-[theme=light]:bg-slate-200">
                <div
                  className="h-full bg-gradient-to-r from-emerald-500 to-emerald-600 transition-all duration-300"
                  style={{ width: `${progressPct}%` }}
                />
              </div>
              <p className="mt-2 text-sm text-emerald-400 group-data-[theme=light]:text-emerald-600">
                Succeeded so far: {successCount}
              </p>
            </div>
          )}

          {phase === 'done' && (
            <div className="mt-6 border-t border-slate-700/80 pt-6 group-data-[theme=light]:border-slate-200">
              <h2 className="mb-2 text-lg font-semibold text-white group-data-[theme=light]:text-slate-900">Summary</h2>
              <p className="text-sm text-slate-400 group-data-[theme=light]:text-slate-600">
                Created: <span className="text-emerald-400">{successCount}</span> · Failed:{' '}
                <span className="text-red-400">{failures.length}</span>
              </p>
              {failures.length > 0 && (
                <div className="mt-4 overflow-x-auto rounded-lg border border-slate-700/80 group-data-[theme=light]:border-slate-200">
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
                      {failures.map((f, i) => (
                        <tr
                          key={`${f.email}-${i}`}
                          className="border-b border-slate-700/50 group-data-[theme=light]:border-slate-200"
                        >
                          <td className="px-4 py-2 text-slate-200 group-data-[theme=light]:text-slate-900">{f.email}</td>
                          <td className="px-4 py-2 text-red-400">{f.reason}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
