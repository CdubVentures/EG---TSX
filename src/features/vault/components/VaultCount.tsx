// ─── VaultCount ─────────────────────────────────────────────────────────────
// Tiny React island — renders the vault item count. Returns null when empty.
// Used inside both desktop nav link and mobile icon badge.
//
// WHY mounted guard: Server has no localStorage → entries=[] → renders null.
// Client may have persisted vault items → entries.length > 0 → renders <span>.
// Without the guard, first client render mismatches server HTML → hydration error.

import { useState, useEffect } from 'react';
import { useStore } from '@nanostores/react';
import { $vault } from '../store';

export default function VaultCount() {
  const [mounted, setMounted] = useState(false);
  const { entries } = useStore($vault);

  useEffect(() => { setMounted(true); }, []);

  if (!mounted || entries.length === 0) return null;
  return <span className="nav-vault-item-count">{entries.length}</span>;
}
