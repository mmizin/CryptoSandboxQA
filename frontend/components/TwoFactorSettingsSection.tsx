'use client';

import { useState, useEffect } from 'react';
import { getMock2faEnabled, setMock2faEnabled } from '@/lib/twoFactorMockData';
import { twoFactorApi } from '@/lib/api';

const cardClass =
  'rounded-xl border border-slate-700/80 bg-slate-900/50 p-6 transition-colors group-data-[theme=light]:border-slate-200 group-data-[theme=light]:bg-white/80';

const labelClass =
  'block text-sm font-medium text-slate-300 mb-1.5 group-data-[theme=light]:text-slate-700';

const buttonBase =
  'rounded-lg px-4 py-2 text-sm font-medium transition-colors border-0 outline-none focus:outline-none bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 hover:text-emerald-300 group-data-[theme=light]:bg-emerald-50 group-data-[theme=light]:text-emerald-700 group-data-[theme=light]:hover:bg-emerald-100 group-data-[theme=light]:hover:text-emerald-800';

export function TwoFactorSettingsSection() {
  const [enabled, setEnabled] = useState(false);
  const [qrCodeUrl, setQrCodeUrl] = useState<string>('');
  const [secret, setSecret] = useState<string>('');
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [codesRevealed, setCodesRevealed] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [regenerateSuccess, setRegenerateSuccess] = useState(false);
  const [setupLoading, setSetupLoading] = useState(false);

  useEffect(() => {
    setEnabled(getMock2faEnabled());
  }, []);

  useEffect(() => {
    if (enabled) {
      setSetupLoading(true);
      twoFactorApi
        .getSetup()
        .then(({ qrCodeUrl: url, secret: s }) => {
          setQrCodeUrl(url);
          setSecret(s);
        })
        .finally(() => setSetupLoading(false));
    }
  }, [enabled]);

  useEffect(() => {
    if (enabled) {
      twoFactorApi.getBackupCodes().then(({ codes }) => setBackupCodes(codes));
    }
  }, [enabled]);

  const handleToggle = () => {
    const next = !enabled;
    setEnabled(next);
    setMock2faEnabled(next);
    setShowSuccess(true);
    setTimeout(() => setShowSuccess(false), 3000);
    if (!next) {
      setCodesRevealed(false);
    }
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
        <div className="flex items-center justify-between gap-4">
          <div className="min-w-0 flex-1">
            <p className="font-medium text-white group-data-[theme=light]:text-slate-900">
              Enable 2FA
            </p>
            <p className="text-sm text-slate-400 group-data-[theme=light]:text-slate-600">
              Add an extra layer of security with an authenticator app
            </p>
          </div>
          <button
            type="button"
            onClick={handleToggle}
            className="relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center justify-start rounded-full bg-slate-700 p-0.5 transition-colors group-data-[theme=light]:bg-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500 ring-inset"
            aria-label={enabled ? 'Disable 2FA' : 'Enable 2FA'}
          >
            <span
              className={`inline-block h-5 w-5 shrink-0 rounded-full bg-white shadow transition-transform ${
                enabled ? 'translate-x-5' : 'translate-x-0'
              }`}
            />
          </button>
        </div>

        {showSuccess && (
          <p className="text-sm text-emerald-400" role="status">
            {enabled
              ? '2FA has been enabled for your account.'
              : '2FA has been disabled.'}
          </p>
        )}

        {enabled && (
          <>
            <div>
              <h3 className={labelClass}>Scan QR code</h3>
              <p className="text-sm text-slate-400 mb-3 group-data-[theme=light]:text-slate-600">
                Open your authenticator app (Google Authenticator, Authy, etc.)
                and scan this QR code to add your account.
              </p>
              <div className="inline-block p-3 rounded-lg bg-white">
                {setupLoading ? (
                  <div className="w-32 h-32 flex items-center justify-center text-slate-500 text-sm">
                    Loading...
                  </div>
                ) : qrCodeUrl ? (
                  <img
                    src={qrCodeUrl}
                    alt="QR code for authenticator setup"
                    className="w-32 h-32 object-contain"
                  />
                ) : null}
              </div>
            </div>

            <div>
              <h3 className={labelClass}>Or enter code manually</h3>
              <p className="text-sm text-slate-400 group-data-[theme=light]:text-slate-600">
                If you can&apos;t scan the QR code, enter this key in your
                authenticator app:{' '}
                {secret ? (
                  <code className="font-mono text-xs">{secret}</code>
                ) : (
                  <span className="text-slate-500">—</span>
                )}
              </p>
            </div>

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
          </>
        )}
      </div>
    </section>
  );
}
