// ─── Vault Notification Bridge (pure logic) ────────────────────────────────
// Subscribes to $vaultAction and fires notify() for each vault mutation.
// This is the ONLY place vault↔notification coupling exists.
// .mjs gateway: directly testable by node --test without transpilation.

import { $vaultAction } from '../vault/vault-action.mjs';
import { notify } from './store.mjs';

/** @type {Record<string, number>} */
const VAULT_TOAST_DURATIONS = {
  added: 3000,
  removed: 3000,
  duplicate: 4000,
  'category-full': 5000,
};

let _initialized = false;

/**
 * Start listening for vault actions and converting them to notifications.
 * Safe to call multiple times — only subscribes once.
 */
export function initVaultBridge() {
  if (_initialized) return;
  _initialized = true;

  $vaultAction.subscribe((action) => {
    if (!action) return;

    switch (action.type) {
      case 'added':
      case 'removed':
      case 'duplicate':
      case 'category-full': {
        const { product } = action;
        notify({
          kind: 'vault',
          action: action.type,
          duration: VAULT_TOAST_DURATIONS[action.type],
          product: {
            brand: product.brand,
            model: product.model,
            category: product.category,
            imagePath: product.imagePath,
            thumbnailStem: product.thumbnailStem,
          },
        });
        break;
      }

      case 'cleared-category':
        // Skip toast for empty clears
        if (action.count === 0) break;
        // Future: GenericNotification ("Cleared 5 mice from vault")
        break;

      case 'cleared-all':
        // Skip toast for empty clears
        if (action.count === 0) break;
        // Future: GenericNotification ("Cleared all 12 items from vault")
        break;
    }
  });
}
