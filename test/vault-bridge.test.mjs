import { describe, it, beforeEach, afterEach, mock } from 'node:test';
import assert from 'node:assert/strict';

/**
 * Vault notification bridge — integration tests
 *
 * Contract:
 *   initVaultBridge(): void — subscribes $vaultAction → notify()
 *   Called once in MainLayout. From that point, every vault action
 *   automatically generates a toast notification.
 *
 * Tested chain:
 *   emitVaultAction() → $vaultAction atom → bridge subscription → notify() → $notifications
 *
 * This is the ONLY place vault↔notification coupling exists.
 *
 * WHY no cache-busting: The bridge internally imports $vaultAction and notify.
 * All three modules must share the same atom instances, so we import the
 * canonical modules and manually reset state between tests.
 */

import { $vaultAction, emitVaultAction } from '../src/features/vault/vault-action.mjs';
import { $notifications, dismissAll } from '../src/features/notifications/store.mjs';
import { initVaultBridge } from '../src/features/notifications/vault-bridge.mjs';

function makeProduct(overrides = {}) {
  return {
    id: 'razer-viper-v3-pro',
    slug: 'viper-v3-pro',
    brand: 'Razer',
    model: 'Viper V3 Pro',
    category: 'mouse',
    imagePath: '/images/data-products/mouse/razer/viper-v3-pro',
    thumbnailStem: 'top',
    ...overrides,
  };
}

// Initialize the bridge once — it guards against double-init internally
initVaultBridge();

describe('vault notification bridge', () => {
  beforeEach(() => {
    mock.timers.enable({ apis: ['setTimeout'] });
    // Reset both atoms to clean state
    dismissAll();
    $vaultAction.set(null);
  });

  afterEach(() => {
    mock.timers.reset();
  });

  // ─── Product actions → toast ───────────────────────────────────────────

  it('added action creates a vault toast with action "added"', () => {
    emitVaultAction({ type: 'added', product: makeProduct() });
    const items = $notifications.get();
    assert.equal(items.length, 1);
    assert.equal(items[0].kind, 'vault');
    assert.equal(items[0].action, 'added');
    assert.equal(items[0].product.brand, 'Razer');
    assert.equal(items[0].product.model, 'Viper V3 Pro');
  });

  it('removed action creates a vault toast with action "removed"', () => {
    emitVaultAction({ type: 'removed', product: makeProduct() });
    const items = $notifications.get();
    assert.equal(items.length, 1);
    assert.equal(items[0].action, 'removed');
  });

  it('duplicate action creates a vault toast with action "duplicate"', () => {
    emitVaultAction({ type: 'duplicate', product: makeProduct() });
    const items = $notifications.get();
    assert.equal(items.length, 1);
    assert.equal(items[0].action, 'duplicate');
  });

  it('category-full action creates a vault toast with action "category-full"', () => {
    emitVaultAction({ type: 'category-full', product: makeProduct() });
    const items = $notifications.get();
    assert.equal(items.length, 1);
    assert.equal(items[0].action, 'category-full');
  });

  // ─── Durations match spec ──────────────────────────────────────────────

  it('added toast has 3000ms duration', () => {
    emitVaultAction({ type: 'added', product: makeProduct() });
    assert.equal($notifications.get()[0].duration, 3000);
  });

  it('removed toast has 3000ms duration', () => {
    emitVaultAction({ type: 'removed', product: makeProduct() });
    assert.equal($notifications.get()[0].duration, 3000);
  });

  it('duplicate toast has 4000ms duration', () => {
    emitVaultAction({ type: 'duplicate', product: makeProduct() });
    assert.equal($notifications.get()[0].duration, 4000);
  });

  it('category-full toast has 5000ms duration', () => {
    emitVaultAction({ type: 'category-full', product: makeProduct() });
    assert.equal($notifications.get()[0].duration, 5000);
  });

  // ─── Bulk actions ──────────────────────────────────────────────────────

  it('cleared-category with count 0 does NOT create a toast', () => {
    emitVaultAction({ type: 'cleared-category', category: 'mouse', count: 0 });
    assert.equal($notifications.get().length, 0);
  });

  it('cleared-all with count 0 does NOT create a toast', () => {
    emitVaultAction({ type: 'cleared-all', count: 0 });
    assert.equal($notifications.get().length, 0);
  });

  // ─── No-ops ────────────────────────────────────────────────────────────

  it('null action (reset) does not create a toast', () => {
    $vaultAction.set(null);
    assert.equal($notifications.get().length, 0);
  });

  // ─── Product data passthrough ──────────────────────────────────────────

  it('passes product brand, model, category, imagePath, thumbnailStem', () => {
    const product = makeProduct({
      brand: 'Logitech',
      model: 'G Pro X Superlight 2',
      category: 'mouse',
      imagePath: '/images/data-products/mouse/logitech/g-pro-x-superlight-2',
      thumbnailStem: 'top---white',
    });
    emitVaultAction({ type: 'added', product });
    const toast = $notifications.get()[0];
    assert.equal(toast.product.brand, 'Logitech');
    assert.equal(toast.product.model, 'G Pro X Superlight 2');
    assert.equal(toast.product.category, 'mouse');
    assert.equal(toast.product.imagePath, '/images/data-products/mouse/logitech/g-pro-x-superlight-2');
    assert.equal(toast.product.thumbnailStem, 'top---white');
  });
});
