// ─── Vault Store ────────────────────────────────────────────────────────────
// Nano Store atom for Comparison Vault. Persona-scoped localStorage persistence.
// Sync engine (sync.ts) orchestrates auth transitions — this module stays pure.

import { atom } from 'nanostores';
import type { VaultProduct, VaultEntry, VaultState, VaultStorageScope, AddResult } from './types.ts';
import { VAULT_MAX_PER_CATEGORY, VAULT_LEGACY_KEY, vaultStorageKey } from './types.ts';

// ─── Current persona scope ─────────────────────────────────────────────────

let _currentScope: VaultStorageScope = 'guest';

// ─── One-time legacy migration ─────────────────────────────────────────────
// WHY: migrates flat 'eg-vault' key → 'eg-vault:guest' on first load

function migrateLegacyKey(): void {
  if (typeof globalThis.localStorage === 'undefined') return;
  const legacy = globalThis.localStorage.getItem(VAULT_LEGACY_KEY);
  if (!legacy) return;

  const scopedKey = vaultStorageKey('guest');
  // Only migrate if scoped key doesn't already exist
  if (!globalThis.localStorage.getItem(scopedKey)) {
    globalThis.localStorage.setItem(scopedKey, legacy);
  }
  globalThis.localStorage.removeItem(VAULT_LEGACY_KEY);
}

// Run migration once at module load
migrateLegacyKey();

// ─── Restore from localStorage ──────────────────────────────────────────────

function loadFromStorage(scope?: VaultStorageScope): VaultState {
  if (typeof globalThis.localStorage === 'undefined') return { entries: [] };
  const key = vaultStorageKey(scope ?? _currentScope);
  try {
    const raw = globalThis.localStorage.getItem(key);
    if (!raw) return { entries: [] };
    const parsed = JSON.parse(raw);
    if (!parsed || !Array.isArray(parsed.entries)) return { entries: [] };
    return { entries: parsed.entries };
  } catch {
    return { entries: [] };
  }
}

// ─── Atom ───────────────────────────────────────────────────────────────────

export const $vault = atom<VaultState>(loadFromStorage());

// ─── Persist to localStorage ────────────────────────────────────────────────

/** Synchronously flush current state to localStorage (exposed for tests) */
export function _flushToStorage(): void {
  if (typeof globalThis.localStorage === 'undefined') return;
  globalThis.localStorage.setItem(vaultStorageKey(_currentScope), JSON.stringify($vault.get()));
}

// Subscribe to changes — debounced write in browser, sync flush via _flushToStorage for tests
let debounceTimer: ReturnType<typeof setTimeout> | undefined;

$vault.subscribe(() => {
  if (typeof globalThis.localStorage === 'undefined') return;
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(_flushToStorage, 100);
});

// ─── Actions ────────────────────────────────────────────────────────────────

export function addToVault(product: VaultProduct): AddResult {
  const state = $vault.get();

  // No duplicates
  if (state.entries.some(e => e.product.id === product.id)) return 'duplicate';

  // Enforce max per category
  const categoryCount = state.entries.filter(e => e.product.category === product.category).length;
  if (categoryCount >= VAULT_MAX_PER_CATEGORY) return 'category-full';

  const entry: VaultEntry = { product, addedAt: Date.now() };
  $vault.set({ entries: [...state.entries, entry] });
  return 'added';
}

export function removeFromVault(id: string): void {
  const state = $vault.get();
  const filtered = state.entries.filter(e => e.product.id !== id);
  if (filtered.length !== state.entries.length) {
    $vault.set({ entries: filtered });
  }
}

export function clearCategory(category: string): void {
  const state = $vault.get();
  $vault.set({ entries: state.entries.filter(e => e.product.category !== category) });
}

export function clearAll(): void {
  $vault.set({ entries: [] });
}

export function moveItem(id: string, newIndex: number): void {
  const state = $vault.get();
  const currentIndex = state.entries.findIndex(e => e.product.id === id);
  if (currentIndex === -1) return;

  const entries = [...state.entries];
  const [item] = entries.splice(currentIndex, 1) as [VaultEntry];
  const clampedIndex = Math.max(0, Math.min(newIndex, entries.length));
  entries.splice(clampedIndex, 0, item);
  $vault.set({ entries });
}

// ─── Persona switching (called by sync engine) ─────────────────────────────

/** Switch to a different persona scope. Saves current, loads new. */
export function switchPersona(scope: VaultStorageScope): void {
  // Flush current state before switching
  _flushToStorage();
  _currentScope = scope;
  $vault.set(loadFromStorage(scope));
}

/** Replace atom state directly — used by sync engine to inject server data. */
export function setVaultState(state: VaultState): void {
  $vault.set(state);
}

/** Get current scope — used by sync engine for inspection. */
export function getCurrentScope(): VaultStorageScope {
  return _currentScope;
}

// ─── Derived Readers ────────────────────────────────────────────────────────
// WHY plain functions instead of computed atoms: the test harness uses dynamic
// imports with cache-busting to get fresh stores. Computed atoms (which capture
// the atom reference at module eval time) work fine, but plain functions are
// simpler to test and have zero overhead for these synchronous reads.

export function isInVault(id: string): boolean {
  return $vault.get().entries.some(e => e.product.id === id);
}

export function vaultCount(): number {
  return $vault.get().entries.length;
}

export function vaultCountByCategory(): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const entry of $vault.get().entries) {
    const cat = entry.product.category;
    counts[cat] = (counts[cat] ?? 0) + 1;
  }
  return counts;
}

export function vaultItemsByCategory(category: string): VaultEntry[] {
  return $vault.get().entries.filter(e => e.product.category === category);
}

// ─── Test-only helpers ─────────────────────────────────────────────────────

/** Re-read localStorage and replace atom state. Used by tests to simulate fresh page load. */
export function _resetFromStorage(): void {
  $vault.set(loadFromStorage());
}
