'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useTheme } from '@/lib/useTheme';
import { mockUser } from '@/lib/mockUser';

const cardClass =
  'rounded-xl border border-slate-700/80 bg-slate-900/50 p-6 transition-colors group-data-[theme=light]:border-slate-200 group-data-[theme=light]:bg-white/80';

const inputClass =
  'w-full rounded-lg border border-slate-600 bg-slate-800/80 px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-emerald-500 focus:outline-none group-data-[theme=light]:border-slate-300 group-data-[theme=light]:bg-white group-data-[theme=light]:text-slate-900';

const labelClass = 'block text-sm font-medium text-slate-300 mb-1.5 group-data-[theme=light]:text-slate-700';

const buttonBase =
  'rounded-lg px-4 py-2 text-sm font-medium transition-colors border-0 outline-none focus:outline-none bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 hover:text-emerald-300 group-data-[theme=light]:bg-emerald-50 group-data-[theme=light]:text-emerald-700 group-data-[theme=light]:hover:bg-emerald-100 group-data-[theme=light]:hover:text-emerald-800';

export default function SettingsPage() {
  const { theme, toggleTheme } = useTheme();
  const [username, setUsername] = useState(mockUser.username);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');

  return (
    <main className="min-h-screen transition-colors duration-200 px-4 py-8 sm:px-6 lg:px-8">
      <div className="max-w-2xl mx-auto">
        <div className="mb-6">
          <Link
            href="/profile"
            className="text-sm text-slate-400 hover:text-white transition-colors group-data-[theme=light]:hover:text-slate-900"
          >
            ← Back to Profile
          </Link>
        </div>

        <h1 className="text-2xl font-bold text-white mb-6 group-data-[theme=light]:text-slate-900">
          Settings
        </h1>

        <div className="space-y-6">
          <section className={cardClass}>
            <h2 className="text-lg font-semibold text-white mb-4 group-data-[theme=light]:text-slate-900">
              Change username
            </h2>
            <form className="space-y-4">
              <div>
                <label htmlFor="username" className={labelClass}>
                  Username
                </label>
                <input
                  id="username"
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className={inputClass}
                  placeholder="Enter new username"
                />
              </div>
              <button type="button" className={buttonBase}>
                Save changes (UI only)
              </button>
            </form>
          </section>

          <section className={cardClass}>
            <h2 className="text-lg font-semibold text-white mb-4 group-data-[theme=light]:text-slate-900">
              Change password
            </h2>
            <form className="space-y-4">
              <div>
                <label htmlFor="current-password" className={labelClass}>
                  Current password
                </label>
                <input
                  id="current-password"
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  className={inputClass}
                  placeholder="Enter current password"
                />
              </div>
              <div>
                <label htmlFor="new-password" className={labelClass}>
                  New password
                </label>
                <input
                  id="new-password"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className={inputClass}
                  placeholder="Enter new password"
                />
              </div>
              <button type="button" className={buttonBase}>
                Update password (UI only)
              </button>
            </form>
          </section>

          <section className={cardClass}>
            <h2 className="text-lg font-semibold text-white mb-4 group-data-[theme=light]:text-slate-900">
              Appearance
            </h2>
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-white group-data-[theme=light]:text-slate-900">Dark mode</p>
                <p className="text-sm text-slate-400 group-data-[theme=light]:text-slate-600">
                  Toggle between light and dark theme
                </p>
              </div>
              <button
                type="button"
                onClick={toggleTheme}
                className="relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full bg-slate-700 transition-colors group-data-[theme=light]:bg-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 focus:ring-offset-slate-900 group-data-[theme=light]:focus:ring-offset-white"
                aria-label="Toggle dark mode"
              >
                <span
                  className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
                    theme === 'dark' ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
