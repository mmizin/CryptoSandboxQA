'use client';

import Link from 'next/link';
import { mockUser } from '@/lib/mockUser';

const cardClass =
  'rounded-xl border border-slate-700/80 bg-slate-900/50 p-6 transition-colors group-data-[theme=light]:border-slate-200 group-data-[theme=light]:bg-white/80';

export default function ProfilePage() {
  return (
    <main className="min-h-screen transition-colors duration-200 px-4 py-8 sm:px-6 lg:px-8">
      <div className="max-w-2xl mx-auto">
        <div className="mb-6">
          <Link
            href="/dashboard"
            className="text-sm text-slate-400 hover:text-white transition-colors group-data-[theme=light]:hover:text-slate-900"
          >
            ← Back to Dashboard
          </Link>
        </div>

        <h1 className="text-2xl font-bold text-white mb-6 group-data-[theme=light]:text-slate-900">
          Profile
        </h1>

        <section className={cardClass}>
          <h2 className="text-lg font-semibold text-white mb-4 group-data-[theme=light]:text-slate-900">
            Account Information
          </h2>
          <dl className="space-y-4">
            <div>
              <dt className="text-sm text-slate-400 group-data-[theme=light]:text-slate-600">Username</dt>
              <dd className="text-white mt-0.5 group-data-[theme=light]:text-slate-900">{mockUser.username}</dd>
            </div>
            <div>
              <dt className="text-sm text-slate-400 group-data-[theme=light]:text-slate-600">Email</dt>
              <dd className="text-white mt-0.5 group-data-[theme=light]:text-slate-900">{mockUser.email}</dd>
            </div>
            <div>
              <dt className="text-sm text-slate-400 group-data-[theme=light]:text-slate-600">Account ID</dt>
              <dd className="text-sm font-mono text-slate-300 mt-0.5 group-data-[theme=light]:text-slate-700 truncate">
                {mockUser.accountId}
              </dd>
            </div>
            <div>
              <dt className="text-sm text-slate-400 group-data-[theme=light]:text-slate-600">Join date</dt>
              <dd className="text-white mt-0.5 group-data-[theme=light]:text-slate-900">{mockUser.joinDate}</dd>
            </div>
          </dl>
        </section>
      </div>
    </main>
  );
}
