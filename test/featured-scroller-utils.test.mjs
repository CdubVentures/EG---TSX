// ─── Featured Scroller — Contract Tests ──────────────────────────────────────
// Tests for: toFeaturedItem, groupByCategory, getActiveCategories
//
// WHY: article-helpers.ts imports ./images → ./config → import.meta.env (Astro).
// Can't run directly in node:test, so article helpers are inlined per existing
// test pattern (see test/games-scroller.test.mjs, test/article-helpers.test.mjs).

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

const formatArticleDate = (datePublished, dateUpdated) => {
  const date = dateUpdated ?? datePublished;
  if (!date) return '';
  const formatted = new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(date);
  const prefix = dateUpdated ? 'Updated' : 'Published';
  return `${prefix} | ${formatted}`;
};

// ── Inlined category label helper (same as src/core/config.ts:label) ─────────
const categoryLabel = (cat) =>
  ({ mouse: 'Mouse', keyboard: 'Keyboard', monitor: 'Monitor',
     headset: 'Headset', mousepad: 'Mousepad', controller: 'Controller',
     game: 'Game', gpu: 'GPU' })[cat] ?? (cat.charAt(0).toUpperCase() + cat.slice(1));

// ── Inlined featured-scroller-utils functions ────────────────────────────────
// WHY: Same Astro import-boundary reason as above. These inline copies must match
// src/features/home/featured-scroller-utils.ts exactly.

function toFeaturedItem(entry) {
  const collection = entry._collection;
  const heroStem = entry.data.hero;
  const heroPath = heroStem ? resolveHero(collection, entry.id, heroStem) : '';
  const srcset = heroPath ? articleSrcSet(heroPath) : '';
  const category = entry.data.category ?? '';

  return {
    id: entry.id,
    url: articleUrl(collection, entry.id),
    title: entry.data.title,
    description: entry.data.description ?? '',
    category,
    categoryLabel: category ? categoryLabel(category) : '',
    heroPath,
    srcset,
    dateFormatted: formatArticleDate(entry.data.datePublished, entry.data.dateUpdated),
    egbadge: entry.data.egbadge,
  };
}

function groupByCategory(items) {
  const groups = {};
  for (const item of items) {
    if (!item.category) continue;
    if (!groups[item.category]) groups[item.category] = [];
    groups[item.category].push(item);
  }
  return groups;
}

function getActiveCategories(itemsByCategory, allCategoryIds) {
  return allCategoryIds.filter(id => itemsByCategory[id]?.length > 0);
}


// ═════════════════════════════════════════════════════════════════════════════
// Tests
// ═════════════════════════════════════════════════════════════════════════════

// ── Factory ──────────────────────────────────────────────────────────────────
function makeEntry(overrides = {}) {
  return {
    id: 'razer-viper-v3-pro-review',
    _collection: 'reviews',
    data: {
      title: 'Razer Viper V3 Pro Review',
      description: 'Best wireless mouse for FPS.',
      hero: 'feature-image',
      category: 'mouse',
      datePublished: new Date('2024-12-09'),
      dateUpdated: new Date('2025-01-15'),
      ...overrides,
    },
  };
}

// ── toFeaturedItem ───────────────────────────────────────────────────────────

describe('toFeaturedItem', () => {
  it('returns correct url from collection + id', () => {
    const entry = makeEntry();
    const item = toFeaturedItem(entry);
    assert.equal(item.url, '/reviews/razer-viper-v3-pro-review');
  });

  it('returns correct heroPath from hero stem', () => {
    const entry = makeEntry();
    const item = toFeaturedItem(entry);
    assert.equal(item.heroPath, '/images/reviews/razer-viper-v3-pro-review/feature-image');
  });

  it('returns 7-size srcset', () => {
    const entry = makeEntry();
    const item = toFeaturedItem(entry);
    const entries = item.srcset.split(', ');
    assert.equal(entries.length, 7);
    assert.ok(item.srcset.includes('_xxs.webp 100w'));
    assert.ok(item.srcset.includes('_xxl.webp 2000w'));
  });

  it('formats dateUpdated as "Updated | ..."', () => {
    const entry = makeEntry();
    const item = toFeaturedItem(entry);
    assert.ok(item.dateFormatted.startsWith('Updated |'));
    assert.ok(item.dateFormatted.includes('Jan'));
    assert.ok(item.dateFormatted.includes('2025'));
  });

  it('formats datePublished when no dateUpdated', () => {
    const entry = makeEntry({ dateUpdated: undefined });
    const item = toFeaturedItem(entry);
    assert.ok(item.dateFormatted.startsWith('Published |'));
    assert.ok(item.dateFormatted.includes('Dec'));
    assert.ok(item.dateFormatted.includes('2024'));
  });

  it('returns empty heroPath when hero is missing', () => {
    const entry = makeEntry({ hero: undefined });
    const item = toFeaturedItem(entry);
    assert.equal(item.heroPath, '');
    assert.equal(item.srcset, '');
  });

  it('returns empty dateFormatted when both dates are missing', () => {
    const entry = makeEntry({ datePublished: undefined, dateUpdated: undefined });
    const item = toFeaturedItem(entry);
    assert.equal(item.dateFormatted, '');
  });

  it('maps category to categoryLabel', () => {
    const entry = makeEntry({ category: 'keyboard' });
    const item = toFeaturedItem(entry);
    assert.equal(item.categoryLabel, 'Keyboard');
  });

  it('passes through title and description', () => {
    const entry = makeEntry();
    const item = toFeaturedItem(entry);
    assert.equal(item.title, 'Razer Viper V3 Pro Review');
    assert.equal(item.description, 'Best wireless mouse for FPS.');
  });

  it('includes egbadge when present', () => {
    const entry = makeEntry({ egbadge: "Editor's Pick" });
    const item = toFeaturedItem(entry);
    assert.equal(item.egbadge, "Editor's Pick");
  });

  it('egbadge is undefined when not present', () => {
    const entry = makeEntry();
    const item = toFeaturedItem(entry);
    assert.equal(item.egbadge, undefined);
  });

  it('handles guides collection', () => {
    const entry = {
      id: 'best-mouse-2025',
      _collection: 'guides',
      data: {
        title: 'Best Mouse 2025',
        description: 'Top picks',
        hero: 'title',
        category: 'mouse',
        datePublished: new Date('2025-02-01'),
      },
    };
    const item = toFeaturedItem(entry);
    assert.equal(item.url, '/guides/best-mouse-2025');
    assert.equal(item.heroPath, '/images/guides/best-mouse-2025/title');
  });

  it('handles missing category gracefully', () => {
    const entry = makeEntry({ category: undefined });
    const item = toFeaturedItem(entry);
    assert.equal(item.category, '');
    assert.equal(item.categoryLabel, '');
  });
});

// ── groupByCategory ──────────────────────────────────────────────────────────

describe('groupByCategory', () => {
  it('groups items correctly by category field', () => {
    const items = [
      { category: 'mouse', id: 'a' },
      { category: 'keyboard', id: 'b' },
      { category: 'mouse', id: 'c' },
      { category: 'monitor', id: 'd' },
    ];
    const grouped = groupByCategory(items);
    assert.equal(grouped.mouse.length, 2);
    assert.equal(grouped.keyboard.length, 1);
    assert.equal(grouped.monitor.length, 1);
    assert.deepEqual(grouped.mouse.map(i => i.id), ['a', 'c']);
  });

  it('empty array → empty object', () => {
    const grouped = groupByCategory([]);
    assert.deepEqual(grouped, {});
  });

  it('items without category → excluded', () => {
    const items = [
      { category: 'mouse', id: 'a' },
      { category: '', id: 'b' },
      { category: undefined, id: 'c' },
      { category: 'keyboard', id: 'd' },
    ];
    const grouped = groupByCategory(items);
    assert.equal(Object.keys(grouped).length, 2);
    assert.ok(!grouped['']);
    assert.ok(!grouped.undefined);
  });

  it('preserves insertion order within groups', () => {
    const items = [
      { category: 'mouse', id: 'z' },
      { category: 'mouse', id: 'a' },
      { category: 'mouse', id: 'm' },
    ];
    const grouped = groupByCategory(items);
    assert.deepEqual(grouped.mouse.map(i => i.id), ['z', 'a', 'm']);
  });
});

// ── getActiveCategories ──────────────────────────────────────────────────────

describe('getActiveCategories', () => {
  it('returns only categories that have items', () => {
    const itemsByCategory = {
      mouse: [{ id: 'a' }],
      keyboard: [{ id: 'b' }],
    };
    const allCats = ['mouse', 'keyboard', 'monitor', 'headset'];
    const result = getActiveCategories(itemsByCategory, allCats);
    assert.deepEqual(result, ['mouse', 'keyboard']);
  });

  it('preserves config order (not insertion order)', () => {
    const itemsByCategory = {
      monitor: [{ id: 'c' }],
      mouse: [{ id: 'a' }],
    };
    const allCats = ['mouse', 'keyboard', 'monitor', 'headset'];
    const result = getActiveCategories(itemsByCategory, allCats);
    assert.deepEqual(result, ['mouse', 'monitor']);
  });

  it('no items → empty array', () => {
    const result = getActiveCategories({}, ['mouse', 'keyboard']);
    assert.deepEqual(result, []);
  });

  it('empty category array in map → excluded', () => {
    const itemsByCategory = {
      mouse: [],
      keyboard: [{ id: 'b' }],
    };
    const allCats = ['mouse', 'keyboard'];
    const result = getActiveCategories(itemsByCategory, allCats);
    assert.deepEqual(result, ['keyboard']);
  });

  it('category not in config order list → excluded', () => {
    const itemsByCategory = {
      game: [{ id: 'a' }],
      mouse: [{ id: 'b' }],
    };
    // 'game' not in allCats
    const allCats = ['mouse', 'keyboard', 'monitor'];
    const result = getActiveCategories(itemsByCategory, allCats);
    assert.deepEqual(result, ['mouse']);
  });
});
