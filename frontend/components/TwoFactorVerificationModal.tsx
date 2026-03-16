'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { validateTwoFactorCode } from '@/lib/twoFactorValidation';

interface TwoFactorVerificationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (code: string) => void;
  onResend: () => void;
  loading?: boolean;
  error?: string;
  resendSuccess?: boolean;
}

export function TwoFactorVerificationModal({
  isOpen,
  onClose,
  onSubmit,
  onResend,
  loading = false,
  error,
  resendSuccess = false,
}: TwoFactorVerificationModalProps) {
  const [code, setCode] = useState('');
  const [validationError, setValidationError] = useState<string | undefined>();
  const [resendLoading, setResendLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setCode('');
      setValidationError(undefined);
      inputRef.current?.focus();
    }
  }, [isOpen]);

  useEffect(() => {
    function handleEscape(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      return () => document.removeEventListener('keydown', handleEscape);
    }
  }, [isOpen, onClose]);

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      setValidationError(undefined);
      const err = validateTwoFactorCode(code);
      if (err) {
        setValidationError(err);
        return;
      }
      onSubmit(code);
    },
    [code, onSubmit]
  );

  const handleResend = useCallback(async () => {
    setResendLoading(true);
    await onResend();
    setResendLoading(false);
  }, [onResend]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value.replace(/\D/g, '').slice(0, 6);
    setCode(v);
    setValidationError(undefined);
  };

  if (!isOpen) return null;

  const displayError = validationError || error;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="twofactor-title"
      aria-describedby="twofactor-desc"
    >
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-colors"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        className="relative w-full max-w-md rounded-2xl border border-slate-700 bg-slate-900 p-8 shadow-2xl transition-colors
          group-data-[theme=light]:border-slate-200 group-data-[theme=light]:bg-white"
      >
        <h2
          id="twofactor-title"
          className="text-xl font-semibold text-white mb-1 group-data-[theme=light]:text-slate-900"
        >
          Two-Factor Authentication
        </h2>
        <p
          id="twofactor-desc"
          className="text-sm text-slate-400 mb-6 group-data-[theme=light]:text-slate-600"
        >
          Enter the 6-digit code from your authenticator app
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label
              htmlFor="2fa-code"
              className="block text-sm font-medium text-slate-300 mb-2 group-data-[theme=light]:text-slate-700"
            >
              Verification code
            </label>
            <input
              ref={inputRef}
              id="2fa-code"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              value={code}
              onChange={handleChange}
              placeholder="000000"
              disabled={loading}
              className="w-full px-4 py-3 rounded-xl bg-[var(--input-bg)] border border-[var(--border)] text-[var(--text)] placeholder-[var(--text-muted)]
                focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50
                transition-colors text-center text-lg tracking-[0.3em] font-mono"
              aria-invalid={!!displayError}
              aria-describedby={displayError ? '2fa-error' : undefined}
            />
            {displayError && (
              <p
                id="2fa-error"
                className="mt-1.5 text-sm text-red-400"
                role="alert"
              >
                {displayError}
              </p>
            )}
          </div>

          {resendSuccess && (
            <p className="text-sm text-emerald-400" role="status">
              New code sent. Check your authenticator.
            </p>
          )}

          <div className="flex flex-col sm:flex-row gap-3">
            <button
              type="submit"
              disabled={loading || code.length !== 6}
              className="flex-1 py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600 text-white font-medium
                hover:from-emerald-600 hover:to-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:ring-offset-2 focus:ring-offset-slate-900
                transition-all duration-200 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {loading ? 'Verifying...' : 'Verify'}
            </button>
            <button
              type="button"
              onClick={handleResend}
              disabled={resendLoading || loading}
              className="py-3 px-4 rounded-xl border border-slate-600 bg-transparent text-slate-300 font-medium
                hover:bg-slate-800 hover:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50
                transition-colors disabled:opacity-60 disabled:cursor-not-allowed
                group-data-[theme=light]:border-slate-300 group-data-[theme=light]:text-slate-700
                group-data-[theme=light]:hover:bg-slate-100 group-data-[theme=light]:hover:text-slate-900"
            >
              {resendLoading ? 'Sending...' : 'Resend code'}
            </button>
          </div>
        </form>

        <button
          type="button"
          onClick={onClose}
          className="mt-4 w-full text-sm text-slate-400 hover:text-white transition-colors group-data-[theme=light]:hover:text-slate-900"
        >
          ← Back to sign in
        </button>
      </div>
    </div>
  );
}
