// ─── Vault Store Tests ──────────────────────────────────────────────────────
// Contract: Nano Store atom managing vault entries with persona-scoped localStorage.
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

function makeKeyboardProduct(n) {
  return makeProduct({
    id: `keyboard/corsair/kb-${n}`,
    slug: `kb-${n}`,
    brand: 'Corsair',
    model: `Keyboard ${n}`,
    category: 'keyboard',
    imagePath: `/images/data-products/keyboard/corsair/kb-${n}`,
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
// WHY: nanostores atoms are module-level singletons. Cache-bust to get fresh state.

let importCounter = 0;

async function freshStore() {
  importCounter++;
  const mod = await import(`../store.ts?test=${importCounter}`);
  return mod;
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('Vault Store', () => {
  beforeEach(() => {
    globalThis.localStorage = new MockStorage();
  });

  it('starts with empty entries', async () => {
    const { $vault } = await freshStore();
    assert.deepStrictEqual($vault.get().entries, []);
  });

  it('adds a product to the vault', async () => {
    const { $vault, addToVault } = await freshStore();
    const product = makeProduct();
    addToVault(product);

    const state = $vault.get();
    assert.equal(state.entries.length, 1);
    assert.equal(state.entries[0].product.id, product.id);
    assert.equal(state.entries[0].product.brand, 'Razer');
    assert.equal(state.entries[0].product.model, 'Viper V3 Pro');
    assert.equal(typeof state.entries[0].addedAt, 'number');
  });

  it('does not add duplicate products', async () => {
    const { $vault, addToVault } = await freshStore();
    const product = makeProduct();
    addToVault(product);
    addToVault(product);
    assert.equal($vault.get().entries.length, 1);
  });

  it('removes a product by id', async () => {
    const { $vault, addToVault, removeFromVault } = await freshStore();
    addToVault(makeProduct());
    removeFromVault('mouse/razer/viper-v3-pro');
    assert.equal($vault.get().entries.length, 0);
  });

  it('removing non-existent id is a no-op', async () => {
    const { $vault, addToVault, removeFromVault } = await freshStore();
    addToVault(makeProduct());
    removeFromVault('keyboard/fake/does-not-exist');
    assert.equal($vault.get().entries.length, 1);
  });

  it('enforces max 16 products per category', async () => {
    const { $vault, addToVault } = await freshStore();
    for (let i = 1; i <= 17; i++) addToVault(makeMouseProduct(i));

    const mouseEntries = $vault.get().entries.filter(e => e.product.category === 'mouse');
    assert.equal(mouseEntries.length, 16);
    assert.ok(!mouseEntries.some(e => e.product.slug === 'mouse-17'));
  });

  it('max-per-category is independent across categories', async () => {
    const { $vault, addToVault } = await freshStore();
    for (let i = 1; i <= 16; i++) addToVault(makeMouseProduct(i));
    addToVault(makeKeyboardProduct(1));

    assert.equal($vault.get().entries.filter(e => e.product.category === 'mouse').length, 16);
    assert.equal($vault.get().entries.filter(e => e.product.category === 'keyboard').length, 1);
  });

  it('clearCategory removes only entries for that category', async () => {
    const { $vault, addToVault, clearCategory } = await freshStore();
    addToVault(makeMouseProduct(1));
    addToVault(makeMouseProduct(2));
    addToVault(makeKeyboardProduct(1));
    addToVault(makeKeyboardProduct(2));

    clearCategory('mouse');

    const entries = $vault.get().entries;
    assert.equal(entries.length, 2);
    assert.ok(entries.every(e => e.product.category === 'keyboard'));
  });

  it('clearAll empties all entries', async () => {
    const { $vault, addToVault, clearAll } = await freshStore();
    addToVault(makeMouseProduct(1));
    addToVault(makeKeyboardProduct(1));
    clearAll();
    assert.equal($vault.get().entries.length, 0);
  });

  it('isInVault returns true for present, false for absent', async () => {
    const { addToVault, isInVault } = await freshStore();
    const product = makeProduct();
    addToVault(product);
    assert.equal(isInVault(product.id), true);
    assert.equal(isInVault('keyboard/fake/absent'), false);
  });

  it('vaultCount returns total count', async () => {
    const { addToVault, vaultCount } = await freshStore();
    assert.equal(vaultCount(), 0);
    addToVault(makeMouseProduct(1));
    addToVault(makeKeyboardProduct(1));
    assert.equal(vaultCount(), 2);
  });

  it('vaultCountByCategory returns per-category counts', async () => {
    const { addToVault, vaultCountByCategory } = await freshStore();
    addToVault(makeMouseProduct(1));
    addToVault(makeMouseProduct(2));
    addToVault(makeMouseProduct(3));
    addToVault(makeKeyboardProduct(1));

    const counts = vaultCountByCategory();
    assert.equal(counts.mouse, 3);
    assert.equal(counts.keyboard, 1);
  });

  it('vaultItemsByCategory returns filtered entries', async () => {
    const { addToVault, vaultItemsByCategory } = await freshStore();
    addToVault(makeMouseProduct(1));
    addToVault(makeMouseProduct(2));
    addToVault(makeKeyboardProduct(1));

    const mouseItems = vaultItemsByCategory('mouse');
    assert.equal(mouseItems.length, 2);
    assert.ok(mouseItems.every(e => e.product.category === 'mouse'));
  });

  it('moveItem reorders within the full entries list', async () => {
    const { $vault, addToVault, moveItem } = await freshStore();
    addToVault(makeMouseProduct(1));
    addToVault(makeMouseProduct(2));
    addToVault(makeMouseProduct(3));

    moveItem('mouse/brand/mouse-3', 0);

    const slugs = $vault.get().entries.map(e => e.product.slug);
    assert.deepStrictEqual(slugs, ['mouse-3', 'mouse-1', 'mouse-2']);
  });

  it('moveItem with out-of-range index clamps to end', async () => {
    const { $vault, addToVault, moveItem } = await freshStore();
    addToVault(makeMouseProduct(1));
    addToVault(makeMouseProduct(2));
    addToVault(makeMouseProduct(3));

    moveItem('mouse/brand/mouse-1', 99);

    const slugs = $vault.get().entries.map(e => e.product.slug);
    assert.deepStrictEqual(slugs, ['mouse-2', 'mouse-3', 'mouse-1']);
  });

  it('moveItem for non-existent id is a no-op', async () => {
    const { $vault, addToVault, moveItem } = await freshStore();
    addToVault(makeMouseProduct(1));
    addToVault(makeMouseProduct(2));

    moveItem('keyboard/fake/nope', 0);

    const slugs = $vault.get().entries.map(e => e.product.slug);
    assert.deepStrictEqual(slugs, ['mouse-1', 'mouse-2']);
  });

  it('persists to localStorage with scoped key', async () => {
    const { addToVault, _flushToStorage } = await freshStore();
    addToVault(makeProduct());
    _flushToStorage();

    const raw = globalThis.localStorage.getItem('eg-vault:guest');
    assert.ok(raw !== null);
    const parsed = JSON.parse(raw);
    assert.equal(parsed.entries.length, 1);
    assert.equal(parsed.entries[0].product.id, 'mouse/razer/viper-v3-pro');
  });

  it('restores from localStorage with scoped key', async () => {
    const { $vault, clearAll, _resetFromStorage } = await freshStore();
    clearAll();

    const seeded = {
      entries: [{
        product: makeProduct(),
        addedAt: 1700000000000,
      }],
    };
    globalThis.localStorage.setItem('eg-vault:guest', JSON.stringify(seeded));
    _resetFromStorage();

    const state = $vault.get();
    assert.equal(state.entries.length, 1);
    assert.equal(state.entries[0].product.id, 'mouse/razer/viper-v3-pro');
    assert.equal(state.entries[0].addedAt, 1700000000000);
  });

  it('handles corrupt localStorage gracefully', async () => {
    const { $vault, clearAll, _resetFromStorage } = await freshStore();
    clearAll();

    globalThis.localStorage.setItem('eg-vault:guest', '{not valid json!!!');
    _resetFromStorage();
    assert.equal($vault.get().entries.length, 0);
  });

  it('handles localStorage with missing entries field', async () => {
    const { $vault, clearAll, _resetFromStorage } = await freshStore();
    clearAll();

    globalThis.localStorage.setItem('eg-vault:guest', JSON.stringify({ version: 2 }));
    _resetFromStorage();
    assert.equal($vault.get().entries.length, 0);
  });
});

// ─── addToVault return values ──────────────────────────────────────────────

describe('addToVault return values', () => {
  beforeEach(() => {
    globalThis.localStorage = new MockStorage();
  });

  it('returns "added" on successful add', async () => {
    const { addToVault } = await freshStore();
    const result = addToVault(makeProduct());
    assert.equal(result, 'added');
  });

  it('returns "duplicate" when product already exists', async () => {
    const { addToVault } = await freshStore();
    addToVault(makeProduct());
    const result = addToVault(makeProduct());
    assert.equal(result, 'duplicate');
  });

  it('returns "category-full" when category is at max', async () => {
    const { addToVault } = await freshStore();
    for (let i = 1; i <= 16; i++) addToVault(makeMouseProduct(i));
    const result = addToVault(makeMouseProduct(17));
    assert.equal(result, 'category-full');
  });
});

// ─── Persona switching ─────────────────────────────────────────────────────

describe('Persona switching', () => {
  beforeEach(() => {
    globalThis.localStorage = new MockStorage();
  });

  it('switchPersona saves current and loads new scope', async () => {
    const { $vault, addToVault, switchPersona, _flushToStorage } = await freshStore();

    // Add to guest
    addToVault(makeMouseProduct(1));
    _flushToStorage();
    assert.equal($vault.get().entries.length, 1);

    // Switch to user scope (empty)
    switchPersona('user-123');
    assert.equal($vault.get().entries.length, 0);

    // Switch back to guest
    switchPersona('guest');
    assert.equal($vault.get().entries.length, 1);
  });

  it('getCurrentScope returns current persona', async () => {
    const { getCurrentScope, switchPersona } = await freshStore();
    assert.equal(getCurrentScope(), 'guest');
    switchPersona('user-abc');
    assert.equal(getCurrentScope(), 'user-abc');
  });

  it('setVaultState replaces atom state directly', async () => {
    const { $vault, setVaultState } = await freshStore();
    const entries = [{ product: makeProduct(), addedAt: 1700000000000 }];
    setVaultState({ entries });
    assert.equal($vault.get().entries.length, 1);
    assert.equal($vault.get().entries[0].addedAt, 1700000000000);
  });

  it('each persona has independent storage', async () => {
    const { $vault, addToVault, switchPersona, _flushToStorage } = await freshStore();

    // Guest adds a mouse
    addToVault(makeMouseProduct(1));
    _flushToStorage();

    // User adds a keyboard
    switchPersona('user-456');
    addToVault(makeKeyboardProduct(1));
    _flushToStorage();

    // Verify separate keys in localStorage
    const guestRaw = globalThis.localStorage.getItem('eg-vault:guest');
    const userRaw = globalThis.localStorage.getItem('eg-vault:user-456');
    assert.ok(guestRaw !== null);
    assert.ok(userRaw !== null);

    const guestData = JSON.parse(guestRaw);
    const userData = JSON.parse(userRaw);
    assert.equal(guestData.entries[0].product.category, 'mouse');
    assert.equal(userData.entries[0].product.category, 'keyboard');
  });
});

// ─── Legacy migration ──────────────────────────────────────────────────────

describe('Legacy migration', () => {
  beforeEach(() => {
    globalThis.localStorage = new MockStorage();
  });

  it('migrates eg-vault to eg-vault:guest on module load', async () => {
    const seeded = {
      entries: [{ product: makeProduct(), addedAt: 1700000000000 }],
    };
    globalThis.localStorage.setItem('eg-vault', JSON.stringify(seeded));

    const { $vault } = await freshStore();
    // Legacy key should be removed
    assert.equal(globalThis.localStorage.getItem('eg-vault'), null);
    // Data should be in scoped key
    const scopedRaw = globalThis.localStorage.getItem('eg-vault:guest');
    assert.ok(scopedRaw !== null);
    // Atom should have the migrated data
    assert.equal($vault.get().entries.length, 1);
  });

  it('does not overwrite existing scoped key during migration', async () => {
    const legacy = {
      entries: [{ product: makeProduct({ id: 'legacy' }), addedAt: 1 }],
    };
    const existing = {
      entries: [{ product: makeProduct({ id: 'existing' }), addedAt: 2 }],
    };
    globalThis.localStorage.setItem('eg-vault', JSON.stringify(legacy));
    globalThis.localStorage.setItem('eg-vault:guest', JSON.stringify(existing));

    const { $vault } = await freshStore();
    // Existing scoped key preserved, legacy removed
    assert.equal(globalThis.localStorage.getItem('eg-vault'), null);
    assert.equal($vault.get().entries[0].product.id, 'existing');
  });
});
