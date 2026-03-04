import type { Category } from '@core/config';

/** Minimal product identity needed for vault — no specs, no media details */
export interface VaultProduct {
  id: string;        // entry.id from dataProducts (e.g. "mouse/razer/viper-v3-pro")
  slug: string;      // product slug
  brand: string;     // display brand name
  model: string;     // display model name
  category: Category;
  imagePath: string; // for image resolution
}

export interface VaultEntry {
  product: VaultProduct;
  addedAt: number;   // Date.now() timestamp
}

export interface VaultState {
  entries: VaultEntry[];
}

/** Max items allowed per category */
export const VAULT_MAX_PER_CATEGORY = 16;

/** Result of addToVault — UI can show feedback based on this */
export type AddResult = 'added' | 'duplicate' | 'category-full';

// ─── Persona-scoped storage ────────────────────────────────────────────────

/** Storage scope — 'guest' for unauthenticated, Cognito sub for authenticated */
export type VaultStorageScope = 'guest' | string;

/** Legacy key — used only for one-time migration to scoped keys */
export const VAULT_LEGACY_KEY = 'eg-vault';

/** Returns localStorage key for a given scope */
export function vaultStorageKey(scope: VaultStorageScope): string {
  return `eg-vault:${scope}`;
}

/** Returns localStorage key for tracking server revision */
export function vaultRevKey(uid: string): string {
  return `eg-vault-rev:${uid}`;
}

// ─── Sync state ────────────────────────────────────────────────────────────

export interface VaultSyncState {
  persona: VaultStorageScope;
  rev: number;
  syncing: boolean;
  error: string | null;
}

// WHY no VAULT_CATEGORIES here: categories are now driven by config/categories.json
// via CONFIG.categories (filtered by environment). Use CONFIG.categories everywhere.
