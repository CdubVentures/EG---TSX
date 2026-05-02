// ─── ToastContainer ────────────────────────────────────────────────────────
// Fixed-position container for toast notifications. Mounts once in MainLayout.
// Subscribes to $notifications nanostore, renders the appropriate component
// per notification kind.

import { useStore } from '@nanostores/react';
import { $notifications } from '../store';
import type { Notification } from '../types';
import VaultToast from './VaultToast';

function renderToast(notification: Notification) {
  switch (notification.kind) {
    case 'vault':
      return <VaultToast key={notification.id} notification={notification} />;
    default:
      return null;
  }
}

export default function ToastContainer() {
  const notifications = useStore($notifications);

  if (notifications.length === 0) return null;

  return (
    <>
      {/* Accessible live region — screen readers announce additions */}
      <div className="toast-container" aria-label="Notifications">
        {notifications.map(renderToast)}
      </div>

      <style>{`
        /* ─── Toast Container ─────────────────────────────────────── */
        .toast-container {
          position: fixed;
          bottom: var(--font-size-16px);
          right: var(--font-size-16px);
          z-index: 5000;
          display: flex;
          flex-direction: column-reverse;
          gap: var(--font-size-10px);
          pointer-events: none;
        }

        /* ─── Toast Base ──────────────────────────────────────────── */
        .vault-toast {
          position: relative;
          display: flex;
          align-items: center;
          gap: var(--font-size-10px);
          min-width: 340px;
          max-width: 420px;
          padding: var(--font-size-10px) var(--font-size-12px);
          background: var(--section-dark-background-color);
          border: 1px solid var(--section-medium-background-color);
          border-radius: var(--font-size-8px);
          box-shadow: var(--card-shadow);
          overflow: hidden;
          pointer-events: auto;
          /* Entry animation — starts off-screen right */
          transform: translateX(120%);
          opacity: 0;
          transition: transform ${300}ms ease-out, opacity ${300}ms ease-out;
        }

        .vault-toast--entered {
          transform: translateX(0);
          opacity: 1;
        }

        .vault-toast--exit {
          transform: translateX(120%);
          opacity: 0;
          transition: transform ${300}ms ease-in, opacity ${300}ms ease-in;
        }

        /* ─── Reduced motion ──────────────────────────────────────── */
        @media (prefers-reduced-motion: reduce) {
          .vault-toast {
            transform: none;
            transition: opacity 150ms ease;
          }
          .vault-toast--entered {
            transform: none;
          }
          .vault-toast--exit {
            transform: none;
            transition: opacity 150ms ease;
          }
        }

        /* ─── Thumbnail ───────────────────────────────────────────── */
        .vault-toast-thumb {
          width: var(--font-size-48px);
          height: var(--font-size-48px);
          border-radius: var(--font-size-6px);
          object-fit: contain;
          flex-shrink: 0;
          background: var(--section-medium-background-color);
        }

        /* ─── Text ────────────────────────────────────────────────── */
        .vault-toast-body {
          display: flex;
          flex-direction: column;
          flex: 1;
          min-width: 0;
          gap: 2px;
        }

        .vault-toast-brand {
          font-size: var(--font-size-11px);
          color: var(--secondary-text-color);
          font-weight: var(--font-weight5);
          text-transform: uppercase;
          letter-spacing: 0.03em;
          line-height: 1.2;
        }

        .vault-toast-model {
          font-size: var(--font-size-13px);
          color: var(--primary-text-color);
          font-weight: var(--font-weight7);
          line-height: 1.3;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        /* ─── Pill Badge ──────────────────────────────────────────── */
        .vault-toast-pill {
          flex-shrink: 0;
          font-size: var(--font-size-9px);
          font-weight: var(--font-weight7);
          text-transform: uppercase;
          letter-spacing: 0.05em;
          padding: 3px 8px;
          border-radius: var(--font-size-4px);
          line-height: 1.2;
          white-space: nowrap;
        }

        .vault-toast-pill--added {
          background: var(--toast-accent, var(--cat-mouse));
          color: #ffffff;
        }

        .vault-toast-pill--removed {
          background: #d93025;
          color: #ffffff;
        }

        .vault-toast-pill--duplicate {
          background: var(--section-medium-background-color);
          color: var(--secondary-text-color);
        }

        .vault-toast-pill--full {
          background: #f59e0b;
          color: #1a1a1a;
        }

        /* ─── Close Button ────────────────────────────────────────── */
        .vault-toast-close {
          position: absolute;
          top: var(--font-size-6px);
          right: var(--font-size-6px);
          display: flex;
          align-items: center;
          justify-content: center;
          width: var(--font-size-20px);
          height: var(--font-size-20px);
          border: none;
          border-radius: var(--font-size-4px);
          background: transparent;
          color: var(--secondary-text-color);
          cursor: pointer;
          padding: 0;
          opacity: 0.6;
          transition: opacity 150ms ease, background 150ms ease;
        }

        .vault-toast-close:hover {
          opacity: 1;
          background: var(--section-medium-background-color);
        }

        /* ─── Progress Bar ────────────────────────────────────────── */
        .vault-toast-progress {
          position: absolute;
          bottom: 0;
          left: 0;
          height: 3px;
          width: 100%;
          transform-origin: left;
          animation: toast-progress-shrink linear forwards;
          border-radius: 0 0 0 var(--font-size-8px);
        }

        .vault-toast-progress.vault-toast-pill--added {
          background: var(--toast-accent, var(--cat-mouse));
        }

        .vault-toast-progress.vault-toast-pill--removed {
          background: #d93025;
        }

        .vault-toast-progress.vault-toast-pill--duplicate {
          background: var(--section-medium-background-color);
        }

        .vault-toast-progress.vault-toast-pill--full {
          background: #f59e0b;
        }

        @keyframes toast-progress-shrink {
          from { transform: scaleX(1); }
          to   { transform: scaleX(0); }
        }

        /* ─── Responsive: Mobile ──────────────────────────────────── */
        @media (max-width: 600px) {
          .toast-container {
            bottom: var(--font-size-12px);
            right: var(--font-size-12px);
            left: var(--font-size-12px);
          }

          .vault-toast {
            min-width: 0;
            max-width: none;
            width: 100%;
          }
        }
      `}</style>
    </>
  );
}
