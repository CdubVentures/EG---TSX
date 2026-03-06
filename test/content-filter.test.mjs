import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

// â”€â”€â”€ Unit test the pure content filtering logic â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Mirrors products-gateway.test.mjs pattern: test the pure filter predicate
// without Astro. The gateway (content.ts) composes: getCollection + this filter.
import { filterArticles } from '../src/core/content-filter.mjs';

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// Contract: filterArticles(entries, activeContentCategories) â†’ filtered + sorted
//
// Filter rules (applied in order):
//   1. publish !== false  (exclude stubs)
//   2. draft !== true         (exclude drafts)
//   3. If entry has category â†’ must be in activeContentCategories
//   4. Sort by datePublished descending (nulls last)
//
// Invariants:
//   - Entries without a category field skip rule 3 (brands, games)
//   - Empty activeContentCategories â†’ all entries with a category are excluded
//   - Does not mutate the input array
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

/** Factory: minimal article entry shape matching Astro getCollection return. */
function makeArticle(overrides = {}) {
  return {
    id: overrides.id ?? 'test-article',
    data: {
      title: 'Test Article',
      publish: true,
      draft: false,
      datePublished: new Date('2025-01-15'),
      ...overrides,
    },
  };
}

// â”€â”€â”€ publish filtering â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

describe('filterArticles â€” publish', () => {
  const active = ['mouse', 'keyboard', 'monitor'];

  it('keeps entries with publish: true', () => {
    const entries = [makeArticle({ category: 'mouse', publish: true })];
    const result = filterArticles(entries, active);
    assert.equal(result.length, 1);
  });

  it('excludes entries with publish: false', () => {
    const entries = [makeArticle({ category: 'mouse', publish: false })];
    const result = filterArticles(entries, active);
    assert.equal(result.length, 0);
  });

  it('keeps entries with publish: undefined (default true)', () => {
    const entries = [makeArticle({ category: 'mouse', publish: undefined })];
    const result = filterArticles(entries, active);
    assert.equal(result.length, 1);
  });
});

// â”€â”€â”€ draft filtering â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

describe('filterArticles â€” draft', () => {
  const active = ['mouse', 'keyboard', 'monitor'];

  it('keeps entries with draft: false', () => {
    const entries = [makeArticle({ category: 'mouse', draft: false })];
    const result = filterArticles(entries, active);
    assert.equal(result.length, 1);
  });

  it('excludes entries with draft: true', () => {
    const entries = [makeArticle({ category: 'mouse', draft: true })];
    const result = filterArticles(entries, active);
    assert.equal(result.length, 0);
  });

  it('keeps entries with draft: undefined (default false)', () => {
    const entries = [makeArticle({ category: 'mouse', draft: undefined })];
    const result = filterArticles(entries, active);
    assert.equal(result.length, 1);
  });
});

// â”€â”€â”€ category filtering â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

describe('filterArticles â€” category', () => {
  it('keeps entries whose category is in the active list', () => {
    const entries = [
      makeArticle({ id: 'a', category: 'mouse' }),
      makeArticle({ id: 'b', category: 'keyboard' }),
      makeArticle({ id: 'c', category: 'headset' }),
    ];
    const result = filterArticles(entries, ['mouse', 'keyboard']);
    assert.equal(result.length, 2);
    const cats = result.map(e => e.data.category);
    assert.deepEqual(cats.sort(), ['keyboard', 'mouse']);
  });

  it('excludes entries whose category is not in the active list', () => {
    const entries = [makeArticle({ category: 'headset' })];
    const result = filterArticles(entries, ['mouse']);
    assert.equal(result.length, 0);
  });

  it('keeps entries with NO category field (brands, games)', () => {
    const entries = [makeArticle({ id: 'brand-1' })];
    // No category property at all
    delete entries[0].data.category;
    const result = filterArticles(entries, ['mouse']);
    assert.equal(result.length, 1);
  });

  it('excludes all categorized entries when activeCategories is empty', () => {
    const entries = [
      makeArticle({ id: 'a', category: 'mouse' }),
      makeArticle({ id: 'b', category: 'keyboard' }),
    ];
    const result = filterArticles(entries, []);
    assert.equal(result.length, 0);
  });

  it('keeps uncategorized entries even when activeCategories is empty', () => {
    const entry = makeArticle({ id: 'brand-1' });
    delete entry.data.category;
    const result = filterArticles([entry], []);
    assert.equal(result.length, 1);
  });
});

// â”€â”€â”€ combined filtering â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

describe('filterArticles â€” combined filters', () => {
  const active = ['mouse', 'keyboard'];

  it('excludes draft even if category is active', () => {
    const entries = [makeArticle({ category: 'mouse', draft: true })];
    const result = filterArticles(entries, active);
    assert.equal(result.length, 0);
  });

  it('excludes publish:false even if category is active', () => {
    const entries = [makeArticle({ category: 'mouse', publish: false })];
    const result = filterArticles(entries, active);
    assert.equal(result.length, 0);
  });

  it('excludes inactive category even if not draft and publish', () => {
    const entries = [makeArticle({ category: 'headset', draft: false, publish: true })];
    const result = filterArticles(entries, active);
    assert.equal(result.length, 0);
  });

  it('applies all three filters together', () => {
    const entries = [
      makeArticle({ id: 'a', category: 'mouse', draft: false, publish: true }),  // âœ“
      makeArticle({ id: 'b', category: 'mouse', draft: true, publish: true }),   // âœ— draft
      makeArticle({ id: 'c', category: 'mouse', draft: false, publish: false }), // âœ— stub
      makeArticle({ id: 'd', category: 'headset', draft: false, publish: true }),// âœ— inactive
      makeArticle({ id: 'e', category: 'keyboard', draft: false, publish: true }), // âœ“
    ];
    const result = filterArticles(entries, active);
    assert.equal(result.length, 2);
    assert.deepEqual(result.map(e => e.id).sort(), ['a', 'e']);
  });
});

// â”€â”€â”€ sorting â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

describe('filterArticles â€” sorting', () => {
  const active = ['mouse'];

  it('sorts by datePublished descending (newest first)', () => {
    const entries = [
      makeArticle({ id: 'old', category: 'mouse', datePublished: new Date('2024-01-01') }),
      makeArticle({ id: 'new', category: 'mouse', datePublished: new Date('2025-06-01') }),
      makeArticle({ id: 'mid', category: 'mouse', datePublished: new Date('2024-07-15') }),
    ];
    const result = filterArticles(entries, active);
    assert.deepEqual(result.map(e => e.id), ['new', 'mid', 'old']);
  });

  it('puts entries with null/undefined datePublished last', () => {
    const entries = [
      makeArticle({ id: 'no-date', category: 'mouse', datePublished: undefined }),
      makeArticle({ id: 'has-date', category: 'mouse', datePublished: new Date('2025-01-01') }),
    ];
    const result = filterArticles(entries, active);
    assert.deepEqual(result.map(e => e.id), ['has-date', 'no-date']);
  });

  it('handles all entries having no datePublished (stable order)', () => {
    const entries = [
      makeArticle({ id: 'a', category: 'mouse', datePublished: undefined }),
      makeArticle({ id: 'b', category: 'mouse', datePublished: undefined }),
    ];
    const result = filterArticles(entries, active);
    assert.equal(result.length, 2);
  });
});

// â”€â”€â”€ edge cases â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

describe('filterArticles â€” edge cases', () => {
  it('returns empty array for empty input', () => {
    const result = filterArticles([], ['mouse']);
    assert.deepEqual(result, []);
  });

  it('does not mutate the input array', () => {
    const entries = [
      makeArticle({ id: 'a', category: 'mouse', datePublished: new Date('2025-06-01') }),
      makeArticle({ id: 'b', category: 'mouse', datePublished: new Date('2024-01-01') }),
    ];
    const original = [...entries];
    filterArticles(entries, ['mouse']);
    assert.equal(entries.length, original.length);
    assert.equal(entries[0].id, original[0].id);
    assert.equal(entries[1].id, original[1].id);
  });

  it('handles entries with both no category and no datePublished', () => {
    const entry = makeArticle({ id: 'bare', datePublished: undefined });
    delete entry.data.category;
    const result = filterArticles([entry], []);
    assert.equal(result.length, 1);
  });
});
