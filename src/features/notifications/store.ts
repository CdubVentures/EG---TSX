// ─── Notification Store (TS gateway) ───────────────────────────────────────
// Re-exports pure logic from store.mjs with TypeScript type annotations.
// Components import from this file. Tests import from store.mjs directly.

import type { WritableAtom } from 'nanostores';
import type { Notification } from './types';
import {
  $notifications as _$notifications,
  notify as _notify,
  dismiss as _dismiss,
  dismissAll as _dismissAll,
  MAX_VISIBLE,
  EXIT_ANIMATION_MS,
} from './store.mjs';

export { MAX_VISIBLE, EXIT_ANIMATION_MS };

// WHY cast: .mjs atom is untyped (object[]). TS gateway adds the type contract.
export const $notifications = _$notifications as unknown as WritableAtom<Notification[]>;

export const notify = _notify as (partial: Omit<Notification, 'id' | 'createdAt'>) => string;

export const dismiss = _dismiss as (id: string) => void;

export const dismissAll = _dismissAll as () => void;
