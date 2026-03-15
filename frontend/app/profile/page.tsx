'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { mockUser } from '@/lib/mockUser';

const STORAGE_KEY = 'profile_photo';

const cardClass =
  'rounded-xl border border-slate-700/80 bg-slate-900/50 p-6 transition-colors group-data-[theme=light]:border-slate-200 group-data-[theme=light]:bg-white/80';

export default function ProfilePage() {
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) setPhotoUrl(stored);
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      setPhotoUrl(dataUrl);
      localStorage.setItem(STORAGE_KEY, dataUrl);
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleRemovePhoto = () => {
    setPhotoUrl(null);
    localStorage.removeItem(STORAGE_KEY);
  };

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
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6 mb-6">
            <div className="flex items-center gap-4">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className={
                  photoUrl
                    ? '!bg-transparent !border-0 relative flex items-center justify-center w-24 h-24 rounded-full overflow-hidden ring-1 ring-slate-600/60 transition-all hover:ring-2 hover:ring-emerald-500/50 group-data-[theme=light]:ring-slate-300'
                    : '!bg-slate-800/50 !border-2 !border-slate-500/60 border-dashed relative flex items-center justify-center w-24 h-24 rounded-full overflow-hidden transition-all hover:!border-emerald-500/50 group-data-[theme=light]:!bg-slate-100 group-data-[theme=light]:!border-slate-300'
                }
              >
                {photoUrl ? (
                  <img
                    src={photoUrl}
                    alt="Profile"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="flex flex-col items-center gap-1 text-slate-400 group-data-[theme=light]:text-slate-500">
                    <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.826-2.174a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0zM18.75 10.5h.008v.008h-.008V10.5z" />
                    </svg>
                    <span className="text-xs">Add photo</span>
                  </div>
                )}
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                className="hidden"
              />
            </div>
            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="!bg-transparent !border-0 rounded-lg px-4 py-2 text-sm font-medium text-emerald-400 hover:!bg-emerald-500/10 transition-colors group-data-[theme=light]:text-emerald-600 group-data-[theme=light]:hover:!bg-emerald-50"
              >
                {photoUrl ? 'Change photo' : 'Add photo'}
              </button>
              {photoUrl && (
                <button
                  type="button"
                  onClick={handleRemovePhoto}
                  className="!bg-transparent !border-0 rounded-lg px-4 py-2 text-sm font-medium text-slate-400 hover:text-red-400 hover:!bg-red-500/10 transition-colors group-data-[theme=light]:text-slate-600 group-data-[theme=light]:hover:text-red-600"
                >
                  Remove photo
                </button>
              )}
            </div>
          </div>

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
