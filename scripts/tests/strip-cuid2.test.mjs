import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  buildCuid2ToSlugMap,
  rewriteProductId,
  stripProductFields,
} from '../strip-cuid2.mjs';

// ── Synthetic test data ────────────────────────────────────────────────────────

const PRODUCTS_MOUSE = [
  { legacyId: 1, slug: 'alienware-aw610m', brandId: 'brand_aaa', brand: 'Alienware', model: 'AW610M', id: 'cuid_mouse_1' },
  { legacyId: 2, slug: 'razer-viper-v3-pro', brandId: 'brand_bbb', brand: 'Razer', model: 'Viper V3 Pro', id: 'cuid_mouse_2' },
];

const PRODUCTS_KEYBOARD = [
  { legacyId: 1, slug: 'wooting-60he', brandId: 'brand_ccc', brand: 'Wooting', model: '60HE', id: 'cuid_kb_1' },
];

const PRODUCTS_MONITOR = [
  { legacyId: 1, slug: 'lg-27gr95qe-b', brandId: 'brand_ddd', brand: 'LG', model: '27GR95QE-B', id: 'cuid_mon_1' },
];

// ── buildCuid2ToSlugMap ────────────────────────────────────────────────────────

describe('buildCuid2ToSlugMap', () => {
  it('maps each product CUID2 id to its slug', () => {
    const map = buildCuid2ToSlugMap([...PRODUCTS_MOUSE, ...PRODUCTS_KEYBOARD, ...PRODUCTS_MONITOR]);
    assert.equal(map.get('cuid_mouse_1'), 'alienware-aw610m');
    assert.equal(map.get('cuid_mouse_2'), 'razer-viper-v3-pro');
    assert.equal(map.get('cuid_kb_1'), 'wooting-60he');
    assert.equal(map.get('cuid_mon_1'), 'lg-27gr95qe-b');
  });

  it('returns a Map with correct size', () => {
    const map = buildCuid2ToSlugMap(PRODUCTS_MOUSE);
    assert.equal(map.size, 2);
  });

  it('returns empty map for empty input', () => {
    const map = buildCuid2ToSlugMap([]);
    assert.equal(map.size, 0);
  });

  it('throws on duplicate CUID2 ids', () => {
    const dupes = [
      { slug: 'a', id: 'same_id' },
      { slug: 'b', id: 'same_id' },
    ];
    assert.throws(() => buildCuid2ToSlugMap(dupes), /duplicate/i);
  });

  it('throws on product missing id field', () => {
    const noId = [{ slug: 'foo', legacyId: 1, brand: 'X', model: 'Y' }];
    assert.throws(() => buildCuid2ToSlugMap(noId), /missing.*id/i);
  });

  it('throws on product missing slug field', () => {
    const noSlug = [{ id: 'abc123', legacyId: 1, brand: 'X', model: 'Y' }];
    assert.throws(() => buildCuid2ToSlugMap(noSlug), /missing.*slug/i);
  });
});

// ── rewriteProductId ───────────────────────────────────────────────────────────

describe('rewriteProductId', () => {
  const cuid2Map = new Map([
    ['cuid_mouse_1', 'alienware-aw610m'],
    ['cuid_kb_1', 'wooting-60he'],
  ]);

  it('replaces CUID2 value on productId line with slug', () => {
    const input = [
      '---',
      'category: mouse',
      'brand: Alienware',
      'productId: cuid_mouse_1',
      'toc: true',
      '---',
    ].join('\n');

    const result = rewriteProductId(input, cuid2Map);
    assert.ok(result.includes('productId: alienware-aw610m'));
    assert.ok(!result.includes('cuid_mouse_1'));
  });

  it('preserves all other frontmatter lines unchanged', () => {
    const input = [
      '---',
      'category: mouse',
      'brand: Alienware',
      'model: AW610M',
      'productId: cuid_mouse_1',
      'toc: true',
      '---',
      '',
      'Body content here.',
    ].join('\n');

    const result = rewriteProductId(input, cuid2Map);
    assert.ok(result.includes('category: mouse'));
    assert.ok(result.includes('brand: Alienware'));
    assert.ok(result.includes('model: AW610M'));
    assert.ok(result.includes('toc: true'));
    assert.ok(result.includes('Body content here.'));
  });

  it('returns unchanged string if no productId line', () => {
    const input = [
      '---',
      'category: game',
      'brand: Activision',
      '---',
    ].join('\n');

    const result = rewriteProductId(input, cuid2Map);
    assert.equal(result, input);
  });

  it('throws if productId CUID2 not found in map', () => {
    const input = [
      '---',
      'productId: unknown_cuid',
      '---',
    ].join('\n');

    assert.throws(() => rewriteProductId(input, cuid2Map), /not found.*map/i);
  });

  it('handles productId already being a slug (no-op)', () => {
    const input = [
      '---',
      'productId: alienware-aw610m',
      '---',
    ].join('\n');

    // If the value is already a slug (not in the map as a CUID2 key),
    // the function should throw because it's an unknown CUID2.
    // But we may want to skip already-migrated files. Let's test both behaviors.
    // Per plan: the script should only run once. Throw on unknown.
    assert.throws(() => rewriteProductId(input, cuid2Map), /not found.*map/i);
  });
});

// ── stripProductFields ─────────────────────────────────────────────────────────

describe('stripProductFields', () => {
  it('removes id, brandId, and legacyId from every product', () => {
    const result = stripProductFields(PRODUCTS_MOUSE);
    for (const product of result) {
      assert.equal(product.id, undefined, 'id should be removed');
      assert.equal(product.brandId, undefined, 'brandId should be removed');
      assert.equal(product.legacyId, undefined, 'legacyId should be removed');
    }
  });

  it('preserves slug, brand, model, and all other fields', () => {
    const input = [
      {
        legacyId: 1,
        slug: 'razer-viper',
        brandId: 'brand_bbb',
        brand: 'Razer',
        model: 'Viper',
        category: 'mouse',
        price_range: 79.99,
        id: 'cuid_xyz',
      },
    ];
    const result = stripProductFields(input);
    assert.equal(result[0].slug, 'razer-viper');
    assert.equal(result[0].brand, 'Razer');
    assert.equal(result[0].model, 'Viper');
    assert.equal(result[0].category, 'mouse');
    assert.equal(result[0].price_range, 79.99);
  });

  it('does not mutate the original array', () => {
    const original = [{ legacyId: 1, slug: 'a', brandId: 'b', brand: 'B', model: 'M', id: 'c' }];
    const originalCopy = JSON.parse(JSON.stringify(original));
    stripProductFields(original);
    assert.deepEqual(original, originalCopy);
  });

  it('returns empty array for empty input', () => {
    const result = stripProductFields([]);
    assert.deepEqual(result, []);
  });

  it('handles products that already lack the fields (idempotent)', () => {
    const input = [{ slug: 'foo', brand: 'Bar', model: 'Baz', category: 'mouse' }];
    const result = stripProductFields(input);
    assert.equal(result[0].slug, 'foo');
    assert.equal(result[0].id, undefined);
  });
});
