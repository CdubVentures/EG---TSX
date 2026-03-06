// ─── VaultToggleButton ──────────────────────────────────────────────────────
// React island for "Add to Vault" / "Remove from Vault" toggle on product cards.
// Matches HBS compare-toggle HTML structure with SVG symbols, category color,
// scale-pop transition on toggle, glow pulse feedback, and smooth text expand.
// Reactive via nanostores — auto-reflects vault changes from any source.

import { useStore } from '@nanostores/react';
import { useCallback, useRef } from 'react';
import { $vault, addToVault, removeFromVault } from '../store';
import type { VaultProduct } from '../types';

interface VaultToggleButtonProps {
  product: VaultProduct;
}

const TOUCH_CLOSE_MS = 3000;

// WHY SVG: Text +/− have inconsistent baselines across fonts/OS/browsers.
// SVG gives pixel-perfect centering. The rest of the site is SVG-first.
function PlusIcon() {
  return (
    <svg
      className="compare-icon compare-icon-plus"
      viewBox="0 0 16 16"
      width="1em"
      height="1em"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <line x1="8" y1="4.5" x2="8" y2="11.5" />
      <line x1="4.5" y1="8" x2="11.5" y2="8" />
    </svg>
  );
}

function MinusIcon() {
  return (
    <svg
      className="compare-icon compare-icon-minus"
      viewBox="0 0 16 16"
      width="1em"
      height="1em"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <line x1="5" y1="8" x2="11" y2="8" />
    </svg>
  );
}

export default function VaultToggleButton({ product }: VaultToggleButtonProps) {
  const { entries } = useStore($vault);
  const labelRef = useRef<HTMLLabelElement>(null);
  const toggleRef = useRef<HTMLDivElement>(null);
  const touchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const inVault = entries.some(e => e.product.id === product.id);

  const handleClick = useCallback((e: React.MouseEvent) => {
    // WHY: prevent the label's default checkbox toggle — React owns checked state
    e.preventDefault();

    // Trigger glow pulse on the wrapper
    const wrapper = toggleRef.current;
    if (wrapper) {
      wrapper.classList.remove('vault-pulse');
      // Force reflow so re-adding the class restarts the animation
      void wrapper.offsetWidth;
      wrapper.classList.add('vault-pulse');
    }

    if (inVault) {
      removeFromVault(product.id);
    } else {
      addToVault(product);
    }
  }, [inVault, product]);

  // Touch: first tap expands label to show "COMPARE" text, second tap toggles
  const handleTouch = useCallback((e: React.TouchEvent) => {
    const label = labelRef.current;
    if (!label) return;
    if (!label.classList.contains('touch-open')) {
      e.preventDefault();
      label.classList.add('touch-open');
      if (touchTimerRef.current) clearTimeout(touchTimerRef.current);
      touchTimerRef.current = setTimeout(() => label.classList.remove('touch-open'), TOUCH_CLOSE_MS);
    }
    // If already touch-open, let the click handler fire normally
  }, []);

  const checkboxId = `compare-${product.category}-${product.slug}`;

  return (
    <div
      ref={toggleRef}
      className={`compare-toggle ${product.category}-color`}
      data-id={product.slug}
      data-category={product.category}
      data-vault-mount
    >
      <input
        type="checkbox"
        className="compare-checkbox"
        id={checkboxId}
        checked={inVault}
        readOnly
        aria-label={inVault ? `Remove ${product.model} from vault` : `Add ${product.model} to vault`}
      />
      <label
        ref={labelRef}
        htmlFor={checkboxId}
        className="compare-label"
        onClick={handleClick}
        onTouchStart={handleTouch}
      >
        <span className="compare-text">COMPARE</span>
        <span className="compare-symbol">
          <span className={`compare-sym-slot ${inVault ? 'is-active' : ''}`}>
            {inVault ? <MinusIcon /> : <PlusIcon />}
          </span>
        </span>
      </label>
    </div>
  );
}
