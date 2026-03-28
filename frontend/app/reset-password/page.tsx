'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { authApi } from '@/lib/api';
import {
  AuthMessages,
  EMAIL_MAX_LENGTH,
  RESET_CODE_LENGTH,
  validateEmail,
  validatePassword,
  validateResetCode,
} from '@/lib/authFieldConstraints';

const inputBase =
  'w-full px-4 py-3 rounded-xl bg-[var(--input-bg)] border text-[var(--text)] placeholder-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-colors';
const inputOk = 'border-[var(--border)] focus:border-emerald-500/50';
const inputErr = 'border-red-500 focus:ring-red-500/50 focus:border-red-500/50';

export default function ResetPasswordPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<{
    email?: string;
    code?: string;
    newPassword?: string;
    confirm?: string;
  }>({});
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const emailErr = validateEmail(email);
    const codeErr = validateResetCode(code);
    const passErr = validatePassword(newPassword);
    const confirmErr = validatePassword(confirm);
    const mismatch = newPassword !== confirm ? AuthMessages.passwordsMismatch : undefined;
    if (emailErr || codeErr || passErr || confirmErr || mismatch) {
      setFieldErrors({
        email: emailErr,
        code: codeErr,
        newPassword: passErr,
        confirm: confirmErr || mismatch,
      });
      return;
    }
    setFieldErrors({});
    setLoading(true);
    try {
      await authApi.resetPasswordWithCode(email.trim(), code.replace(/\D/g, ''), newPassword);
      setSuccess(true);
      setTimeout(() => {
        router.push('/');
        router.refresh();
      }, 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Reset failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-slate-950 group-data-[theme=light]:bg-slate-50">
      <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900/50 shadow-xl p-8 group-data-[theme=light]:border-slate-200 group-data-[theme=light]:bg-white">
        <h1 className="text-2xl font-semibold text-white mb-2 group-data-[theme=light]:text-slate-900">
          Reset password
        </h1>
        <p className="text-slate-400 text-sm mb-8 group-data-[theme=light]:text-slate-600">
          Enter the 8-digit code from your email and choose a new password.
        </p>

        {success ? (
          <p className="text-sm text-emerald-400 group-data-[theme=light]:text-emerald-600">
            Password updated. Redirecting to sign in…
          </p>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label
                htmlFor="email"
                className="block text-sm font-medium text-slate-300 mb-2 group-data-[theme=light]:text-slate-700"
              >
                Email
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                maxLength={EMAIL_MAX_LENGTH}
                aria-invalid={!!fieldErrors.email}
                data-testid="reset-password-email"
                onChange={(e) => {
                  setEmail(e.target.value);
                  setFieldErrors((f) => ({ ...f, email: undefined }));
                }}
                className={`${inputBase} ${fieldErrors.email ? inputErr : inputOk}`}
              />
              {fieldErrors.email && (
                <p className="mt-1 text-sm text-red-400" data-testid="reset-password-email-error">
                  {fieldErrors.email}
                </p>
              )}
            </div>
            <div>
              <label
                htmlFor="code"
                className="block text-sm font-medium text-slate-300 mb-2 group-data-[theme=light]:text-slate-700"
              >
                Reset code
              </label>
              <input
                id="code"
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                placeholder="12345678"
                required
                maxLength={RESET_CODE_LENGTH}
                value={code}
                aria-invalid={!!fieldErrors.code}
                data-testid="reset-password-code"
                onChange={(e) => {
                  setCode(e.target.value.replace(/\D/g, '').slice(0, RESET_CODE_LENGTH));
                  setFieldErrors((f) => ({ ...f, code: undefined }));
                }}
                className={`${inputBase} ${fieldErrors.code ? inputErr : inputOk} tracking-widest font-mono`}
              />
              {fieldErrors.code && (
                <p className="mt-1 text-sm text-red-400" data-testid="reset-password-code-error">
                  {fieldErrors.code}
                </p>
              )}
            </div>
            <div>
              <label
                htmlFor="newPassword"
                className="block text-sm font-medium text-slate-300 mb-2 group-data-[theme=light]:text-slate-700"
              >
                New password
              </label>
              <input
                id="newPassword"
                type="password"
                autoComplete="new-password"
                required
                minLength={6}
                value={newPassword}
                aria-invalid={!!fieldErrors.newPassword}
                data-testid="reset-password-new"
                onChange={(e) => {
                  setNewPassword(e.target.value);
                  setFieldErrors((f) => ({ ...f, newPassword: undefined, confirm: undefined }));
                }}
                className={`${inputBase} ${fieldErrors.newPassword ? inputErr : inputOk}`}
              />
              {fieldErrors.newPassword && (
                <p className="mt-1 text-sm text-red-400" data-testid="reset-password-new-error">
                  {fieldErrors.newPassword}
                </p>
              )}
            </div>
            <div>
              <label
                htmlFor="confirm"
                className="block text-sm font-medium text-slate-300 mb-2 group-data-[theme=light]:text-slate-700"
              >
                Confirm password
              </label>
              <input
                id="confirm"
                type="password"
                autoComplete="new-password"
                required
                minLength={6}
                value={confirm}
                aria-invalid={!!fieldErrors.confirm}
                data-testid="reset-password-confirm"
                onChange={(e) => {
                  setConfirm(e.target.value);
                  setFieldErrors((f) => ({ ...f, confirm: undefined }));
                }}
                className={`${inputBase} ${fieldErrors.confirm ? inputErr : inputOk}`}
              />
              {fieldErrors.confirm && (
                <p className="mt-1 text-sm text-red-400" data-testid="reset-password-confirm-error">
                  {fieldErrors.confirm}
                </p>
              )}
            </div>
            {error && <p className="text-sm text-red-400">{error}</p>}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600 text-white font-medium
                hover:from-emerald-600 hover:to-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:ring-offset-2 focus:ring-offset-slate-900
                transition-all duration-200 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {loading ? 'Updating…' : 'Update password'}
            </button>
          </form>
        )}

        <p className="mt-6 text-center text-sm text-slate-400 group-data-[theme=light]:text-slate-600">
          <Link
            href="/forgot-password"
            className="font-medium text-emerald-400 hover:text-emerald-300 transition-colors group-data-[theme=light]:text-emerald-600 group-data-[theme=light]:hover:text-emerald-700"
          >
            Request a new code
          </Link>
          {' · '}
          <Link
            href="/"
            className="font-medium text-emerald-400 hover:text-emerald-300 transition-colors group-data-[theme=light]:text-emerald-600 group-data-[theme=light]:hover:text-emerald-700"
          >
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
