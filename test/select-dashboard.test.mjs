import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { selectDashboard } from '../src/features/site-index/select-dashboard.mjs';

// ─── Test helpers ───────────────────────────────────────────────────────────

function makeItem(id, overrides = {}) {
  return {
    id,
    category: 'mice',
    datePublished: new Date('2025-01-15'),
    ...overrides,
  };
}

function makeDatedItem(id, dateStr, category = 'mice', overrides = {}) {
  return makeItem(id, {
    datePublished: new Date(dateStr),
    category,
    ...overrides,
  });
}

// ─── Contract: selectDashboard ──────────────────────────────────────────────
// Inputs: { items, pinnedSet?, categorySlug?, count? }
// Output: FeaturedItem[] (up to count items, default 3)
// Algorithm: pinned first (in pin order) → fill with recent → category diversity

describe('selectDashboard', () => {
  // ── Happy path ──

  it('returns up to 3 items by default from recent items', () => {
    const items = [
      makeDatedItem('a', '2025-03-01'),
      makeDatedItem('b', '2025-02-01'),
      makeDatedItem('c', '2025-01-01'),
      makeDatedItem('d', '2024-12-01'),
    ];
    const result = selectDashboard({ items });
    assert.equal(result.length, 3);
    assert.equal(result[0].id, 'a');
    assert.equal(result[1].id, 'b');
    assert.equal(result[2].id, 'c');
  });

  it('sorts unpinned by date descending (most recent first)', () => {
    const items = [
      makeDatedItem('old', '2024-01-01'),
      makeDatedItem('new', '2025-06-01'),
      makeDatedItem('mid', '2025-03-01'),
    ];
    const result = selectDashboard({ items });
    assert.equal(result[0].id, 'new');
    assert.equal(result[1].id, 'mid');
    assert.equal(result[2].id, 'old');
  });

  it('prefers hero-backed unpinned items before hero-less ones', () => {
    const items = [
      makeDatedItem('nohero-new', '2025-06-01', 'mice', { heroPath: '', srcset: '' }),
      makeDatedItem('hero-mid', '2025-05-01', 'keyboards', { heroPath: '/images/keyboards/hero-mid/hero', srcset: '/images/keyboards/hero-mid/hero_s.webp 400w' }),
      makeDatedItem('hero-old', '2025-04-01', 'monitors', { heroPath: '/images/monitors/hero-old/hero', srcset: '/images/monitors/hero-old/hero_s.webp 400w' }),
    ];
    const result = selectDashboard({ items });
    assert.deepEqual(result.map((item) => item.id), ['hero-mid', 'hero-old', 'nohero-new']);
  });


  // ── Pinned items ──

  it('places pinned items first, in pin-set iteration order', () => {
    const items = [
      makeDatedItem('a', '2025-03-01'),
      makeDatedItem('b', '2025-02-01'),
      makeDatedItem('c', '2025-01-01'),
      makeDatedItem('d', '2024-12-01'),
    ];
    const pinnedSet = new Set(['c', 'd']);
    const result = selectDashboard({ items, pinnedSet });
    // Pinned c and d should come first (in Set iteration order: c, d)
    assert.equal(result[0].id, 'c');
    assert.equal(result[1].id, 'd');
    // Then most recent unpinned
    assert.equal(result[2].id, 'a');
  });

  it('fills remaining slots with most recent unpinned after pinned', () => {
    const items = [
      makeDatedItem('a', '2025-06-01'),
      makeDatedItem('b', '2025-05-01'),
      makeDatedItem('c', '2025-04-01'),
      makeDatedItem('d', '2025-03-01'),
      makeDatedItem('e', '2025-02-01'),
    ];
    const pinnedSet = new Set(['d']);
    const result = selectDashboard({ items, pinnedSet, count: 4 });
    assert.equal(result[0].id, 'd');  // pinned
    assert.equal(result[1].id, 'a');  // most recent unpinned
    assert.equal(result[2].id, 'b');
    assert.equal(result[3].id, 'c');
  });

  it('pinned item that does not exist in items is skipped', () => {
    const items = [
      makeDatedItem('a', '2025-03-01'),
      makeDatedItem('b', '2025-02-01'),
    ];
    const pinnedSet = new Set(['nonexistent', 'a']);
    const result = selectDashboard({ items, pinnedSet });
    assert.equal(result[0].id, 'a');  // only valid pin
    assert.equal(result[1].id, 'b');  // fills from recent
  });

  // ── Category diversity (all-view) ──

  it('enforces category diversity when categorySlug is empty', () => {
    // All same category — should still work (no alternatives), just top 3
    const items = [
      makeDatedItem('a', '2025-03-01', 'mice'),
      makeDatedItem('b', '2025-02-01', 'mice'),
      makeDatedItem('c', '2025-01-01', 'mice'),
    ];
    const result = selectDashboard({ items, categorySlug: '' });
    assert.equal(result.length, 3);
  });

  it('skips same-category duplicate in all-view to increase diversity', () => {
    const items = [
      makeDatedItem('m1', '2025-06-01', 'mice'),
      makeDatedItem('m2', '2025-05-01', 'mice'),
      makeDatedItem('m3', '2025-04-01', 'mice'),
      makeDatedItem('k1', '2025-03-01', 'keyboards'),
      makeDatedItem('mon1', '2025-02-01', 'monitors'),
    ];
    const result = selectDashboard({ items, categorySlug: '' });
    // Should pick m1 (mice, newest), then prefer k1 or mon1 for diversity
    assert.equal(result[0].id, 'm1');
    // Slots 2 and 3 should NOT all be mice — diversity kicks in
    const categories = result.map(r => r.category);
    const uniqueCats = new Set(categories);
    assert.ok(uniqueCats.size >= 2, `Expected >= 2 unique categories, got: ${[...uniqueCats]}`);
  });

  it('diversity does not block all slots — fills with same cat if no alternatives', () => {
    const items = [
      makeDatedItem('a', '2025-06-01', 'mice'),
      makeDatedItem('b', '2025-05-01', 'mice'),
    ];
    const result = selectDashboard({ items, categorySlug: '' });
    // Only mice available, must fill with what we have
    assert.equal(result.length, 2);
    assert.equal(result[0].id, 'a');
    assert.equal(result[1].id, 'b');
  });

  // ── Category filter (single category view) ──

  it('does NOT enforce diversity when categorySlug is set', () => {
    const items = [
      makeDatedItem('m1', '2025-06-01', 'mice'),
      makeDatedItem('m2', '2025-05-01', 'mice'),
      makeDatedItem('m3', '2025-04-01', 'mice'),
      makeDatedItem('k1', '2025-03-01', 'keyboards'),
    ];
    // Category view: all mice is expected
    const result = selectDashboard({ items, categorySlug: 'mice' });
    assert.equal(result.length, 3);
    assert.ok(result.every(r => r.category === 'mice'));
  });

  // ── Edge cases ──

  it('returns empty array for empty input', () => {
    const result = selectDashboard({ items: [] });
    assert.deepEqual(result, []);
  });

  it('handles fewer items than count gracefully (1 item)', () => {
    const items = [makeDatedItem('a', '2025-01-01')];
    const result = selectDashboard({ items });
    assert.equal(result.length, 1);
    assert.equal(result[0].id, 'a');
  });

  it('handles fewer items than count gracefully (2 items)', () => {
    const items = [
      makeDatedItem('a', '2025-03-01'),
      makeDatedItem('b', '2025-02-01'),
    ];
    const result = selectDashboard({ items });
    assert.equal(result.length, 2);
    assert.equal(result[0].id, 'a');
    assert.equal(result[1].id, 'b');
  });

  it('respects custom count parameter', () => {
    const items = [
      makeDatedItem('a', '2025-03-01'),
      makeDatedItem('b', '2025-02-01'),
      makeDatedItem('c', '2025-01-01'),
    ];
    const result = selectDashboard({ items, count: 2 });
    assert.equal(result.length, 2);
  });

  it('returns no duplicates', () => {
    const items = [
      makeDatedItem('a', '2025-03-01'),
      makeDatedItem('b', '2025-02-01'),
      makeDatedItem('c', '2025-01-01'),
    ];
    const pinnedSet = new Set(['a']);
    const result = selectDashboard({ items, pinnedSet });
    const ids = result.map(r => r.id);
    assert.equal(new Set(ids).size, ids.length, 'Should have no duplicate IDs');
  });

  it('pinned items are not duplicated even if also recent', () => {
    const items = [
      makeDatedItem('a', '2025-06-01'),
      makeDatedItem('b', '2025-05-01'),
      makeDatedItem('c', '2025-04-01'),
    ];
    const pinnedSet = new Set(['a']); // 'a' is both pinned AND most recent
    const result = selectDashboard({ items, pinnedSet });
    assert.equal(result[0].id, 'a');
    const ids = result.map(r => r.id);
    assert.equal(new Set(ids).size, ids.length, 'No duplicates');
  });

  // ── Diversity + pinned interaction ──

  it('diversity applies only to non-pinned slots', () => {
    const items = [
      makeDatedItem('m1', '2025-06-01', 'mice'),
      makeDatedItem('m2', '2025-05-01', 'mice'),
      makeDatedItem('k1', '2025-04-01', 'keyboards'),
      makeDatedItem('k2', '2025-03-01', 'keyboards'),
    ];
    // Pin both mice — they should still appear
    const pinnedSet = new Set(['m1', 'm2']);
    const result = selectDashboard({ items, pinnedSet, categorySlug: '' });
    assert.equal(result[0].id, 'm1');
    assert.equal(result[1].id, 'm2');
    // Third slot: diversity prefers keyboard over another mouse
    assert.equal(result[2].id, 'k1');
  });
});
