import { describe, it, beforeEach, afterEach, mock } from 'node:test';
import assert from 'node:assert/strict';

/**
 * Notification store — unit tests
 *
 * Contract:
 *   $notifications: WritableAtom<Notification[]>
 *   notify(partial): string   — adds notification, returns id
 *   dismiss(id): void         — removes by id (after exit animation delay)
 *   dismissAll(): void        — clears all
 *   MAX_VISIBLE = 3           — oldest auto-dismissed when exceeded
 *
 * Invariants:
 *   - Every notification gets a unique id
 *   - dismiss() with unknown id is a no-op
 *   - Auto-dismiss fires after notification.duration ms
 *   - dismissAll() clears regardless of timers
 */

// WHY cache-busting: nanostores are module-scoped singletons.
// Fresh import per test prevents state leakage.
async function freshImport() {
  const ts = Date.now() + Math.random();
  return await import(`../src/features/notifications/store.mjs?t=${ts}`);
}

/** Factory for a minimal vault notification payload */
function vaultPayload(overrides = {}) {
  return {
    kind: 'vault',
    action: 'added',
    duration: 3000,
    product: {
      brand: 'Razer',
      model: 'Viper V3 Pro',
      category: 'mouse',
      imagePath: '/images/data-products/mouse/razer/viper-v3-pro',
      thumbnailStem: 'top',
    },
    ...overrides,
  };
}

describe('notification store', () => {
  /** @type {Awaited<ReturnType<typeof freshImport>>} */
  let mod;

  beforeEach(async () => {
    mock.timers.enable({ apis: ['setTimeout'] });
    mod = await freshImport();
  });

  afterEach(() => {
    mock.timers.reset();
  });

  // ─── notify() ──────────────────────────────────────────────────────────

  describe('notify()', () => {
    it('adds a notification to the store', () => {
      mod.notify(vaultPayload());
      const items = mod.$notifications.get();
      assert.equal(items.length, 1);
      assert.equal(items[0].kind, 'vault');
      assert.equal(items[0].action, 'added');
    });

    it('returns a unique id string', () => {
      const id1 = mod.notify(vaultPayload());
      const id2 = mod.notify(vaultPayload({ action: 'removed' }));
      assert.equal(typeof id1, 'string');
      assert.ok(id1.length > 0);
      assert.notEqual(id1, id2);
    });

    it('sets createdAt to a recent timestamp', () => {
      const before = Date.now();
      mod.notify(vaultPayload());
      const after = Date.now();
      const item = mod.$notifications.get()[0];
      assert.ok(item.createdAt >= before);
      assert.ok(item.createdAt <= after);
    });

    it('preserves the provided duration', () => {
      mod.notify(vaultPayload({ duration: 5000 }));
      assert.equal(mod.$notifications.get()[0].duration, 5000);
    });

    it('preserves product data on vault notifications', () => {
      mod.notify(vaultPayload());
      const item = mod.$notifications.get()[0];
      assert.equal(item.product.brand, 'Razer');
      assert.equal(item.product.model, 'Viper V3 Pro');
      assert.equal(item.product.category, 'mouse');
    });

    it('multiple notifications stack in order', () => {
      mod.notify(vaultPayload({ action: 'added' }));
      mod.notify(vaultPayload({ action: 'removed' }));
      mod.notify(vaultPayload({ action: 'duplicate' }));
      const items = mod.$notifications.get();
      assert.equal(items.length, 3);
      assert.equal(items[0].action, 'added');
      assert.equal(items[1].action, 'removed');
      assert.equal(items[2].action, 'duplicate');
    });
  });

  // ─── dismiss() ─────────────────────────────────────────────────────────

  describe('dismiss()', () => {
    it('removes notification by id', () => {
      const id = mod.notify(vaultPayload());
      mod.dismiss(id);
      // Advance past exit animation
      mock.timers.tick(400);
      assert.equal(mod.$notifications.get().length, 0);
    });

    it('sets dismissing flag before removal', () => {
      const id = mod.notify(vaultPayload());
      mod.dismiss(id);
      // Before animation completes, item should have dismissing: true
      const item = mod.$notifications.get().find(n => n.id === id);
      assert.equal(item?.dismissing, true);
    });

    it('is a no-op for unknown id', () => {
      mod.notify(vaultPayload());
      const before = mod.$notifications.get().length;
      mod.dismiss('nonexistent-id');
      assert.equal(mod.$notifications.get().length, before);
    });

    it('only removes the targeted notification', () => {
      const id1 = mod.notify(vaultPayload({ action: 'added' }));
      mod.notify(vaultPayload({ action: 'removed' }));
      mod.dismiss(id1);
      mock.timers.tick(400);
      const items = mod.$notifications.get();
      assert.equal(items.length, 1);
      assert.equal(items[0].action, 'removed');
    });
  });

  // ─── dismissAll() ──────────────────────────────────────────────────────

  describe('dismissAll()', () => {
    it('clears all notifications', () => {
      mod.notify(vaultPayload());
      mod.notify(vaultPayload({ action: 'removed' }));
      mod.notify(vaultPayload({ action: 'duplicate' }));
      mod.dismissAll();
      assert.equal(mod.$notifications.get().length, 0);
    });

    it('is a no-op on empty store', () => {
      mod.dismissAll();
      assert.equal(mod.$notifications.get().length, 0);
    });
  });

  // ─── MAX_VISIBLE overflow ──────────────────────────────────────────────

  describe('MAX_VISIBLE overflow', () => {
    it('auto-dismisses oldest when exceeding MAX_VISIBLE (3)', () => {
      mod.notify(vaultPayload({ action: 'added', duration: 10000 }));
      mod.notify(vaultPayload({ action: 'removed', duration: 10000 }));
      mod.notify(vaultPayload({ action: 'duplicate', duration: 10000 }));
      // 4th notification should push out the 1st
      mod.notify(vaultPayload({ action: 'category-full', duration: 10000 }));
      // Wait for exit animation on the auto-dismissed one
      mock.timers.tick(400);
      const items = mod.$notifications.get();
      assert.equal(items.length, 3);
      // The first one (action: 'added') should be gone
      assert.ok(!items.some(n => n.action === 'added'));
      assert.ok(items.some(n => n.action === 'category-full'));
    });
  });

  // ─── Auto-dismiss timer ────────────────────────────────────────────────

  describe('auto-dismiss timer', () => {
    it('auto-dismisses after duration elapses', () => {
      mod.notify(vaultPayload({ duration: 3000 }));
      assert.equal(mod.$notifications.get().length, 1);
      // Advance past duration — fires dismiss(), sets dismissing flag
      mock.timers.tick(3000);
      assert.equal(mod.$notifications.get()[0]?.dismissing, true);
      // Advance past exit animation — removes from store
      mock.timers.tick(400);
      assert.equal(mod.$notifications.get().length, 0);
    });

    it('does not auto-dismiss when duration is 0 (sticky)', () => {
      mod.notify(vaultPayload({ duration: 0 }));
      mock.timers.tick(60000);
      assert.equal(mod.$notifications.get().length, 1);
    });

    it('manual dismiss cancels auto-dismiss timer', () => {
      const id = mod.notify(vaultPayload({ duration: 3000 }));
      mod.dismiss(id);
      mock.timers.tick(400);
      assert.equal(mod.$notifications.get().length, 0);
      // Advancing past original duration should not cause errors
      mock.timers.tick(3000);
      assert.equal(mod.$notifications.get().length, 0);
    });
  });

  // ─── Initial state ────────────────────────────────────────────────────

  describe('initial state', () => {
    it('starts with empty array', () => {
      assert.deepStrictEqual(mod.$notifications.get(), []);
    });
  });
});
