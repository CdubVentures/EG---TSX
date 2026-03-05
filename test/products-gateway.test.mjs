import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

// ─── Unit test the pure filtering logic extracted from the gateway ────────────
// We can't call getCollection() in node:test (Astro-only), so we test the
// filter predicate directly. The gateway is just: getCollection + this filter.
import { filterByActiveCategories } from '../src/core/products-filter.mjs';

// ═══════════════════════════════════════════════════════════════════════════════
// Contract: filterByActiveCategories(products, activeCategories) → filtered[]
// ═══════════════════════════════════════════════════════════════════════════════

/** Factory: minimal product entry shape matching what getCollection returns. */
function makeProduct(category) {
  return { data: { category, slug: `test-${category}`, brand: 'Test' } };
}

describe('filterByActiveCategories', () => {
  const products = [
    makeProduct('mouse'),
    makeProduct('mouse'),
    makeProduct('keyboard'),
    makeProduct('monitor'),
    makeProduct('headset'),
    makeProduct('mousepad'),
  ];

  it('keeps only products whose category is in the active list', () => {
    const result = filterByActiveCategories(products, ['mouse', 'keyboard', 'monitor']);
    assert.equal(result.length, 4);
    const cats = result.map(p => p.data.category);
    assert.deepEqual([...new Set(cats)].sort(), ['keyboard', 'monitor', 'mouse']);
  });

  it('returns empty array when no categories are active', () => {
    const result = filterByActiveCategories(products, []);
    assert.equal(result.length, 0);
  });

  it('returns all products when all categories are active', () => {
    const result = filterByActiveCategories(products, [
      'mouse', 'keyboard', 'monitor', 'headset', 'mousepad',
    ]);
    assert.equal(result.length, 6);
  });

  it('handles single active category', () => {
    const result = filterByActiveCategories(products, ['headset']);
    assert.equal(result.length, 1);
    assert.equal(result[0].data.category, 'headset');
  });

  it('handles empty products array', () => {
    const result = filterByActiveCategories([], ['mouse']);
    assert.equal(result.length, 0);
  });

  it('does not mutate the input array', () => {
    const original = [...products];
    filterByActiveCategories(products, ['mouse']);
    assert.equal(products.length, original.length);
  });

  it('excludes categories not in the active list', () => {
    const result = filterByActiveCategories(products, ['keyboard']);
    assert.ok(result.every(p => p.data.category === 'keyboard'));
  });
});
