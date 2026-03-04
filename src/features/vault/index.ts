// ─── Vault Feature — Public API ─────────────────────────────────────────────
export type { VaultProduct, VaultEntry, VaultState, VaultSyncState, VaultStorageScope, AddResult } from './types';
export { VAULT_MAX_PER_CATEGORY, vaultStorageKey, vaultRevKey } from './types';
export {
  $vault,
  addToVault,
  removeFromVault,
  clearCategory,
  clearAll,
  moveItem,
  isInVault,
  vaultCount,
  vaultCountByCategory,
  vaultItemsByCategory,
  switchPersona,
  setVaultState,
  getCurrentScope,
} from './store';
export { $vaultSync, initVaultSync, pullFromServer, pushToServer } from './sync';
export { mergeVaults } from './merge';
