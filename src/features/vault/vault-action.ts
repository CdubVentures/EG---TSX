// ─── Vault Action (TS gateway) ─────────────────────────────────────────────
// Re-exports vault-action.mjs with TypeScript types.
// Components and features import from this file.

import type { WritableAtom } from 'nanostores';
import type { VaultProduct } from './types';
import {
  $vaultAction as _$vaultAction,
  emitVaultAction as _emitVaultAction,
} from './vault-action.mjs';

// ─── Action types ──────────────────────────────────────────────────────────

interface VaultProductAction {
  type: 'added' | 'removed' | 'duplicate' | 'category-full';
  product: VaultProduct;
}

interface VaultClearedCategoryAction {
  type: 'cleared-category';
  category: string;
  count: number;
}

interface VaultClearedAllAction {
  type: 'cleared-all';
  count: number;
}

export type VaultAction =
  | VaultProductAction
  | VaultClearedCategoryAction
  | VaultClearedAllAction;

// WHY cast: .mjs atom is untyped. TS gateway adds the type contract.
export const $vaultAction = _$vaultAction as unknown as WritableAtom<VaultAction | null>;

export const emitVaultAction = _emitVaultAction as (action: VaultAction) => void;
