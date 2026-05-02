import type { VaultEntry } from './types.ts';

export const VAULT_THUMB_REFRESH_TTL_MS = 60 * 60 * 1000;

export interface VaultThumbResolveRequestItem {
  requestId: string;
  category: string;
}

export interface VaultThumbResolveRequest {
  items: VaultThumbResolveRequestItem[];
}

export interface VaultThumbResolveResponseItem {
  requestId: string;
  productId: string;
  category: string;
  slug: string;
  brand: string;
  model: string;
  imagePath: string;
  thumbnailStem: string;
}

interface ApplyResult {
  entries: VaultEntry[];
  changed: boolean;
}

function normalizeKey(value: string): string {
  return value.trim().toLowerCase();
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function resolveRequestId(entry: VaultEntry): string | null {
  if (isNonEmptyString(entry.productId)) return entry.productId;
  if (entry.product && isNonEmptyString(entry.product.id)) return entry.product.id;
  return null;
}

export function buildThumbResolveRequest(entries: VaultEntry[]): VaultThumbResolveRequest {
  const seen = new Set<string>();
  const items: VaultThumbResolveRequestItem[] = [];

  for (const entry of entries) {
    const requestId = resolveRequestId(entry);
    if (!requestId) continue;
    const key = `${normalizeKey(requestId)}::${normalizeKey(entry.category)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    items.push({
      requestId,
      category: entry.category,
    });
  }

  return { items };
}

export function shouldRefreshThumbCache(
  lastFetchedAt: number,
  now: number = Date.now(),
  ttlMs: number = VAULT_THUMB_REFRESH_TTL_MS,
): boolean {
  if (!Number.isFinite(lastFetchedAt) || lastFetchedAt <= 0) return true;
  return now - lastFetchedAt >= ttlMs;
}

export function applyThumbResolveResult(
  entries: VaultEntry[],
  resolvedItems: VaultThumbResolveResponseItem[],
): ApplyResult {
  const resolvedByRequestAndCategory = new Map<string, VaultThumbResolveResponseItem>();
  for (const item of resolvedItems) {
    const key = `${normalizeKey(item.requestId)}::${normalizeKey(item.category)}`;
    resolvedByRequestAndCategory.set(key, item);
  }

  let changed = false;

  const nextEntries = entries.map((entry) => {
    const requestId = resolveRequestId(entry);
    if (!requestId) return entry;

    const lookupKey = `${normalizeKey(requestId)}::${normalizeKey(entry.category)}`;
    const resolved = resolvedByRequestAndCategory.get(lookupKey);
    if (!resolved) return entry;

    const nextEntry: VaultEntry = {
      ...entry,
      productId: resolved.productId,
      category: resolved.category as VaultEntry['category'],
      product: {
        ...entry.product,
        id: resolved.productId,
        slug: resolved.slug,
        brand: resolved.brand,
        model: resolved.model,
        category: resolved.category as VaultEntry['category'],
        imagePath: resolved.imagePath,
        thumbnailStem: resolved.thumbnailStem,
      },
    };

    if (
      nextEntry.productId !== entry.productId
      || nextEntry.category !== entry.category
      || nextEntry.product.id !== entry.product.id
      || nextEntry.product.slug !== entry.product.slug
      || nextEntry.product.brand !== entry.product.brand
      || nextEntry.product.model !== entry.product.model
      || nextEntry.product.category !== entry.product.category
      || nextEntry.product.imagePath !== entry.product.imagePath
      || nextEntry.product.thumbnailStem !== entry.product.thumbnailStem
    ) {
      changed = true;
      return nextEntry;
    }

    return entry;
  });

  return { entries: nextEntries, changed };
}
