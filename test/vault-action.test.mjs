import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

/**
 * $vaultAction atom — unit tests
 *
 * Contract:
 *   $vaultAction: WritableAtom<VaultAction | null>
 *   emitVaultAction(action): void — sets the atom
 *
 * VaultAction variants:
 *   { type: 'added',         product: VaultProduct }
 *   { type: 'duplicate',     product: VaultProduct }
 *   { type: 'category-full', product: VaultProduct }
 *   { type: 'removed',       product: VaultProduct }
 *   { type: 'cleared-category', category: string, count: number }
 *   { type: 'cleared-all',   count: number }
 *
 * Invariants:
 *   - Starts as null
 *   - Every vault mutation sets the atom to the correct action
 *   - Each set is a NEW object (identity !== previous)
 */

async function freshImport() {
  const ts = Date.now() + Math.random();
  return await import(`../src/features/vault/vault-action.mjs?t=${ts}`);
}

/** Factory for a minimal product payload */
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

describe('$vaultAction atom', () => {
  let mod;

  beforeEach(async () => {
    mod = await freshImport();
  });

  it('starts as null', () => {
    assert.equal(mod.$vaultAction.get(), null);
  });

  it('emitVaultAction sets the atom value', () => {
    const action = { type: 'added', product: makeProduct() };
    mod.emitVaultAction(action);
    assert.deepStrictEqual(mod.$vaultAction.get(), action);
  });

  it('each emit produces a new object reference', () => {
    const action1 = { type: 'added', product: makeProduct() };
    const action2 = { type: 'added', product: makeProduct() };
    mod.emitVaultAction(action1);
    const ref1 = mod.$vaultAction.get();
    mod.emitVaultAction(action2);
    const ref2 = mod.$vaultAction.get();
    assert.notEqual(ref1, ref2);
  });

  it('supports all action types', () => {
    const product = makeProduct();

    // added
    mod.emitVaultAction({ type: 'added', product });
    assert.equal(mod.$vaultAction.get().type, 'added');

    // duplicate
    mod.emitVaultAction({ type: 'duplicate', product });
    assert.equal(mod.$vaultAction.get().type, 'duplicate');

    // category-full
    mod.emitVaultAction({ type: 'category-full', product });
    assert.equal(mod.$vaultAction.get().type, 'category-full');

    // removed
    mod.emitVaultAction({ type: 'removed', product });
    assert.equal(mod.$vaultAction.get().type, 'removed');

    // cleared-category
    mod.emitVaultAction({ type: 'cleared-category', category: 'mouse', count: 5 });
    assert.equal(mod.$vaultAction.get().type, 'cleared-category');
    assert.equal(mod.$vaultAction.get().count, 5);

    // cleared-all
    mod.emitVaultAction({ type: 'cleared-all', count: 12 });
    assert.equal(mod.$vaultAction.get().type, 'cleared-all');
    assert.equal(mod.$vaultAction.get().count, 12);
  });
});
