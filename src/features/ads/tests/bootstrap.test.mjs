import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';

// ─── checkStickyPolicy ──────────────────────────────────────────────────
describe('checkStickyPolicy()', () => {
  it('returns warning for adsense + sticky', async () => {
    const { checkStickyPolicy } = await import('../bootstrap.ts');
    const result = checkStickyPolicy('adsense', true, 'sidebar_sticky');
    assert.equal(typeof result, 'string');
    assert.ok(result.length > 0);
  });

  it('returns null for adsense + non-sticky', async () => {
    const { checkStickyPolicy } = await import('../bootstrap.ts');
    assert.equal(checkStickyPolicy('adsense', false, 'sidebar'), null);
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

  it('returns "direct" for direct provider', async () => {
    const { resolveProviderRoute } = await import('../bootstrap.ts');
    assert.equal(resolveProviderRoute('direct'), 'direct');
  });

  it('returns null for unknown provider', async () => {
    const { resolveProviderRoute } = await import('../bootstrap.ts');
    assert.equal(resolveProviderRoute('unknown'), null);
    assert.equal(resolveProviderRoute(''), null);
    assert.equal(resolveProviderRoute('gpt'), null);
    assert.equal(resolveProviderRoute('native'), null);
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
    assert.equal(typeof mod.checkStickyPolicy, 'function');
    assert.equal(typeof mod.resolveProviderRoute, 'function');
  });

  it('exports isSlotHidden function', async () => {
    const mod = await import('../bootstrap.ts');
    assert.equal(typeof mod.isSlotHidden, 'function');
  });
});

describe('mountAll()', () => {
  it('queries only live slots and excludes placeholders and sample slots', async () => {
    const { mountAll } = await import('../bootstrap.ts');
    let selector = '';
    const root = {
      querySelectorAll(nextSelector) {
        selector = nextSelector;
        return [];
      },
    };

    mountAll(root);

    assert.equal(
      selector,
      '.ad-slot:not([data-placeholder="true"]):not(.ad-slot--sample)',
    );
  });
});
