// ─── VaultCount ─────────────────────────────────────────────────────────────
// Tiny React island — renders the vault item count. Returns null when empty.
// Used inside both desktop nav link and mobile icon badge.

import { useStore } from '@nanostores/react';
import { $vault } from '../store';

export default function VaultCount() {
  const { entries } = useStore($vault);
  if (entries.length === 0) return null;
  return <span className="nav-vault-item-count">{entries.length}</span>;
}
