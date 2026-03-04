// ─── VaultToggleButton ──────────────────────────────────────────────────────
// React island for "Add to Vault" / "Remove from Vault" toggle on product cards.
// Renders a compact +/- button with "COMPARE" text.

import { useStore } from '@nanostores/react';
import { $vault, addToVault, removeFromVault } from '../store';
import type { VaultProduct } from '../types';

interface VaultToggleButtonProps {
  product: VaultProduct;
}

export default function VaultToggleButton({ product }: VaultToggleButtonProps) {
  const { entries } = useStore($vault);
  const inVault = entries.some(e => e.product.id === product.id);

  function handleClick() {
    if (inVault) {
      removeFromVault(product.id);
    } else {
      addToVault(product);
    }
  }

  return (
    <button
      type="button"
      className={`vault-toggle-btn${inVault ? ' vault-toggle-active' : ''}`}
      onClick={handleClick}
      aria-label={inVault ? `Remove ${product.model} from vault` : `Add ${product.model} to vault`}
      title={inVault ? 'Remove from Comparison Vault' : 'Add to Comparison Vault'}
    >
      <span className="vault-toggle-icon">{inVault ? '\u2212' : '+'}</span>
      <span className="vault-toggle-label">COMPARE</span>
    </button>
  );
}
