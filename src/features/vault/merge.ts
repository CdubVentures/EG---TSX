import type { VaultEntry } from './types.ts';
import { VAULT_MAX_PER_CATEGORY } from './types.ts';

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}

function normalizeMergeEntry(entry: VaultEntry): VaultEntry | null {
  const productId =
    (isNonEmptyString(entry.productId) ? entry.productId : null)
    ?? (entry.product && isNonEmptyString(entry.product.id) ? entry.product.id : null);
  const category =
    (isNonEmptyString(entry.category) ? entry.category : null)
    ?? (entry.product && isNonEmptyString(entry.product.category) ? entry.product.category : null);
  if (!productId || !category || !entry.product) return null;

  return {
    ...entry,
    productId,
    category: category as VaultEntry['category'],
    product: {
      ...entry.product,
      id: productId,
      category: category as VaultEntry['category'],
    },
  };
}

export function mergeVaults(guest: VaultEntry[], server: VaultEntry[]): VaultEntry[] {
  const seen = new Set<string>();
  const categoryCounts: Record<string, number> = {};
  const result: VaultEntry[] = [];

  function tryAdd(entry: VaultEntry): void {
    const normalizedEntry = normalizeMergeEntry(entry);
    if (!normalizedEntry) return;

    if (seen.has(normalizedEntry.productId)) return;
    const cat = normalizedEntry.category;
    const count = categoryCounts[cat] ?? 0;
    if (count >= VAULT_MAX_PER_CATEGORY) return;
    seen.add(normalizedEntry.productId);
    categoryCounts[cat] = count + 1;
    result.push(normalizedEntry);
  }

  for (const entry of guest) tryAdd(entry);
  for (const entry of server) tryAdd(entry);

  return result;
}
