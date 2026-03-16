'use client';

import { useState, useEffect } from 'react';
import { twoFactorApi } from '@/lib/api';

const cardClass =
  'rounded-xl border border-slate-700/80 bg-slate-900/50 p-6 transition-colors group-data-[theme=light]:border-slate-200 group-data-[theme=light]:bg-white/80';

const labelClass =
  'block text-sm font-medium text-slate-300 mb-1.5 group-data-[theme=light]:text-slate-700';

const buttonBase =
  'rounded-lg px-4 py-2 text-sm font-medium transition-colors border-0 outline-none focus:outline-none bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 hover:text-emerald-300 group-data-[theme=light]:bg-emerald-50 group-data-[theme=light]:text-emerald-700 group-data-[theme=light]:hover:bg-emerald-100 group-data-[theme=light]:hover:text-emerald-800';

export function TwoFactorSettingsSection() {
  const [enabled, setEnabled] = useState(false);
  const [setupInProgress, setSetupInProgress] = useState(false);
  const [qrCodeUrl, setQrCodeUrl] = useState<string>('');
  const [secret, setSecret] = useState<string>('');
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [codesRevealed, setCodesRevealed] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [regenerateSuccess, setRegenerateSuccess] = useState(false);
  const [setupLoading, setSetupLoading] = useState(false);
  const [verifyCode, setVerifyCode] = useState('');
  const [disableCode, setDisableCode] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    twoFactorApi.getStatus().then(({ enabled }) => setEnabled(enabled)).catch(() => setEnabled(false));
  }, []);

  useEffect(() => {
    if (enabled && !setupInProgress) {
      twoFactorApi.getBackupCodes().then(({ codes }) => setBackupCodes(codes)).catch(() => setBackupCodes([]));
    }
  }, [enabled, setupInProgress]);

  const handleStartSetup = async () => {
    setError('');
    setSetupLoading(true);
    try {
      const { qrCodeUrl: url, secret: s } = await twoFactorApi.getSetup();
      setQrCodeUrl(url);
      setSecret(s);
      setSetupInProgress(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Setup failed');
    } finally {
      setSetupLoading(false);
    }
  };

  const handleEnable = async () => {
    setError('');
    setSetupLoading(true);
    try {
      const result = await twoFactorApi.enable(verifyCode);
      setEnabled(true);
      setSetupInProgress(false);
      setVerifyCode('');
      setQrCodeUrl('');
      setSecret('');
      setBackupCodes(result.backupCodes ?? []);
      setCodesRevealed(true);
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Invalid code');
    } finally {
      setSetupLoading(false);
    }
  };

  const handleDisable = async () => {
    setError('');
    setSetupLoading(true);
    try {
      await twoFactorApi.disable(disableCode);
      setEnabled(false);
      setDisableCode('');
      setCodesRevealed(false);
      setBackupCodes([]);
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Invalid code');
    } finally {
      setSetupLoading(false);
    }
  };

  const handleCancelSetup = () => {
    setSetupInProgress(false);
    setQrCodeUrl('');
    setSecret('');
    setVerifyCode('');
    setError('');
  };

  const handleRegenerate = async () => {
    const { codes } = await twoFactorApi.regenerateBackupCodes();
    setBackupCodes(codes);
    setRegenerateSuccess(true);
    setTimeout(() => setRegenerateSuccess(false), 3000);
  };

  return (
    <section className={cardClass}>
      <h2 className="text-lg font-semibold text-white mb-4 group-data-[theme=light]:text-slate-900">
        Two-Factor Authentication (2FA)
      </h2>

      <div className="space-y-6">
        {error && <p className="text-sm text-red-400">{error}</p>}
        {showSuccess && (
          <p className="text-sm text-emerald-400" role="status">
            {enabled ? '2FA has been enabled for your account.' : '2FA has been disabled.'}
          </p>
        )}

        {!enabled && !setupInProgress && (
          <div>
            <p className="font-medium text-white mb-2 group-data-[theme=light]:text-slate-900">
              Enable 2FA
            </p>
            <p className="text-sm text-slate-400 mb-4 group-data-[theme=light]:text-slate-600">
              Add an extra layer of security with an authenticator app
            </p>
            <button
              type="button"
              onClick={handleStartSetup}
              disabled={setupLoading}
              className={buttonBase}
            >
              {setupLoading ? 'Loading...' : 'Set up 2FA'}
            </button>
          </div>
        )}

        {setupInProgress && (
          <>
            <div>
              <h3 className={labelClass}>Scan QR code</h3>
              <p className="text-sm text-slate-400 mb-3 group-data-[theme=light]:text-slate-600">
                Open your authenticator app and scan this QR code.
              </p>
              {qrCodeUrl && (
                <div className="inline-block p-3 rounded-lg bg-white mb-4">
                  <img src={qrCodeUrl} alt="QR code" className="w-32 h-32 object-contain" />
                </div>
              )}
              <p className="text-sm text-slate-400 mb-2 group-data-[theme=light]:text-slate-600">
                Or enter manually: <code className="font-mono text-xs">{secret}</code>
              </p>
              <div className="flex gap-2 items-center mt-2">
                <input
                  type="text"
                  placeholder="Enter 6-digit code"
                  value={verifyCode}
                  onChange={(e) => setVerifyCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  maxLength={6}
                  className="w-32 px-3 py-2 rounded-lg bg-[var(--input-bg)] border border-[var(--border)] text-[var(--text)]"
                />
                <button type="button" onClick={handleEnable} disabled={setupLoading || verifyCode.length !== 6} className={buttonBase}>
                  {setupLoading ? 'Verifying...' : 'Verify & Enable'}
                </button>
                <button type="button" onClick={handleCancelSetup} className="text-slate-400 hover:text-slate-300 text-sm">
                  Cancel
                </button>
              </div>
            </div>
          </>
        )}

        {enabled && !setupInProgress && (
          <>
            <div>
              <h3 className={labelClass}>Backup codes</h3>
              <p className="text-sm text-slate-400 mb-3 group-data-[theme=light]:text-slate-600">
                Save these codes in a secure place. Each can be used once to
                access your account if you lose your authenticator device.
              </p>
              {codesRevealed ? (
                <div className="space-y-2">
                  <div className="grid grid-cols-2 gap-2 font-mono text-sm text-slate-300 group-data-[theme=light]:text-slate-700">
                    {(backupCodes.length > 0 ? backupCodes : ['—']).map((c, i) => (
                      <div key={i} className="px-2 py-1 bg-slate-800/50 rounded group-data-[theme=light]:bg-slate-100">
                        {c}
                      </div>
                    ))}
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    <button
                      type="button"
                      onClick={handleRegenerate}
                      className={buttonBase}
                    >
                      Regenerate codes
                    </button>
                    {regenerateSuccess && (
                      <span className="text-sm text-emerald-400 self-center">
                        Codes regenerated
                      </span>
                    )}
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setCodesRevealed(true)}
                  className={buttonBase}
                >
                  Show backup codes
                </button>
              )}
            </div>

            <div>
              <h3 className={labelClass}>Disable 2FA</h3>
              <p className="text-sm text-slate-400 mb-2 group-data-[theme=light]:text-slate-600">
                Enter your authenticator code or a backup code to disable 2FA.
              </p>
              <div className="flex gap-2 items-center">
                <input
                  type="text"
                  placeholder="Enter code"
                  value={disableCode}
                  onChange={(e) => setDisableCode(e.target.value)}
                  className="w-32 px-3 py-2 rounded-lg bg-[var(--input-bg)] border border-[var(--border)] text-[var(--text)]"
                />
                <button
                  type="button"
                  onClick={handleDisable}
                  disabled={setupLoading || !disableCode}
                  className="rounded-lg px-4 py-2 text-sm font-medium bg-red-500/10 text-red-400 hover:bg-red-500/20"
                >
                  {setupLoading ? 'Disabling...' : 'Disable 2FA'}
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </section>
  );
}
