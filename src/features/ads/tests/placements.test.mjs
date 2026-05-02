import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';

// ─── Schema validation ──────────────────────────────────────────────────────
describe('ads config — schema validation', () => {
  it('AD_POSITIONS is a non-empty object', async () => {
    const { AD_POSITIONS } = await import('../config.ts');
    assert.equal(typeof AD_POSITIONS, 'object');
    assert.ok(Object.keys(AD_POSITIONS).length > 0, 'Must have at least one position');
  });

  it('validates all entries against Zod schema', async () => {
    const { adSlotConfigSchema } = await import('../config.ts');
    const { AD_POSITIONS } = await import('../config.ts');
    for (const [name, entry] of Object.entries(AD_POSITIONS)) {
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

  it('has exactly 5 positions including hero units', async () => {
    const { AD_POSITIONS } = await import('../config.ts');
    const keys = Object.keys(AD_POSITIONS);
    assert.equal(keys.length, 5, `Expected 5 positions, got ${keys.length}`);
    assert.ok(keys.includes('sidebar'));
    assert.ok(keys.includes('sidebar_sticky'));
    assert.ok(keys.includes('in_content'));
    assert.ok(keys.includes('hero_leaderboard'));
    assert.ok(keys.includes('hero_companion'));
  });
});

// ─── Size format validation ─────────────────────────────────────────────────
describe('ads config — size format', () => {
  it('all positions have sizes matching WxH pattern', async () => {
    const { AD_POSITIONS } = await import('../config.ts');
    const sizePattern = /^\d+x\d+$/;
    for (const [name, position] of Object.entries(AD_POSITIONS)) {
      const sizes = position.sizes.split(',');
      for (const size of sizes) {
        assert.match(
          size.trim(),
          sizePattern,
          `Position "${name}" has invalid size "${size}" — expected WxH format`
        );
      }
    }
  });
});

// ─── resolveAd ──────────────────────────────────────────────────────────────
describe('resolveAd()', () => {
  it('returns correct shape for sidebar', async () => {
    const { resolveAd } = await import('../resolve.ts');
    const p = resolveAd('sidebar');
    assert.ok(p !== undefined, 'sidebar must exist');
    assert.equal(p.provider, 'adsense');
    assert.equal(typeof p.adSlot, 'string');
    assert.ok(p.adSlot.length > 0);
    assert.equal(typeof p.sizes, 'string');
    assert.equal(typeof p.display, 'boolean');
  });

  it('returns correct shape for sidebar_sticky', async () => {
    const { resolveAd } = await import('../resolve.ts');
    const p = resolveAd('sidebar_sticky');
    assert.ok(p !== undefined, 'sidebar_sticky must exist');
    assert.equal(p.provider, 'adsense');
    assert.equal(p.display, true);
  });

  it('returns correct shape for in_content', async () => {
    const { resolveAd } = await import('../resolve.ts');
    const p = resolveAd('in_content');
    assert.ok(p !== undefined, 'in_content must exist');
    assert.equal(p.provider, 'adsense');
    assert.equal(p.placementType, 'inline');
  });

  it('returns undefined for nonexistent position', async () => {
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

// ─── Position slot contract ─────────────────────────────────────────────────
describe('position slot contract', () => {
  it('sidebar uses adSlot 6560707323', async () => {
    const { resolveAd } = await import('../resolve.ts');
    const p = resolveAd('sidebar');
    assert.equal(p?.adSlot, '6560707323');
  });

  it('sidebar sizes match registry', async () => {
    const { resolveAd } = await import('../resolve.ts');
    const p = resolveAd('sidebar');
    assert.equal(p?.sizes, '300x400,300x250,300x300');
  });

  it('sidebar_sticky uses adSlot 3735233435', async () => {
    const { resolveAd } = await import('../resolve.ts');
    const p = resolveAd('sidebar_sticky');
    assert.equal(p?.adSlot, '3735233435');
  });

  it('sidebar_sticky sizes match registry', async () => {
    const { resolveAd } = await import('../resolve.ts');
    const p = resolveAd('sidebar_sticky');
    assert.equal(p?.sizes, '300x600,300x250');
  });

  it('in_content uses adSlot 1051669276', async () => {
    const { resolveAd } = await import('../resolve.ts');
    const p = resolveAd('in_content');
    assert.equal(p?.adSlot, '1051669276');
  });

  it('in_content sizes match registry', async () => {
    const { resolveAd } = await import('../resolve.ts');
    const p = resolveAd('in_content');
    assert.equal(p?.sizes, '970x250,728x90,336x280,300x250,320x100,320x50');
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

// ─── placementType contract ─────────────────────────────────────────────
describe('placementType', () => {
  it('in_content has placementType "inline"', async () => {
    const { AD_POSITIONS } = await import('../config.ts');
    assert.equal(AD_POSITIONS['in_content'].placementType, 'inline');
  });

  it('sidebar defaults to placementType "rail"', async () => {
    const { AD_POSITIONS } = await import('../config.ts');
    assert.equal(AD_POSITIONS['sidebar'].placementType, 'rail');
  });

  it('sidebar_sticky defaults to placementType "rail"', async () => {
    const { AD_POSITIONS } = await import('../config.ts');
    assert.equal(AD_POSITIONS['sidebar_sticky'].placementType, 'rail');
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

async function importAdsConfigForNodeEnv(nodeEnv) {
  const previousNodeEnv = process.env.NODE_ENV;
  process.env.NODE_ENV = nodeEnv;

  try {
    return await import(`../config.ts?node-env=${nodeEnv}-${Date.now()}`);
  } finally {
    if (previousNodeEnv === undefined) {
      delete process.env.NODE_ENV;
    } else {
      process.env.NODE_ENV = previousNodeEnv;
    }
  }
}

describe('sample ad runtime gating', () => {
  it('disables sample ads in production mode even when the registry enables them', async () => {
    const { LOAD_SAMPLE_ADS } = await importAdsConfigForNodeEnv('production');
    assert.equal(LOAD_SAMPLE_ADS, false);
  });

  it('keeps sample ads available in development mode for layout verification', async () => {
    const { LOAD_SAMPLE_ADS } = await importAdsConfigForNodeEnv('development');
    assert.equal(LOAD_SAMPLE_ADS, true);
  });

  it('preserves production placeholder behavior independently from sample-ad gating', async () => {
    const { SHOW_PRODUCTION_PLACEHOLDERS } = await importAdsConfigForNodeEnv('production');
    assert.equal(SHOW_PRODUCTION_PLACEHOLDERS, true);
  });
});

describe('sample ad runtime knobs', () => {
  it('exports a SAMPLE_AD_MODE value accepted by the schema', async () => {
    const { SAMPLE_AD_MODE, sampleAdModeSchema } = await import('../config.ts');
    assert.equal(sampleAdModeSchema.safeParse(SAMPLE_AD_MODE).success, true);
  });

  it('exports a SAMPLE_AD_NETWORK value accepted by the schema', async () => {
    const { SAMPLE_AD_NETWORK, sampleAdNetworkSchema } = await import('../config.ts');
    assert.equal(sampleAdNetworkSchema.safeParse(SAMPLE_AD_NETWORK).success, true);
  });
});
