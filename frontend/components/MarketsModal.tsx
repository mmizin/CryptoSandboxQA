'use client';

import { useEffect, useRef, useCallback, type ReactNode } from 'react';
import { useBodyScrollLock } from '@/lib/useBodyScrollLock';

export type MarketsModalRole = 'dialog' | 'alertdialog';

export interface MarketsModalProps {
  open: boolean;
  onClose: () => void;
  titleId: string;
  title: ReactNode;
  descriptionId?: string;
  description?: ReactNode;
  children: ReactNode;
  /** Footer area (e.g. actions); stays outside scroll region if bodyScrollable */
  footer?: ReactNode;
  role?: MarketsModalRole;
  /** Wide layouts for long-form content */
  size?: 'md' | 'lg' | 'xl';
  /** When false, backdrop clicks do not close (still blocks background) */
  closeOnBackdropClick?: boolean;
  /** Disable focus trap when a child modal is stacked above */
  disableFocusTrap?: boolean;
  /** When true, Escape does not close (e.g. parent while a stacked child handles Escape) */
  suppressEscapeClose?: boolean;
  zIndexClass?: string;
  /** Scrollable panel body; header/footer stay visible */
  bodyClassName?: string;
  bodyScrollable?: boolean;
  /** data-testid on the panel for QA */
  panelTestId?: string;
}

const sizeClass: Record<NonNullable<MarketsModalProps['size']>, string> = {
  md: 'max-w-md',
  lg: 'max-w-lg',
  xl: 'max-w-2xl',
};

export function MarketsModal({
  open,
  onClose,
  titleId,
  title,
  descriptionId,
  description,
  children,
  footer,
  role = 'dialog',
  size = 'md',
  closeOnBackdropClick = true,
  disableFocusTrap = false,
  suppressEscapeClose = false,
  zIndexClass = 'z-50',
  bodyClassName,
  bodyScrollable = false,
  panelTestId,
}: MarketsModalProps) {
  const panelRef = useRef<HTMLDivElement>(null);

  const handleEscape = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !suppressEscapeClose) onClose();
    },
    [onClose, suppressEscapeClose]
  );

  useEffect(() => {
    if (!open || suppressEscapeClose) return;
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [open, suppressEscapeClose, handleEscape]);

  useBodyScrollLock(open);

  useEffect(() => {
    if (!open || disableFocusTrap) return;
    const panel = panelRef.current;
    if (!panel) return;

    const selectors =
      'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
    const getFocusable = () =>
      Array.from(panel.querySelectorAll<HTMLElement>(selectors)).filter(
        (el) => el.offsetParent !== null || el === document.activeElement
      );

    const focusable = getFocusable();
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    first?.focus();

    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== 'Tab' || focusable.length === 0) return;
      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        }
      } else if (document.activeElement === last) {
        e.preventDefault();
        first?.focus();
      }
    }

    panel.addEventListener('keydown', onKeyDown);
    return () => panel.removeEventListener('keydown', onKeyDown);
  }, [open, disableFocusTrap]);

  if (!open) return null;

  const describedBy = descriptionId && description ? descriptionId : undefined;

  return (
    <div className={`fixed inset-0 ${zIndexClass} flex items-center justify-center p-4 sm:p-6`}>
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-colors"
        aria-hidden="true"
        onClick={closeOnBackdropClick ? onClose : undefined}
        data-testid="markets-modal-backdrop"
      />
      <div
        ref={panelRef}
        data-testid={panelTestId}
        role={role}
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={describedBy}
        className={`relative flex max-h-[min(90vh,720px)] w-full flex-col rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl transition-colors group-data-[theme=light]:border-slate-200 group-data-[theme=light]:bg-white ${sizeClass[size]}`}
      >
        <div className="shrink-0 border-b border-slate-700/80 px-6 py-4 group-data-[theme=light]:border-slate-200">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h2
                id={titleId}
                className="text-lg font-semibold text-white group-data-[theme=light]:text-slate-900"
              >
                {title}
              </h2>
              {description && descriptionId ? (
                <p
                  id={descriptionId}
                  className="mt-1 text-sm text-slate-400 group-data-[theme=light]:text-slate-600"
                >
                  {description}
                </p>
              ) : null}
            </div>
            <button
              type="button"
              onClick={onClose}
              className="shrink-0 rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-800 hover:text-white group-data-[theme=light]:hover:bg-slate-100 group-data-[theme=light]:hover:text-slate-900"
              aria-label="Close"
              data-testid="markets-modal-close"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
        <div
          className={
            bodyScrollable
              ? `min-h-0 flex-1 overflow-y-auto px-6 py-4 ${bodyClassName ?? ''}`
              : `px-6 py-4 ${bodyClassName ?? ''}`
          }
        >
          {children}
        </div>
        {footer ? (
          <div className="shrink-0 border-t border-slate-700/80 px-6 py-4 group-data-[theme=light]:border-slate-200">
            {footer}
          </div>
        ) : null}
      </div>
    </div>
  );
}
