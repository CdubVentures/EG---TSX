// ─── Vault Notification Bridge (TS gateway) ────────────────────────────────
// Re-exports vault-bridge.mjs with TypeScript types.

import { initVaultBridge as _initVaultBridge } from './vault-bridge.mjs';

export const initVaultBridge: () => void = _initVaultBridge;
