// ─── Notification Types ────────────────────────────────────────────────────
// Cross-cutting notification system. Vault is the first consumer;
// auth, forms, and future features will add their own variants.

export interface NotificationBase {
  id: string;            // crypto.randomUUID()
  createdAt: number;     // Date.now()
  duration: number;      // auto-dismiss ms (0 = sticky)
  dismissing?: boolean;  // true during exit animation
}

export interface VaultNotification extends NotificationBase {
  kind: 'vault';
  action: 'added' | 'removed' | 'duplicate' | 'category-full';
  product: {
    brand: string;
    model: string;
    category: string;
    imagePath: string;
    thumbnailStem: string;
  };
}

// Future: AuthNotification, GenericNotification, etc.
export type Notification = VaultNotification;

/** Max visible toasts — oldest auto-dismissed when exceeded */
export const MAX_VISIBLE = 3;

/** Exit animation duration in ms — must match CSS transition */
export const EXIT_ANIMATION_MS = 300;

/** Auto-dismiss durations by vault action */
export const VAULT_TOAST_DURATIONS: Record<VaultNotification['action'], number> = {
  added: 3000,
  removed: 3000,
  duplicate: 4000,
  'category-full': 5000,
};
