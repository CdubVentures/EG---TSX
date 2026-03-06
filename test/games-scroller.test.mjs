// ─── Games Scroller — Contract Tests ─────────────────────────────────────────
// Tests for: computeArrowState (slider-utils.ts) + article helper verification
// for games context (resolveHero, articleUrl, articleSrcSet).
//
// WHY: article-helpers.ts imports ./images → ./config → import.meta.env (Astro).
// Can't run directly in node:test, so article helpers are inlined per existing
// test pattern (see test/article-helpers.test.mjs).

import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';

// ── Inlined article helpers (same logic as src/core/article-helpers.ts) ──────
const articleUrl = (collection, entryId) => `/${collection}/${entryId}`;

const resolveHero = (collection, entryId, heroStem) =>
  `/images/${collection}/${entryId}/${heroStem}`;

const articleSrcSet = (heroPath) => {
  const sizes = [
    { suffix: 'xxs', w: 100 },
    { suffix: 'xs', w: 200 },
    { suffix: 's', w: 400 },
    { suffix: 'm', w: 600 },
    { suffix: 'l', w: 800 },
    { suffix: 'xl', w: 1000 },
    { suffix: 'xxl', w: 2000 },
  ];
  return sizes.map(s => `${heroPath}_${s.suffix}.webp ${s.w}w`).join(', ');
};

// ── Data resolution tests (article helpers, games context) ───────────────────

describe('resolveHero — games context', () => {
  it('returns correct path for valorant', () => {
    const result = resolveHero('games', 'valorant', 'box-art-cover');
    assert.equal(result, '/images/games/valorant/box-art-cover');
  });

  it('returns correct path for counter-strike-2', () => {
    const result = resolveHero('games', 'counter-strike-2', 'box-art-cover');
    assert.equal(result, '/images/games/counter-strike-2/box-art-cover');
  });
});

describe('articleUrl — games context', () => {
  it('returns /games/valorant', () => {
    assert.equal(articleUrl('games', 'valorant'), '/games/valorant');
  });

  it('returns /games/counter-strike-2', () => {
    assert.equal(articleUrl('games', 'counter-strike-2'), '/games/counter-strike-2');
  });
});

describe('articleSrcSet — games context', () => {
  const basePath = '/images/games/valorant/box-art-cover';
  const srcset = articleSrcSet(basePath);

  it('includes all 7 sizes', () => {
    const entries = srcset.split(', ');
    assert.equal(entries.length, 7);
  });

  it('includes correct size suffixes', () => {
    const suffixes = ['_xxs', '_xs', '_s', '_m', '_l', '_xl', '_xxl'];
    for (const suffix of suffixes) {
      assert.ok(srcset.includes(suffix), `missing suffix ${suffix}`);
    }
  });

  it('every entry has .webp extension', () => {
    const entries = srcset.split(', ');
    for (const entry of entries) {
      assert.ok(entry.includes('.webp'), `missing .webp in "${entry}"`);
    }
  });

  it('includes width descriptors', () => {
    const widths = ['100w', '200w', '400w', '600w', '800w', '1000w', '2000w'];
    for (const w of widths) {
      assert.ok(srcset.includes(w), `missing width ${w}`);
    }
  });
});

// ── Slider arrow state logic (inlined — same as slider-utils.ts) ─────────────
// WHY: slider-utils.ts imports are compiled by Astro, not runnable in node:test.
// Inline the pure function to avoid import issues, matching article-helpers pattern above.
const computeArrowState = (scrollLeft, scrollWidth, clientWidth) => {
  const maxScroll = scrollWidth - clientWidth;
  if (maxScroll <= 0) {
    return { leftActive: false, rightActive: false };
  }
  return {
    leftActive: scrollLeft > 0,
    rightActive: scrollLeft < maxScroll - 1,
  };
};

describe('computeArrowState', () => {
  it('scrollLeft=0 → left inactive, right active', () => {
    const result = computeArrowState(0, 2000, 500);
    assert.equal(result.leftActive, false);
    assert.equal(result.rightActive, true);
  });

  it('scrollLeft at max → left active, right inactive', () => {
    // scrollWidth=2000, clientWidth=500 → max scrollLeft = 1500
    const result = computeArrowState(1500, 2000, 500);
    assert.equal(result.leftActive, true);
    assert.equal(result.rightActive, false);
  });

  it('scrollLeft in middle → both active', () => {
    const result = computeArrowState(750, 2000, 500);
    assert.equal(result.leftActive, true);
    assert.equal(result.rightActive, true);
  });

  it('content fits viewport (scrollWidth <= clientWidth) → both inactive', () => {
    const result = computeArrowState(0, 500, 500);
    assert.equal(result.leftActive, false);
    assert.equal(result.rightActive, false);
  });

  it('content fits viewport (scrollWidth < clientWidth) → both inactive', () => {
    const result = computeArrowState(0, 300, 500);
    assert.equal(result.leftActive, false);
    assert.equal(result.rightActive, false);
  });

  it('scrollLeft near max (within 1px tolerance) → right inactive', () => {
    // WHY: browser rounding can leave scrollLeft 1px short of true max
    const result = computeArrowState(1499, 2000, 500);
    assert.equal(result.leftActive, true);
    assert.equal(result.rightActive, false);
  });
});
