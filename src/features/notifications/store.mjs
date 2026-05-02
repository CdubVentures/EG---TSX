// ─── Notification Store (pure logic) ───────────────────────────────────────
// Nanostore-driven notification queue. Generic queue, vault is first consumer.
// .mjs gateway: directly testable by node --test without transpilation.
// .ts gateway (store.ts) re-exports with type annotations.

import { atom } from 'nanostores';

/** @type {number} Max visible toasts — oldest auto-dismissed when exceeded */
export const MAX_VISIBLE = 3;

/** @type {number} Exit animation duration in ms — must match CSS transition */
export const EXIT_ANIMATION_MS = 300;

/** @type {import('nanostores').WritableAtom<Array<object>>} */
export const $notifications = atom([]);

/** @type {Map<string, ReturnType<typeof setTimeout>>} */
const timers = new Map();

/**
 * Push a notification. Returns the generated id.
 * @param {object} partial — notification without id/createdAt
 * @returns {string} id
 */
export function notify(partial) {
  const id = crypto.randomUUID();
  const notification = {
    ...partial,
    id,
    createdAt: Date.now(),
  };

  $notifications.set([...$notifications.get(), notification]);

  // Auto-dismiss after duration (0 = sticky)
  if (notification.duration > 0) {
    const timer = setTimeout(() => dismiss(id), notification.duration);
    timers.set(id, timer);
  }

  // Enforce MAX_VISIBLE — auto-dismiss oldest
  const current = $notifications.get();
  if (current.length > MAX_VISIBLE) {
    const oldest = current.find(n => !n.dismissing);
    if (oldest) dismiss(oldest.id);
  }

  return id;
}

/**
 * Dismiss a notification — sets dismissing flag, removes after exit animation.
 * @param {string} id
 */
export function dismiss(id) {
  const current = $notifications.get();
  const target = current.find(n => n.id === id);
  if (!target || target.dismissing) return;

  // Cancel auto-dismiss timer if pending
  const timer = timers.get(id);
  if (timer) {
    clearTimeout(timer);
    timers.delete(id);
  }

  // Set dismissing flag for exit animation
  $notifications.set(
    current.map(n => n.id === id ? { ...n, dismissing: true } : n)
  );

  // Remove after exit animation completes
  setTimeout(() => {
    $notifications.set($notifications.get().filter(n => n.id !== id));
  }, EXIT_ANIMATION_MS);
}

/** Clear all notifications immediately. */
export function dismissAll() {
  for (const timer of timers.values()) {
    clearTimeout(timer);
  }
  timers.clear();
  $notifications.set([]);
}
