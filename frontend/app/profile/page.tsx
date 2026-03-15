'use client';

import { useRef, useState, useEffect } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/useAuth';

export default function ProfilePage() {
  const { user, loading: authLoading } = useAuth(true);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    return () => {
      if (photoPreview) URL.revokeObjectURL(photoPreview);
    };
  }, [photoPreview]);

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) return;
    if (photoPreview) URL.revokeObjectURL(photoPreview);
    setPhotoPreview(URL.createObjectURL(file));
  };

  const handlePhotoClick = () => {
    fileInputRef.current?.click();
  };

  const handleRemovePhoto = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (photoPreview) URL.revokeObjectURL(photoPreview);
    setPhotoPreview(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  if (authLoading) {
    return (
      <main className="min-h-screen transition-colors duration-200 px-4 py-8 sm:px-6 lg:px-8">
        <div className="max-w-2xl mx-auto flex items-center justify-center py-24">
          <span className="text-slate-500 animate-pulse">Loading...</span>
        </div>
      </main>
    );
  }
  if (!user) return null;

  const cardClass =
    'rounded-xl border border-slate-700/80 bg-slate-900/50 p-6 transition-colors group-data-[theme=light]:border-slate-200 group-data-[theme=light]:bg-white/80';
  const cardTitle = 'text-lg font-semibold text-white mb-4 group-data-[theme=light]:text-slate-900';
  const buttonBase =
    'rounded-lg px-4 py-2 text-sm font-medium transition-colors border-0 outline-none focus:outline-none bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 hover:text-emerald-300 group-data-[theme=light]:bg-emerald-50 group-data-[theme=light]:text-emerald-700 group-data-[theme=light]:hover:bg-emerald-100 group-data-[theme=light]:hover:text-emerald-800';

  return (
    <main className="min-h-screen transition-colors duration-200 px-4 py-8 sm:px-6 lg:px-8">
      <div className="max-w-2xl mx-auto">
        <div className="mb-8">
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-emerald-400 transition-colors group-data-[theme=light]:text-slate-600 group-data-[theme=light]:hover:text-emerald-600"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to dashboard
          </Link>
        </div>

        <h1 className="text-3xl font-bold text-white tracking-tight mb-8 group-data-[theme=light]:text-slate-900">
          Profile
        </h1>

        <section className={cardClass}>
          <h2 className={cardTitle}>Photo</h2>
          <div className="flex items-center gap-6">
            <button
              type="button"
              onClick={handlePhotoClick}
              className="relative flex-shrink-0 w-24 h-24 rounded-full overflow-hidden border-2 border-dashed border-slate-600 hover:border-emerald-500/50 transition-colors group-data-[theme=light]:border-slate-300 group-data-[theme=light]:hover:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
              aria-label="Add or change photo"
            >
              {photoPreview ? (
                <>
                  <img
                    src={photoPreview}
                    alt="Profile preview"
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-black/40 opacity-0 hover:opacity-100 transition-opacity flex items-center justify-center">
                    <span className="text-white text-xs font-medium">Change</span>
                  </div>
                </>
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-slate-800/50 group-data-[theme=light]:bg-slate-100">
                  <svg
                    className="w-10 h-10 text-slate-500 group-data-[theme=light]:text-slate-400"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.5}
                      d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                    />
                  </svg>
                </div>
              )}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handlePhotoChange}
              className="hidden"
              aria-hidden
            />
            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={handlePhotoClick}
                className={buttonBase + ' self-start'}
              >
                {photoPreview ? 'Change photo' : 'Add photo'}
              </button>
              {photoPreview && (
                <button
                  type="button"
                  onClick={handleRemovePhoto}
                  className="text-sm text-slate-400 hover:text-red-400 transition-colors group-data-[theme=light]:text-slate-600 group-data-[theme=light]:hover:text-red-500"
                >
                  Remove photo
                </button>
              )}
            </div>
          </div>
          <p className="mt-3 text-sm text-slate-500 group-data-[theme=light]:text-slate-500">
            JPG, PNG or GIF. Save functionality coming soon.
          </p>
        </section>

        <section className={`${cardClass} mt-6`}>
          <h2 className={cardTitle}>Account info</h2>
          <div className="space-y-3">
            <div>
              <span className="text-sm text-slate-500 group-data-[theme=light]:text-slate-500">Email</span>
              <p className="text-white group-data-[theme=light]:text-slate-900">{user.email}</p>
            </div>
            <div>
              <span className="text-sm text-slate-500 group-data-[theme=light]:text-slate-500">Display name</span>
              <p className="text-white group-data-[theme=light]:text-slate-900">
                {user.displayName || '—'}
              </p>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
