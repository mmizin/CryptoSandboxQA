'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/useAuth';
import { usersApi } from '@/lib/api';

type UserRow = { id: string; email: string; displayName: string | null; role: string };

const buttonBase =
  'rounded-lg px-4 py-2 text-sm font-medium transition-colors border-0 outline-none focus:outline-none bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 hover:text-emerald-300 group-data-[theme=light]:bg-emerald-50 group-data-[theme=light]:text-emerald-700 group-data-[theme=light]:hover:bg-emerald-100 group-data-[theme=light]:hover:text-emerald-800';
const inputBase =
  'w-full px-4 py-3 rounded-xl bg-slate-800/80 border border-slate-600 text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50 transition-colors group-data-[theme=light]:bg-slate-100 group-data-[theme=light]:border-slate-300 group-data-[theme=light]:text-slate-900 group-data-[theme=light]:placeholder-slate-500';

export default function ImpersonatePage() {
  const { user, loading: authLoading, isAdmin, impersonate } = useAuth(true);
  const router = useRouter();
  const [users, setUsers] = useState<UserRow[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [impersonatingId, setImpersonatingId] = useState<string | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!user) return;
    if (user.role !== 'admin') {
      router.push('/dashboard');
      return;
    }
    setLoading(true);
    usersApi
      .list(search || undefined)
      .then(setUsers)
      .catch(() => setUsers([]))
      .finally(() => setLoading(false));
  }, [user, search, router]);

  const handleImpersonate = async (targetUserId: string) => {
    if (targetUserId === user?.id) {
      setError('You cannot impersonate yourself');
      return;
    }
    setError('');
    setImpersonatingId(targetUserId);
    try {
      await impersonate(targetUserId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Impersonation failed');
      setImpersonatingId(null);
    }
  };

  if (authLoading) {
    return (
      <main className="min-h-screen px-4 py-8 sm:px-6 lg:px-8">
        <div className="mx-auto flex max-w-4xl items-center justify-center py-24">
          <span className="animate-pulse text-slate-500">Loading...</span>
        </div>
      </main>
    );
  }

  if (!user || !isAdmin) return null;

  return (
    <main className="min-h-screen px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-4xl">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-2xl font-bold text-white group-data-[theme=light]:text-slate-900">
            Impersonation Portal
          </h1>
          <Link href="/dashboard" className={buttonBase}>
            ← Back to Dashboard
          </Link>
        </div>

        <div className="rounded-xl border border-slate-700/80 bg-slate-900/50 p-6 group-data-[theme=light]:border-slate-200 group-data-[theme=light]:bg-white/80">
          <p className="mb-4 text-sm text-slate-400 group-data-[theme=light]:text-slate-600">
            Search for users by email or user ID. Click Impersonate to view the app as that user.
          </p>

          <input
            type="text"
            placeholder="Search by email or user ID..."
            className={`${inputBase} mb-4 max-w-md`}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />

          {error && (
            <p className="mb-4 text-sm text-red-400">{error}</p>
          )}

          <div className="overflow-x-auto rounded-lg border border-slate-700/80 group-data-[theme=light]:border-slate-200">
            {loading ? (
              <div className="py-12 text-center text-slate-500">Loading users...</div>
            ) : (
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-700/80 bg-slate-800/50 group-data-[theme=light]:border-slate-200 group-data-[theme=light]:bg-slate-100/80">
                    <th className="px-4 py-3 font-medium text-slate-300 group-data-[theme=light]:text-slate-700">
                      User ID
                    </th>
                    <th className="px-4 py-3 font-medium text-slate-300 group-data-[theme=light]:text-slate-700">
                      Email
                    </th>
                    <th className="px-4 py-3 font-medium text-slate-300 group-data-[theme=light]:text-slate-700">
                      Name
                    </th>
                    <th className="px-4 py-3 font-medium text-slate-300 group-data-[theme=light]:text-slate-700">
                      Role
                    </th>
                    <th className="px-4 py-3 font-medium text-slate-300 group-data-[theme=light]:text-slate-700">
                      Action
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => (
                    <tr
                      key={u.id}
                      className="border-b border-slate-700/50 group-data-[theme=light]:border-slate-200"
                    >
                      <td className="px-4 py-3 font-mono text-xs text-slate-400 group-data-[theme=light]:text-slate-600">
                        {u.id}
                      </td>
                      <td className="px-4 py-3 text-white group-data-[theme=light]:text-slate-900">
                        {u.email}
                      </td>
                      <td className="px-4 py-3 text-slate-300 group-data-[theme=light]:text-slate-700">
                        {u.displayName || '—'}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`rounded px-2 py-0.5 text-xs font-medium ${
                            u.role === 'admin'
                              ? 'bg-amber-500/20 text-amber-400 group-data-[theme=light]:text-amber-600'
                              : 'bg-slate-600/30 text-slate-400 group-data-[theme=light]:text-slate-600'
                          }`}
                        >
                          {u.role}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <button
                          type="button"
                          disabled={u.id === user.id || impersonatingId !== null}
                          onClick={() => handleImpersonate(u.id)}
                          className={`${buttonBase} disabled:cursor-not-allowed disabled:opacity-50`}
                        >
                          {impersonatingId === u.id ? 'Impersonating...' : 'Impersonate'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
