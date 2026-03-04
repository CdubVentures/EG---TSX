// ─── Vault Sync Tests ──────────────────────────────────────────────────────
// Contract: mergeVaults combines guest and server vault entries correctly.
// Tests cover merge logic — the pure, testable core of the sync engine.
// Integration behavior (auth transitions, server push/pull, broadcast) is
// verified manually since it depends on browser APIs + Vite path aliases.
// Runner: node --test --experimental-strip-types

import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

// ─── Fixtures ──────────────────────────────────────────────────────────────

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

function makeMouseEntry(n) {
  return {
    product: makeProduct({
      id: `mouse/brand/mouse-${n}`,
      slug: `mouse-${n}`,
      model: `Mouse ${n}`,
    }),
    addedAt: 1700000000000 + n,
  };
}

function makeKeyboardEntry(n) {
  return {
    product: makeProduct({
      id: `keyboard/corsair/kb-${n}`,
      slug: `kb-${n}`,
      brand: 'Corsair',
      model: `Keyboard ${n}`,
      category: 'keyboard',
      imagePath: `/images/data-products/keyboard/corsair/kb-${n}`,
    }),
    addedAt: 1700000000000 + n,
  };
}

// ─── Dynamic import (fresh per suite) ──────────────────────────────────────

let importCounter = 0;

async function freshMerge() {
  importCounter++;
  return import(`../merge.ts?test=${importCounter}`);
}

// ─── mergeVaults tests ─────────────────────────────────────────────────────

describe('mergeVaults', () => {
  beforeEach(() => {
    globalThis.localStorage = globalThis.localStorage ?? { getItem() { return null; }, setItem() {}, removeItem() {}, clear() {} };
  });

  it('combines guest and server entries', async () => {
    const { mergeVaults } = await freshMerge();
    const guest = [makeMouseEntry(1)];
    const server = [makeKeyboardEntry(1)];
    const result = mergeVaults(guest, server);
    assert.equal(result.length, 2);
  });

  it('deduplicates by product ID (guest wins)', async () => {
    const { mergeVaults } = await freshMerge();
    const guestEntry = makeMouseEntry(1);
    guestEntry.addedAt = 2000000000000; // newer
    const serverEntry = makeMouseEntry(1);
    serverEntry.addedAt = 1000000000000; // older

    const result = mergeVaults([guestEntry], [serverEntry]);
    assert.equal(result.length, 1);
    assert.equal(result[0].addedAt, 2000000000000); // guest wins
  });

  it('respects max 16 per category', async () => {
    const { mergeVaults } = await freshMerge();
    const guest = Array.from({ length: 10 }, (_, i) => makeMouseEntry(i + 1));
    const server = Array.from({ length: 10 }, (_, i) => makeMouseEntry(i + 11));

    const result = mergeVaults(guest, server);
    const mouseCount = result.filter(e => e.product.category === 'mouse').length;
    assert.equal(mouseCount, 16);
  });

  it('handles empty guest vault', async () => {
    const { mergeVaults } = await freshMerge();
    const server = [makeMouseEntry(1), makeKeyboardEntry(1)];
    const result = mergeVaults([], server);
    assert.equal(result.length, 2);
  });

  it('handles empty server vault', async () => {
    const { mergeVaults } = await freshMerge();
    const guest = [makeMouseEntry(1)];
    const result = mergeVaults(guest, []);
    assert.equal(result.length, 1);
  });

  it('handles both empty', async () => {
    const { mergeVaults } = await freshMerge();
    const result = mergeVaults([], []);
    assert.equal(result.length, 0);
  });

  it('category limit is independent across categories during merge', async () => {
    const { mergeVaults } = await freshMerge();
    const guest = [
      ...Array.from({ length: 16 }, (_, i) => makeMouseEntry(i + 1)),
      makeKeyboardEntry(1),
    ];
    const server = [
      makeMouseEntry(17), // should be rejected (mouse is full)
      makeKeyboardEntry(2), // should be accepted
    ];

    const result = mergeVaults(guest, server);
    const mouseCount = result.filter(e => e.product.category === 'mouse').length;
    const kbCount = result.filter(e => e.product.category === 'keyboard').length;
    assert.equal(mouseCount, 16);
    assert.equal(kbCount, 2);
  });

  it('preserves entry order (guest first, then server)', async () => {
    const { mergeVaults } = await freshMerge();
    const guest = [makeMouseEntry(1)];
    const server = [makeKeyboardEntry(1)];
    const result = mergeVaults(guest, server);
    assert.equal(result[0].product.category, 'mouse');
    assert.equal(result[1].product.category, 'keyboard');
  });

  it('guest entry with same product ID always takes priority', async () => {
    const { mergeVaults } = await freshMerge();
    const guestEntry = {
      product: makeProduct({ id: 'shared/product/1' }),
      addedAt: 5000,
    };
    const serverEntry = {
      product: makeProduct({ id: 'shared/product/1', brand: 'ServerBrand' }),
      addedAt: 3000,
    };
    const result = mergeVaults([guestEntry], [serverEntry]);
    assert.equal(result.length, 1);
    assert.equal(result[0].product.brand, 'Razer'); // guest product data
    assert.equal(result[0].addedAt, 5000);
  });

  it('merges mixed categories correctly', async () => {
    const { mergeVaults } = await freshMerge();
    const guest = [makeMouseEntry(1), makeMouseEntry(2)];
    const server = [makeKeyboardEntry(1), makeMouseEntry(3), makeKeyboardEntry(2)];
    const result = mergeVaults(guest, server);
    assert.equal(result.length, 5);
    assert.equal(result.filter(e => e.product.category === 'mouse').length, 3);
    assert.equal(result.filter(e => e.product.category === 'keyboard').length, 2);
  });

  it('stops adding to a category once limit is reached', async () => {
    const { mergeVaults } = await freshMerge();
    const guest = Array.from({ length: 16 }, (_, i) => makeMouseEntry(i + 1));
    const server = [makeMouseEntry(20), makeMouseEntry(21)];
    const result = mergeVaults(guest, server);
    const mouseIds = result.filter(e => e.product.category === 'mouse').map(e => e.product.id);
    assert.equal(mouseIds.length, 16);
    // Server mice 20 and 21 should NOT be included
    assert.ok(!mouseIds.includes('mouse/brand/mouse-20'));
    assert.ok(!mouseIds.includes('mouse/brand/mouse-21'));
  });

  it('handles large merge without error', async () => {
    const { mergeVaults } = await freshMerge();
    const guest = Array.from({ length: 80 }, (_, i) => ({
      product: makeProduct({
        id: `cat${i % 10}/brand/p-${i}`,
        category: `cat${i % 10}`,
      }),
      addedAt: 1700000000000 + i,
    }));
    const server = Array.from({ length: 80 }, (_, i) => ({
      product: makeProduct({
        id: `cat${i % 10}/brand/s-${i}`,
        category: `cat${i % 10}`,
      }),
      addedAt: 1700000000000 + i + 100,
    }));
    const result = mergeVaults(guest, server);
    // 10 categories × 16 max = 160 ceiling. 80 guest + 80 server = 160.
    assert.equal(result.length, 160);
  });
});
