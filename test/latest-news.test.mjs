// ─── Latest News Utils — TDD Tests ──────────────────────────────────────────
// Contract: Pure slicing logic for LatestNews component.
// newsTopGridItems  → first 4 items (top 2×2 grid)
// newsBottomFeedItems → items [4..19] (bottom horizontal feed, max 16)
// newsAdInsertIndex → feed index for inline ad insertion (7 when ≥8 items)
//
// WHY inlined: latest-news-utils.ts imports FeaturedItem type from
// featured-scroller-utils.ts → article-helpers.ts → Astro env. Can't load
// .ts in node:test. Functions are trivial slicing — inline matches repo pattern.

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

// ── Inlined from src/features/home/latest-news-utils.ts ─────────────────────
const TOP_GRID_LIMIT = 4;
const BOTTOM_FEED_MAX = 16;
const AD_INSERT_THRESHOLD = 8;

function newsTopGridItems(items) {
  return items.slice(0, TOP_GRID_LIMIT);
}

function newsBottomFeedItems(items) {
  return items.slice(TOP_GRID_LIMIT, TOP_GRID_LIMIT + BOTTOM_FEED_MAX);
}

function newsAdInsertIndex(feedLength) {
  return feedLength >= AD_INSERT_THRESHOLD ? AD_INSERT_THRESHOLD - 1 : -1;
}

/** Factory: create N dummy FeaturedItems */
function makeItems(n) {
  return Array.from({ length: n }, (_, i) => ({
    id: `news-${i}`,
    url: `/news/news-${i}`,
    title: `News Item ${i}`,
    description: `Description for item ${i}`,
    category: 'news',
    categoryLabel: 'News',
    heroPath: `/images/news/news-${i}/hero`,
    srcset: `/images/news/news-${i}/hero_s.webp 400w`,
    dateFormatted: `Published | Jan ${i + 1}, 2025`,
  }));
}

// ─── newsTopGridItems ────────────────────────────────────────────────────────

describe('newsTopGridItems', () => {
  it('returns first 4 items from array of 20', () => {
    const items = makeItems(20);
    const result = newsTopGridItems(items);
    assert.equal(result.length, 4);
    assert.deepEqual(
      result.map(r => r.id),
      ['news-0', 'news-1', 'news-2', 'news-3'],
    );
  });

  it('returns all items when < 4 available', () => {
    const items = makeItems(2);
    const result = newsTopGridItems(items);
    assert.equal(result.length, 2);
    assert.deepEqual(
      result.map(r => r.id),
      ['news-0', 'news-1'],
    );
  });

  it('returns empty array for empty input', () => {
    const result = newsTopGridItems([]);
    assert.equal(result.length, 0);
  });
});

// ─── newsBottomFeedItems ─────────────────────────────────────────────────────

describe('newsBottomFeedItems', () => {
  it('returns items [4..19] from array of 20', () => {
    const items = makeItems(20);
    const result = newsBottomFeedItems(items);
    assert.equal(result.length, 16);
    assert.equal(result[0].id, 'news-4');
    assert.equal(result[15].id, 'news-19');
  });

  it('returns empty array when ≤ 4 items', () => {
    assert.equal(newsBottomFeedItems(makeItems(4)).length, 0);
    assert.equal(newsBottomFeedItems(makeItems(3)).length, 0);
    assert.equal(newsBottomFeedItems(makeItems(0)).length, 0);
  });

  it('returns items [4..end] when 5-19 items', () => {
    const items = makeItems(7);
    const result = newsBottomFeedItems(items);
    assert.equal(result.length, 3);
    assert.equal(result[0].id, 'news-4');
    assert.equal(result[2].id, 'news-6');
  });

  it('caps at 16 items (index 4..19)', () => {
    const items = makeItems(30);
    const result = newsBottomFeedItems(items);
    assert.equal(result.length, 16);
    assert.equal(result[0].id, 'news-4');
    assert.equal(result[15].id, 'news-19');
  });
});

// ─── newsAdInsertIndex ───────────────────────────────────────────────────────

describe('newsAdInsertIndex', () => {
  it('returns 7 when feed has ≥ 8 items', () => {
    assert.equal(newsAdInsertIndex(8), 7);
    assert.equal(newsAdInsertIndex(16), 7);
    assert.equal(newsAdInsertIndex(100), 7);
  });

  it('returns -1 when feed has < 8 items', () => {
    assert.equal(newsAdInsertIndex(7), -1);
    assert.equal(newsAdInsertIndex(3), -1);
    assert.equal(newsAdInsertIndex(1), -1);
  });

  it('returns -1 when feed is empty', () => {
    assert.equal(newsAdInsertIndex(0), -1);
  });
});
