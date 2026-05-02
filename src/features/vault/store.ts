import { atom } from 'nanostores';
import type { VaultProduct, VaultEntry, VaultState, VaultStorageScope, AddResult } from './types.ts';
import { VAULT_MAX_PER_CATEGORY, VAULT_LEGACY_KEY, vaultStorageKey } from './types.ts';
import { emitVaultAction } from './vault-action.ts';
import { normalizeContentImagePath } from '@core/image-path';

let _currentScope: VaultStorageScope = 'guest';

function migrateLegacyKey(): void {
  if (typeof globalThis.localStorage === 'undefined') return;
  const legacy = globalThis.localStorage.getItem(VAULT_LEGACY_KEY);
  if (!legacy) return;

  const scopedKey = vaultStorageKey('guest');
  if (!globalThis.localStorage.getItem(scopedKey)) {
    globalThis.localStorage.setItem(scopedKey, legacy);
  }
  globalThis.localStorage.removeItem(VAULT_LEGACY_KEY);
}

migrateLegacyKey();

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function normalizeThumbnailStem(value: unknown): string {
  if (!isNonEmptyString(value)) return 'top';
  const stem = value.trim();
  const normalized = stem.toLowerCase();
  if (normalized === 'undefined' || normalized === 'null' || normalized === 'nan') return 'top';
  return stem;
}

function normalizeImagePath(value: unknown): string | null {
  if (!isNonEmptyString(value)) return null;
  const normalized = normalizeContentImagePath(value);
  return normalized || null;
}

function normalizeProduct(product: VaultProduct): VaultProduct {
  return {
    ...product,
    imagePath: normalizeContentImagePath(product.imagePath),
    thumbnailStem: normalizeThumbnailStem(product.thumbnailStem),
  };
}

function normalizeEntry(raw: unknown): VaultEntry | null {
  if (!raw || typeof raw !== 'object') return null;
  const candidate = raw as Record<string, unknown>;

  if (!candidate.product || typeof candidate.product !== 'object') return null;
  const rawProduct = candidate.product as Record<string, unknown>;

  const productId =
    (isNonEmptyString(candidate.productId) ? candidate.productId : null)
    ?? (isNonEmptyString(rawProduct.id) ? rawProduct.id : null);
  const category =
    (isNonEmptyString(candidate.category) ? candidate.category : null)
    ?? (isNonEmptyString(rawProduct.category) ? rawProduct.category : null);
  const slug = isNonEmptyString(rawProduct.slug) ? rawProduct.slug : null;
  const brand = isNonEmptyString(rawProduct.brand) ? rawProduct.brand : null;
  const model = isNonEmptyString(rawProduct.model) ? rawProduct.model : null;
  const imagePath = normalizeImagePath(rawProduct.imagePath);
  if (!productId || !category || !slug || !brand || !model || !imagePath) return null;

  const addedAtRaw = candidate.addedAt;
  const addedAt = (
    typeof addedAtRaw === 'number'
    && Number.isInteger(addedAtRaw)
    && addedAtRaw >= 0
  )
    ? addedAtRaw
    : Date.now();

  const product: VaultProduct = {
    id: productId,
    slug,
    brand,
    model,
    category: category as VaultProduct['category'],
    imagePath,
    thumbnailStem: normalizeThumbnailStem(rawProduct.thumbnailStem),
  };

  return {
    productId,
    category: category as VaultProduct['category'],
    product,
    addedAt,
  };
}

function normalizeEntries(entries: unknown[]): VaultEntry[] {
  const normalized: VaultEntry[] = [];
  const seen = new Set<string>();
  const categoryCounts: Record<string, number> = {};

  for (const rawEntry of entries) {
    const entry = normalizeEntry(rawEntry);
    if (!entry) continue;
    if (seen.has(entry.productId)) continue;

    const categoryCount = categoryCounts[entry.category] ?? 0;
    if (categoryCount >= VAULT_MAX_PER_CATEGORY) continue;

    seen.add(entry.productId);
    categoryCounts[entry.category] = categoryCount + 1;
    normalized.push(entry);
  }

  return normalized;
}

function loadFromStorage(scope?: VaultStorageScope): VaultState {
  if (typeof globalThis.localStorage === 'undefined') return { entries: [] };
  const key = vaultStorageKey(scope ?? _currentScope);
  try {
    const raw = globalThis.localStorage.getItem(key);
    if (!raw) return { entries: [] };
    const parsed = JSON.parse(raw);
    if (!parsed || !Array.isArray(parsed.entries)) return { entries: [] };
    return { entries: normalizeEntries(parsed.entries) };
  } catch {
    return { entries: [] };
  }
}

export const $vault = atom<VaultState>(loadFromStorage());

export function _flushToStorage(): void {
  if (typeof globalThis.localStorage === 'undefined') return;
  globalThis.localStorage.setItem(vaultStorageKey(_currentScope), JSON.stringify($vault.get()));
}

let debounceTimer: ReturnType<typeof setTimeout> | undefined;

$vault.subscribe(() => {
  if (typeof globalThis.localStorage === 'undefined') return;
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(_flushToStorage, 100);
});

export function addToVault(product: VaultProduct): AddResult {
  const normalizedProduct = normalizeProduct(product);
  const state = $vault.get();

  if (state.entries.some(e => e.productId === normalizedProduct.id)) {
    emitVaultAction({ type: 'duplicate', product: normalizedProduct });
    return 'duplicate';
  }

  const categoryCount = state.entries.filter(e => e.category === normalizedProduct.category).length;
  if (categoryCount >= VAULT_MAX_PER_CATEGORY) {
    emitVaultAction({ type: 'category-full', product: normalizedProduct });
    return 'category-full';
  }

  const entry: VaultEntry = {
    productId: normalizedProduct.id,
    category: normalizedProduct.category,
    product: normalizedProduct,
    addedAt: Date.now(),
  };
  $vault.set({ entries: [...state.entries, entry] });
  emitVaultAction({ type: 'added', product: normalizedProduct });
  return 'added';
}

export function removeFromVault(id: string): void {
  const state = $vault.get();
  const entry = state.entries.find(e => e.productId === id);
  if (!entry) return;
  $vault.set({ entries: state.entries.filter(e => e.productId !== id) });
  emitVaultAction({ type: 'removed', product: entry.product });
}

export function clearCategory(category: string): void {
  const state = $vault.get();
  const count = state.entries.filter(e => e.category === category).length;
  $vault.set({ entries: state.entries.filter(e => e.category !== category) });
  emitVaultAction({ type: 'cleared-category', category, count });
}

export function clearAll(): void {
  const count = $vault.get().entries.length;
  $vault.set({ entries: [] });
  emitVaultAction({ type: 'cleared-all', count });
}

export function moveItem(id: string, newIndex: number): void {
  const state = $vault.get();
  const currentIndex = state.entries.findIndex(e => e.productId === id);
  if (currentIndex === -1) return;

  const entries = [...state.entries];
  const [item] = entries.splice(currentIndex, 1) as [VaultEntry];
  const clampedIndex = Math.max(0, Math.min(newIndex, entries.length));
  entries.splice(clampedIndex, 0, item);
  $vault.set({ entries });
}

export function switchPersona(scope: VaultStorageScope): void {
  _flushToStorage();
  _currentScope = scope;
  $vault.set(loadFromStorage(scope));
}

export function setVaultState(state: VaultState): void {
  $vault.set({ entries: normalizeEntries(state.entries as unknown[]) });
}

export function getCurrentScope(): VaultStorageScope {
  return _currentScope;
}

export function isInVault(id: string): boolean {
  return $vault.get().entries.some(e => e.productId === id);
}

export function vaultCount(): number {
  return $vault.get().entries.length;
}

export function vaultCountByCategory(): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const entry of $vault.get().entries) {
    const cat = entry.category;
    counts[cat] = (counts[cat] ?? 0) + 1;
  }
  return counts;
}

export function vaultItemsByCategory(category: string): VaultEntry[] {
  return $vault.get().entries.filter(e => e.category === category);
}

export function _resetFromStorage(): void {
  $vault.set(loadFromStorage());
}
