import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';

// ─── parseSizesForGPT ───────────────────────────────────────────────────
describe('parseSizesForGPT()', () => {
  it('converts comma-separated sizes to GPT format', async () => {
    const { parseSizesForGPT } = await import('../bootstrap.ts');
    const result = parseSizesForGPT('300x250,336x280');
    assert.deepStrictEqual(result, [[300, 250], [336, 280]]);
  });

  it('handles single size', async () => {
    const { parseSizesForGPT } = await import('../bootstrap.ts');
    assert.deepStrictEqual(parseSizesForGPT('970x250'), [[970, 250]]);
  });

  it('returns empty array for empty string', async () => {
    const { parseSizesForGPT } = await import('../bootstrap.ts');
    assert.deepStrictEqual(parseSizesForGPT(''), []);
  });

  it('skips invalid entries', async () => {
    const { parseSizesForGPT } = await import('../bootstrap.ts');
    const result = parseSizesForGPT('invalid,300x250');
    assert.deepStrictEqual(result, [[300, 250]]);
  });

  it('handles inline-ad sizes (6 entries)', async () => {
    const { parseSizesForGPT } = await import('../bootstrap.ts');
    const result = parseSizesForGPT('970x250,728x90,336x280,300x250,320x100,320x50');
    assert.equal(result.length, 6);
    assert.deepStrictEqual(result[0], [970, 250]);
    assert.deepStrictEqual(result[5], [320, 50]);
  });
});

// ─── checkStickyPolicy ──────────────────────────────────────────────────
describe('checkStickyPolicy()', () => {
  it('returns warning for adsense + sticky', async () => {
    const { checkStickyPolicy } = await import('../bootstrap.ts');
    const result = checkStickyPolicy('adsense', true, 'sidebar-right-top');
    assert.equal(typeof result, 'string');
    assert.ok(result.length > 0);
  });

  it('returns null for adsense + non-sticky', async () => {
    const { checkStickyPolicy } = await import('../bootstrap.ts');
    assert.equal(checkStickyPolicy('adsense', false, 'sidebar-right-top'), null);
  });

  it('returns null for gpt + sticky', async () => {
    const { checkStickyPolicy } = await import('../bootstrap.ts');
    assert.equal(checkStickyPolicy('gpt', true, 'inline-gpt'), null);
  });

  it('returns null for direct + sticky', async () => {
    const { checkStickyPolicy } = await import('../bootstrap.ts');
    assert.equal(checkStickyPolicy('direct', true, 'test'), null);
  });
});

// ─── resolveProviderRoute ───────────────────────────────────────────────
describe('resolveProviderRoute()', () => {
  it('returns "adsense" for adsense provider', async () => {
    const { resolveProviderRoute } = await import('../bootstrap.ts');
    assert.equal(resolveProviderRoute('adsense'), 'adsense');
  });

  it('returns "gpt" for gpt provider', async () => {
    const { resolveProviderRoute } = await import('../bootstrap.ts');
    assert.equal(resolveProviderRoute('gpt'), 'gpt');
  });

  it('returns "direct" for direct provider', async () => {
    const { resolveProviderRoute } = await import('../bootstrap.ts');
    assert.equal(resolveProviderRoute('direct'), 'direct');
  });

  it('returns "native" for native provider', async () => {
    const { resolveProviderRoute } = await import('../bootstrap.ts');
    assert.equal(resolveProviderRoute('native'), 'native');
  });

  it('returns null for unknown provider', async () => {
    const { resolveProviderRoute } = await import('../bootstrap.ts');
    assert.equal(resolveProviderRoute('unknown'), null);
    assert.equal(resolveProviderRoute(''), null);
  });
});

// ─── isSlotHidden ───────────────────────────────────────────────────────
describe('isSlotHidden()', () => {
  it('returns true when offsetParent is null', async () => {
    const { isSlotHidden } = await import('../bootstrap.ts');
    const el = { offsetParent: null };
    assert.equal(isSlotHidden(el), true);
  });

  it('returns false when offsetParent exists', async () => {
    const { isSlotHidden } = await import('../bootstrap.ts');
    // WHY: plain object simulates a non-null offsetParent (no DOM needed)
    const el = { offsetParent: { tagName: 'BODY' } };
    assert.equal(isSlotHidden(el), false);
  });

  it('returns false for a non-null offsetParent object', async () => {
    const { isSlotHidden } = await import('../bootstrap.ts');
    const el = { offsetParent: {} };
    assert.equal(isSlotHidden(el), false);
  });
});

// ─── Module exports shape ───────────────────────────────────────────────
describe('bootstrap module exports', () => {
  it('exports init function', async () => {
    const mod = await import('../bootstrap.ts');
    assert.equal(typeof mod.init, 'function');
  });

  it('exports mountAll function', async () => {
    const mod = await import('../bootstrap.ts');
    assert.equal(typeof mod.mountAll, 'function');
  });

  it('exports pure utility functions', async () => {
    const mod = await import('../bootstrap.ts');
    assert.equal(typeof mod.parseSizesForGPT, 'function');
    assert.equal(typeof mod.checkStickyPolicy, 'function');
    assert.equal(typeof mod.resolveProviderRoute, 'function');
  });

  it('exports isSlotHidden function', async () => {
    const mod = await import('../bootstrap.ts');
    assert.equal(typeof mod.isSlotHidden, 'function');
  });
});
