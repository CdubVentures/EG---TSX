// ─── Notifications Public API ──────────────────────────────────────────────
// Features import from this barrel — never reach into internals.

export { $notifications, notify, dismiss, dismissAll } from './store';
export type { Notification, VaultNotification, NotificationBase } from './types';
export { VAULT_TOAST_DURATIONS, MAX_VISIBLE, EXIT_ANIMATION_MS } from './types';
export { default as ToastContainer } from './components/ToastContainer';
export { initVaultBridge } from './vault-bridge';
