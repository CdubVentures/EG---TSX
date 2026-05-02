// ─── VaultToast ────────────────────────────────────────────────────────────
// Product-specific toast notification for vault add/remove/duplicate/full.
// Theme-aware, accessible, animated. Rendered by ToastContainer.

import { useCallback, useEffect, useRef } from 'react';
import { dismiss } from '../store';
import type { VaultNotification } from '../types';
import { contentImage, tryImageFallback } from '@core/images';

interface VaultToastProps {
  notification: VaultNotification;
}

const PILL_CONFIG: Record<VaultNotification['action'], { label: string; className: string }> = {
  added:          { label: 'ADDED',            className: 'vault-toast-pill--added' },
  removed:        { label: 'REMOVED',          className: 'vault-toast-pill--removed' },
  duplicate:      { label: 'ALREADY IN VAULT', className: 'vault-toast-pill--duplicate' },
  'category-full': { label: 'CATEGORY FULL',   className: 'vault-toast-pill--full' },
};

export default function VaultToast({ notification }: VaultToastProps) {
  const { id, action, product, duration, dismissing } = notification;
  const pill = PILL_CONFIG[action];
  const elRef = useRef<HTMLDivElement>(null);

  // WHY: category CSS var for the accent color on "added" pill
  const accentStyle = action === 'added'
    ? { '--toast-accent': `var(--cat-${product.category})` } as React.CSSProperties
    : undefined;

  const handleDismiss = useCallback(() => dismiss(id), [id]);

  // Keyboard: Escape dismisses the toast
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Escape') dismiss(id);
  }, [id]);

  const thumbUrl = contentImage(product.imagePath, product.thumbnailStem, 'xs');

  // Animate entry via ref class toggle (avoids initial-state flicker)
  useEffect(() => {
    const el = elRef.current;
    if (!el) return;
    // Force reflow before adding enter class
    void el.offsetWidth;
    el.classList.add('vault-toast--entered');
  }, []);

  return (
    <div
      ref={elRef}
      className={`vault-toast ${dismissing ? 'vault-toast--exit' : ''}`}
      style={accentStyle}
      role="status"
      aria-live="polite"
      onKeyDown={handleKeyDown}
    >
      {/* Thumbnail */}
      <img
        className="vault-toast-thumb"
        src={thumbUrl}
        alt=""
        width={56}
        height={56}
        loading="eager"
        onError={(e) => {
          tryImageFallback(e.currentTarget, product.imagePath, product.category, '_xs', product.thumbnailStem);
        }}
      />

      {/* Text */}
      <div className="vault-toast-body">
        <span className="vault-toast-brand">{product.brand}</span>
        <span className="vault-toast-model">{product.model}</span>
      </div>

      {/* Pill badge */}
      <span className={`vault-toast-pill ${pill.className}`}>
        {pill.label}
      </span>

      {/* Close button */}
      <button
        className="vault-toast-close"
        onClick={handleDismiss}
        aria-label="Dismiss notification"
        type="button"
      >
        <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden="true">
          <line x1="4" y1="4" x2="12" y2="12" />
          <line x1="12" y1="4" x2="4" y2="12" />
        </svg>
      </button>

      {/* Progress bar — CSS animation shrinks from 100% to 0% */}
      {duration > 0 && (
        <div
          className={`vault-toast-progress ${pill.className}`}
          style={{
            animationDuration: `${duration}ms`,
            animationPlayState: dismissing ? 'paused' : 'running',
          }}
        />
      )}
    </div>
  );
}
