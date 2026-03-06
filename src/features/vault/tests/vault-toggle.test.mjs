// ─── Vault Toggle Integration Tests ─────────────────────────────────────────
// Contract: VaultToggleButton's store interaction patterns — add, remove,
// toggle, duplicate, category-full, cross-product independence, external sync.
// Runner: node --test --experimental-strip-types

import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

// ─── Test Helpers ───────────────────────────────────────────────────────────

function makeProduct(overrides = {}) {
  return {
    id: 'mouse/razer/viper-v3-pro',
    slug: 'viper-v3-pro',
    brand: 'Razer',
    model: 'Viper V3 Pro',
    category: 'mouse',
    imagePath: '/images/data-products/mouse/razer/viper-v3-pro',
    thumbnailStem: 'top',
    ...overrides,
  };
}

function makeMouseProduct(n) {
  return makeProduct({
    id: `mouse/brand/mouse-${n}`,
    slug: `mouse-${n}`,
    model: `Mouse ${n}`,
  });
}

// ─── Mock localStorage ──────────────────────────────────────────────────────

class MockStorage {
  constructor() { this.store = new Map(); }
  getItem(key) { return this.store.get(key) ?? null; }
  setItem(key, value) { this.store.set(key, String(value)); }
  removeItem(key) { this.store.delete(key); }
  clear() { this.store.clear(); }
}

// ─── Dynamic import (fresh module per test) ─────────────────────────────────

let importCounter = 0;

async function freshStore() {
  importCounter++;
  const mod = await import(`../store.ts?toggle=${importCounter}`);
  return mod;
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('Vault Toggle — store interaction patterns', () => {
  beforeEach(() => {
    globalThis.localStorage = new MockStorage();
  });

  it('add product via toggle pattern: addToVault → isInVault true', async () => {
    const { addToVault, isInVault } = await freshStore();
    const product = makeProduct();

    const result = addToVault(product);

    assert.equal(result, 'added');
    assert.equal(isInVault(product.id), true);
  });

  it('remove product via toggle pattern: after add, removeFromVault → isInVault false', async () => {
    const { addToVault, removeFromVault, isInVault } = await freshStore();
    const product = makeProduct();

    addToVault(product);
    assert.equal(isInVault(product.id), true);

    removeFromVault(product.id);
    assert.equal(isInVault(product.id), false);
  });

  it('toggle add-then-remove is idempotent: entries length returns to 0', async () => {
    const { $vault, addToVault, removeFromVault } = await freshStore();
    const product = makeProduct();

    addToVault(product);
    assert.equal($vault.get().entries.length, 1);

    removeFromVault(product.id);
    assert.equal($vault.get().entries.length, 0);
  });

  it('duplicate add returns "duplicate"', async () => {
    const { addToVault } = await freshStore();
    const product = makeProduct();

    const first = addToVault(product);
    const second = addToVault(product);

    assert.equal(first, 'added');
    assert.equal(second, 'duplicate');
  });

  it('category-full returns "category-full" after 16 products', async () => {
    const { addToVault } = await freshStore();

    for (let i = 1; i <= 16; i++) {
      const result = addToVault(makeMouseProduct(i));
      assert.equal(result, 'added', `product ${i} should be added`);
    }

    const result = addToVault(makeMouseProduct(17));
    assert.equal(result, 'category-full');
  });

  it('cross-product independence: removing absent product B leaves product A', async () => {
    const { addToVault, removeFromVault, isInVault } = await freshStore();
    const productA = makeProduct({ id: 'mouse/brand/a', slug: 'a', model: 'A' });
    const productBId = 'mouse/brand/b';

    addToVault(productA);
    removeFromVault(productBId);

    assert.equal(isInVault(productA.id), true);
  });

  it('vault state reflects external changes via setVaultState', async () => {
    const { isInVault, setVaultState } = await freshStore();
    const product = makeProduct();

    // Initially empty
    assert.equal(isInVault(product.id), false);

    // Simulate external change (e.g., VaultDropdown remove, cross-tab sync)
    setVaultState({
      entries: [{ product, addedAt: Date.now() }],
    });

    assert.equal(isInVault(product.id), true);

    // Simulate external removal
    setVaultState({ entries: [] });
    assert.equal(isInVault(product.id), false);
  });
});
