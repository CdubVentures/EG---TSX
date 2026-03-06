import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';

// ─── Schema validation ──────────────────────────────────────────────────────
describe('ads config — schema validation', () => {
  it('AD_REGISTRY is a non-empty object', async () => {
    const { AD_REGISTRY } = await import('../config.ts');
    assert.equal(typeof AD_REGISTRY, 'object');
    assert.ok(Object.keys(AD_REGISTRY).length > 0, 'Must have at least one placement');
  });

  it('validates all entries against Zod schema', async () => {
    const { adSlotConfigSchema } = await import('../config.ts');
    const { AD_REGISTRY } = await import('../config.ts');
    for (const [name, entry] of Object.entries(AD_REGISTRY)) {
      const result = adSlotConfigSchema.safeParse(entry);
      assert.equal(result.success, true, `"${name}" failed: ${JSON.stringify(result.error?.issues)}`);
    }
  });

  it('ADSENSE_CLIENT is a non-empty ca-pub string', async () => {
    const { ADSENSE_CLIENT } = await import('../config.ts');
    assert.equal(typeof ADSENSE_CLIENT, 'string');
    assert.ok(ADSENSE_CLIENT.startsWith('ca-pub-'), `Expected "ca-pub-..." got "${ADSENSE_CLIENT}"`);
    assert.ok(ADSENSE_CLIENT.length > 10, 'Client ID too short');
  });

  it('has all 22 HBS registry placements', async () => {
    const { AD_REGISTRY } = await import('../config.ts');
    const keys = Object.keys(AD_REGISTRY);
    assert.ok(keys.length >= 22, `Expected ≥22 placements, got ${keys.length}`);
  });
});

// ─── Size format validation ─────────────────────────────────────────────────
describe('ads config — size format', () => {
  it('all placements have sizes matching WxH pattern', async () => {
    const { AD_REGISTRY } = await import('../config.ts');
    const sizePattern = /^\d+x\d+$/;
    for (const [name, placement] of Object.entries(AD_REGISTRY)) {
      const sizes = placement.sizes.split(',');
      for (const size of sizes) {
        assert.match(
          size.trim(),
          sizePattern,
          `Placement "${name}" has invalid size "${size}" — expected WxH format`
        );
      }
    }
  });
});

// ─── resolveAd ──────────────────────────────────────────────────────────────
describe('resolveAd()', () => {
  it('returns correct shape for home-rail-top', async () => {
    const { resolveAd } = await import('../resolve.ts');
    const p = resolveAd('home-rail-top');
    assert.ok(p !== undefined, 'home-rail-top must exist');
    assert.equal(p.provider, 'adsense');
    assert.equal(typeof p.adSlot, 'string');
    assert.ok(p.adSlot.length > 0);
    assert.equal(typeof p.sizes, 'string');
    assert.equal(typeof p.display, 'boolean');
  });

  it('returns correct shape for home-rail-body-1', async () => {
    const { resolveAd } = await import('../resolve.ts');
    const p = resolveAd('home-rail-body-1');
    assert.ok(p !== undefined, 'home-rail-body-1 must exist');
    assert.equal(p.provider, 'adsense');
    assert.equal(p.display, true);
  });

  it('returns undefined for nonexistent campaign', async () => {
    const { resolveAd } = await import('../resolve.ts');
    const p = resolveAd('does-not-exist-xyz');
    assert.equal(p, undefined);
  });

  it('returns undefined for empty string', async () => {
    const { resolveAd } = await import('../resolve.ts');
    const p = resolveAd('');
    assert.equal(p, undefined);
  });
});

// ─── getAdsenseClient ───────────────────────────────────────────────────────
describe('getAdsenseClient()', () => {
  it('returns the AdSense publisher client ID', async () => {
    const { getAdsenseClient } = await import('../resolve.ts');
    const client = getAdsenseClient();
    assert.equal(typeof client, 'string');
    assert.ok(client.startsWith('ca-pub-'), `Expected "ca-pub-..." got "${client}"`);
    assert.ok(client.length > 10, 'Client ID too short');
  });
});

// ─── isAdsEnabled ───────────────────────────────────────────────────────────
describe('isAdsEnabled()', () => {
  it('returns a boolean', async () => {
    const { isAdsEnabled } = await import('../resolve.ts');
    const result = isAdsEnabled();
    assert.equal(typeof result, 'boolean');
  });
});

// ─── parseSize ──────────────────────────────────────────────────────────────
describe('parseSize()', () => {
  it('parses "300x250" correctly', async () => {
    const { parseSize } = await import('../resolve.ts');
    const s = parseSize('300x250');
    assert.deepStrictEqual(s, { width: 300, height: 250 });
  });

  it('parses "300x600" correctly', async () => {
    const { parseSize } = await import('../resolve.ts');
    const s = parseSize('300x600');
    assert.deepStrictEqual(s, { width: 300, height: 600 });
  });

  it('returns undefined for invalid format', async () => {
    const { parseSize } = await import('../resolve.ts');
    assert.equal(parseSize('invalid'), undefined);
    assert.equal(parseSize(''), undefined);
    assert.equal(parseSize('300'), undefined);
    assert.equal(parseSize('x250'), undefined);
  });
});

// ─── parseFirstSize ─────────────────────────────────────────────────────────
describe('parseFirstSize()', () => {
  it('returns first size from comma-separated list', async () => {
    const { parseFirstSize } = await import('../resolve.ts');
    const s = parseFirstSize('300x400,300x250,300x300');
    assert.deepStrictEqual(s, { width: 300, height: 400 });
  });

  it('works with single size', async () => {
    const { parseFirstSize } = await import('../resolve.ts');
    const s = parseFirstSize('728x90');
    assert.deepStrictEqual(s, { width: 728, height: 90 });
  });

  it('returns undefined for empty string', async () => {
    const { parseFirstSize } = await import('../resolve.ts');
    assert.equal(parseFirstSize(''), undefined);
  });
});

// ─── Home-page contract ─────────────────────────────────────────────────────
describe('home page placements contract', () => {
  it('home-rail-top uses adSlot 6560707323', async () => {
    const { resolveAd } = await import('../resolve.ts');
    const p = resolveAd('home-rail-top');
    assert.equal(p?.adSlot, '6560707323');
  });

  it('home-rail-top sizes match HBS registry', async () => {
    const { resolveAd } = await import('../resolve.ts');
    const p = resolveAd('home-rail-top');
    assert.equal(p?.sizes, '300x400,300x250,300x300');
  });

  it('home-rail-body-1 uses adSlot 6560707323', async () => {
    const { resolveAd } = await import('../resolve.ts');
    const p = resolveAd('home-rail-body-1');
    assert.equal(p?.adSlot, '6560707323');
  });

  it('home-rail-body-1 sizes match HBS registry', async () => {
    const { resolveAd } = await import('../resolve.ts');
    const p = resolveAd('home-rail-body-1');
    assert.equal(p?.sizes, '300x400,300x250,300x300');
  });
});

// ─── parseAllSizes ──────────────────────────────────────────────────────
describe('parseAllSizes()', () => {
  it('parses all sizes from comma-separated list', async () => {
    const { parseAllSizes } = await import('../resolve.ts');
    const result = parseAllSizes('300x400,300x250,300x300');
    assert.deepStrictEqual(result, [
      { width: 300, height: 400 },
      { width: 300, height: 250 },
      { width: 300, height: 300 },
    ]);
  });

  it('returns single-element array for single size', async () => {
    const { parseAllSizes } = await import('../resolve.ts');
    const result = parseAllSizes('970x250');
    assert.deepStrictEqual(result, [{ width: 970, height: 250 }]);
  });

  it('returns empty array for empty string', async () => {
    const { parseAllSizes } = await import('../resolve.ts');
    assert.deepStrictEqual(parseAllSizes(''), []);
  });

  it('skips invalid entries', async () => {
    const { parseAllSizes } = await import('../resolve.ts');
    const result = parseAllSizes('invalid,300x250');
    assert.deepStrictEqual(result, [{ width: 300, height: 250 }]);
  });
});

// ─── parseLargestSize ───────────────────────────────────────────────────
describe('parseLargestSize()', () => {
  it('returns largest by area from multi-size list', async () => {
    const { parseLargestSize } = await import('../resolve.ts');
    const result = parseLargestSize('300x400,300x250,300x300');
    assert.deepStrictEqual(result, { width: 300, height: 400 });
  });

  it('returns 300x300 for sidebar-right-top (larger area wins)', async () => {
    const { parseLargestSize } = await import('../resolve.ts');
    // 300x250 = 75000 area, 300x300 = 90000 area → 300x300 wins
    const result = parseLargestSize('300x250,300x300');
    assert.deepStrictEqual(result, { width: 300, height: 300 });
  });

  it('returns single size when only one', async () => {
    const { parseLargestSize } = await import('../resolve.ts');
    assert.deepStrictEqual(parseLargestSize('970x250'), { width: 970, height: 250 });
  });

  it('returns undefined for empty string', async () => {
    const { parseLargestSize } = await import('../resolve.ts');
    assert.equal(parseLargestSize(''), undefined);
  });

  it('skips invalid entries and returns largest valid', async () => {
    const { parseLargestSize } = await import('../resolve.ts');
    const result = parseLargestSize('invalid,300x250');
    assert.deepStrictEqual(result, { width: 300, height: 250 });
  });
});

// ─── parseSmallestSize ──────────────────────────────────────────────────
describe('parseSmallestSize()', () => {
  it('returns smallest by area from multi-size list', async () => {
    const { parseSmallestSize } = await import('../resolve.ts');
    const result = parseSmallestSize('300x400,300x250,300x300');
    assert.deepStrictEqual(result, { width: 300, height: 250 });
  });

  it('returns single size when only one', async () => {
    const { parseSmallestSize } = await import('../resolve.ts');
    assert.deepStrictEqual(parseSmallestSize('970x250'), { width: 970, height: 250 });
  });

  it('returns undefined for empty string', async () => {
    const { parseSmallestSize } = await import('../resolve.ts');
    assert.equal(parseSmallestSize(''), undefined);
  });

  it('skips invalid entries and returns smallest valid', async () => {
    const { parseSmallestSize } = await import('../resolve.ts');
    const result = parseSmallestSize('invalid,300x250');
    assert.deepStrictEqual(result, { width: 300, height: 250 });
  });
});

// ─── Full HBS registry parity ───────────────────────────────────────────────
describe('HBS registry parity', () => {
  it('all 22 HBS registry placements are present', async () => {
    const { AD_REGISTRY } = await import('../config.ts');
    const expected = [
      'inline-ad', 'hero-right', 'hero-left',
      'home-rail-top', 'home-rail-body-1', 'home-rail-body-2', 'home-rail-body-3',
      'sidebar-right-top', 'sidebar-right-mid', 'sidebar-right-index2',
      'sidebar-right-index3', 'sidebar-right-index4',
      'footer-right', 'footer-left',
      'site-index-rail', 'type-dashboard-rail', 'type-dashboard-rail-1row',
      'moreof-rail', 'snap-rail-one', 'snap-rail-two',
      'inline-gpt', 'gpt-sidebar-right-top',
    ];
    for (const key of expected) {
      assert.ok(AD_REGISTRY[key] !== undefined, `Missing HBS placement: "${key}"`);
    }
  });

  it('GPT placements are disabled by default', async () => {
    const { AD_REGISTRY } = await import('../config.ts');
    assert.equal(AD_REGISTRY['inline-gpt'].display, false);
    assert.equal(AD_REGISTRY['gpt-sidebar-right-top'].display, false);
  });
});

// ─── placementType contract ─────────────────────────────────────────────
describe('placementType', () => {
  it('inline-ad has placementType "inline"', async () => {
    const { AD_REGISTRY } = await import('../config.ts');
    assert.equal(AD_REGISTRY['inline-ad'].placementType, 'inline');
  });

  it('inline-gpt has placementType "inline"', async () => {
    const { AD_REGISTRY } = await import('../config.ts');
    assert.equal(AD_REGISTRY['inline-gpt'].placementType, 'inline');
  });

  it('rail placements default to "rail"', async () => {
    const { AD_REGISTRY } = await import('../config.ts');
    assert.equal(AD_REGISTRY['home-rail-top'].placementType, 'rail');
    assert.equal(AD_REGISTRY['sidebar-right-top'].placementType, 'rail');
    assert.equal(AD_REGISTRY['footer-right'].placementType, 'rail');
  });
});

// ─── AD_LABEL constant ─────────────────────────────────────────────────
describe('AD_LABEL', () => {
  it('exports a non-empty string', async () => {
    const { AD_LABEL } = await import('../config.ts');
    assert.equal(typeof AD_LABEL, 'string');
    assert.ok(AD_LABEL.length > 0);
  });
});

// ─── Display knobs ──────────────────────────────────────────────────────
describe('SHOW_PRODUCTION_PLACEHOLDERS', () => {
  it('exports a boolean', async () => {
    const { SHOW_PRODUCTION_PLACEHOLDERS } = await import('../config.ts');
    assert.equal(typeof SHOW_PRODUCTION_PLACEHOLDERS, 'boolean');
  });
});

describe('LOAD_SAMPLE_ADS', () => {
  it('exports a boolean', async () => {
    const { LOAD_SAMPLE_ADS } = await import('../config.ts');
    assert.equal(typeof LOAD_SAMPLE_ADS, 'boolean');
  });
});
