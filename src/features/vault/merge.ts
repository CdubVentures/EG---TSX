// ─── Vault Merge ────────────────────────────────────────────────────────────
// Pure function: merges guest and server vault entries.
// Extracted from sync.ts so it can be unit-tested without browser/auth deps.

import type { VaultEntry } from './types.ts';
import { VAULT_MAX_PER_CATEGORY } from './types.ts';

/** Union by product ID. Guest entries win on conflict. Respects max 16/category. */
export function mergeVaults(guest: VaultEntry[], server: VaultEntry[]): VaultEntry[] {
  const seen = new Set<string>();
  const categoryCounts: Record<string, number> = {};
  const result: VaultEntry[] = [];

  function tryAdd(entry: VaultEntry): void {
    if (seen.has(entry.product.id)) return;
    const cat = entry.product.category;
    const count = categoryCounts[cat] ?? 0;
    if (count >= VAULT_MAX_PER_CATEGORY) return;
    seen.add(entry.product.id);
    categoryCounts[cat] = count + 1;
    result.push(entry);
  }

  // Guest entries first (they win on conflict)
  for (const entry of guest) tryAdd(entry);
  // Then server entries
  for (const entry of server) tryAdd(entry);

  return result;
}
