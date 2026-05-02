// ─── Vault Action Atom (pure logic) ────────────────────────────────────────
// Publishes "what just happened" to the vault. The notification bridge
// (and any future subscriber) reacts to this.
// .mjs gateway: directly testable by node --test without transpilation.

import { atom } from 'nanostores';

/** @type {import('nanostores').WritableAtom<object|null>} */
export const $vaultAction = atom(null);

/**
 * Emit a vault action. Called by vault store after every mutation.
 * @param {object} action — { type, product?, category?, count? }
 */
export function emitVaultAction(action) {
  $vaultAction.set(action);
}
