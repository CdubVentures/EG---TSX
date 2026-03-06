import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildDashboard,
  entryKey,
  splitBadge,
} from '../src/core/dashboard-filter.mjs';

// ─── Test helpers ───────────────────────────────────────────────────────────

function makeEntry(collection, id, overrides = {}) {
  return {
    id,
    _collection: collection,
    data: {
      title: `${collection}/${id}`,
      hero: 'feature-image',
      datePublished: new Date('2025-01-01'),
      dateUpdated: null,
      ...overrides,
    },
  };
}

function makeEntries(count, collection = 'reviews') {
  return Array.from({ length: count }, (_, i) => {
    const dayOffset = count - i; // newest first by index
    return makeEntry(collection, `entry-${i}`, {
      datePublished: new Date(`2025-01-${String(dayOffset).padStart(2, '0')}`),
    });
  });
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('entryKey', () => {
  it('builds composite key from _collection and id', () => {
    const entry = makeEntry('reviews', 'mouse/razer/viper');
    assert.equal(entryKey(entry), 'reviews:mouse/razer/viper');
  });

  it('handles nested paths in id', () => {
    const entry = makeEntry('news', 'monitor/msi-unveils-mag');
    assert.equal(entryKey(entry), 'news:monitor/msi-unveils-mag');
  });
});

describe('buildDashboard — fallback (no config)', () => {
  it('returns entries sorted by date descending when no config', () => {
    const entries = [
      makeEntry('reviews', 'old', { datePublished: new Date('2024-01-01') }),
      makeEntry('news', 'new', { datePublished: new Date('2025-06-01') }),
      makeEntry('guides', 'mid', { datePublished: new Date('2025-03-01') }),
    ];
    const result = buildDashboard(entries);
    assert.equal(result.length, 3);
    assert.equal(result[0].entry.id, 'new');
    assert.equal(result[1].entry.id, 'mid');
    assert.equal(result[2].entry.id, 'old');
  });

  it('limits to 15 entries', () => {
    const entries = makeEntries(20);
    const result = buildDashboard(entries);
    assert.equal(result.length, 15);
  });

  it('filters entries without hero', () => {
    const entries = [
      makeEntry('reviews', 'has-hero', { hero: 'feature-image' }),
      makeEntry('reviews', 'no-hero', { hero: undefined }),
      makeEntry('reviews', 'empty-hero', { hero: '' }),
    ];
    const result = buildDashboard(entries);
    assert.equal(result.length, 1);
    assert.equal(result[0].entry.id, 'has-hero');
  });

  it('prefers dateUpdated over datePublished for sorting', () => {
    const entries = [
      makeEntry('reviews', 'old-pub-new-upd', {
        datePublished: new Date('2024-01-01'),
        dateUpdated: new Date('2025-12-01'),
      }),
      makeEntry('reviews', 'new-pub', {
        datePublished: new Date('2025-06-01'),
        dateUpdated: null,
      }),
    ];
    const result = buildDashboard(entries);
    assert.equal(result[0].entry.id, 'old-pub-new-upd');
    assert.equal(result[1].entry.id, 'new-pub');
  });

  it('returns empty array for empty input', () => {
    const result = buildDashboard([]);
    assert.deepEqual(result, []);
  });

  it('preserves _collection on entries', () => {
    const entries = [makeEntry('guides', 'test-guide')];
    const result = buildDashboard(entries);
    assert.equal(result[0].entry._collection, 'guides');
  });
});

describe('buildDashboard — manual slots', () => {
  it('places manual override at correct 1-indexed position', () => {
    const entries = [
      makeEntry('reviews', 'a', { datePublished: new Date('2025-06-01') }),
      makeEntry('news', 'b', { datePublished: new Date('2025-03-01') }),
      makeEntry('guides', 'c', { datePublished: new Date('2025-01-01') }),
    ];
    const config = {
      slots: { '1': { collection: 'guides', id: 'c' } },
      pinned: [],
      badges: {},
      excluded: [],
    };
    const result = buildDashboard(entries, config);
    // Slot 1 = index 0 should be 'c' (manually placed)
    assert.equal(result[0].entry.id, 'c');
    // Remaining fill by date
    assert.equal(result[1].entry.id, 'a');
    assert.equal(result[2].entry.id, 'b');
  });

  it('ignores nonexistent entries in manual slots', () => {
    const entries = [makeEntry('reviews', 'a')];
    const config = {
      slots: { '1': { collection: 'reviews', id: 'does-not-exist' } },
      pinned: [],
      badges: {},
      excluded: [],
    };
    const result = buildDashboard(entries, config);
    // Should still have 'a' filling in
    assert.equal(result.length, 1);
    assert.equal(result[0].entry.id, 'a');
  });

  it('ignores out-of-range slot numbers', () => {
    const entries = [makeEntry('reviews', 'a')];
    const config = {
      slots: {
        '0': { collection: 'reviews', id: 'a' },
        '16': { collection: 'reviews', id: 'a' },
      },
      pinned: [],
      badges: {},
      excluded: [],
    };
    const result = buildDashboard(entries, config);
    // 'a' should auto-fill into slot 1
    assert.equal(result.length, 1);
    assert.equal(result[0].entry.id, 'a');
  });

  it('does not duplicate manually placed entries in auto-fill', () => {
    const entries = [
      makeEntry('reviews', 'a', { datePublished: new Date('2025-06-01') }),
      makeEntry('reviews', 'b', { datePublished: new Date('2025-03-01') }),
    ];
    const config = {
      slots: { '2': { collection: 'reviews', id: 'a' } },
      pinned: [],
      badges: {},
      excluded: [],
    };
    const result = buildDashboard(entries, config);
    assert.equal(result.length, 2);
    // Slot 1 (index 0) auto-fills with 'b' (next by date, 'a' already used)
    assert.equal(result[0].entry.id, 'b');
    // Slot 2 (index 1) is manually 'a'
    assert.equal(result[1].entry.id, 'a');
  });

  it('handles multiple manual slots', () => {
    const entries = makeEntries(5);
    const config = {
      slots: {
        '1': { collection: 'reviews', id: 'entry-4' },
        '3': { collection: 'reviews', id: 'entry-0' },
      },
      pinned: [],
      badges: {},
      excluded: [],
    };
    const result = buildDashboard(entries, config);
    assert.equal(result[0].entry.id, 'entry-4');
    assert.equal(result[2].entry.id, 'entry-0');
  });
});

describe('buildDashboard — exclusions', () => {
  it('excludes entries in the excluded list', () => {
    const entries = [
      makeEntry('reviews', 'keep'),
      makeEntry('reviews', 'exclude-me'),
    ];
    const config = {
      slots: {},
      pinned: [],
      badges: {},
      excluded: ['reviews:exclude-me'],
    };
    const result = buildDashboard(entries, config);
    assert.equal(result.length, 1);
    assert.equal(result[0].entry.id, 'keep');
  });

  it('ignores excluded entries even when manually assigned to a slot', () => {
    const entries = [
      makeEntry('reviews', 'a', { datePublished: new Date('2025-06-01') }),
      makeEntry('reviews', 'b', { datePublished: new Date('2025-03-01') }),
    ];
    const config = {
      slots: { '1': { collection: 'reviews', id: 'b' } },
      pinned: [],
      badges: {},
      excluded: ['reviews:b'],
    };
    const result = buildDashboard(entries, config);
    // 'b' is excluded, so slot 1 should be auto-filled with 'a'
    assert.equal(result.length, 1);
    assert.equal(result[0].entry.id, 'a');
  });
});

describe('buildDashboard — metadata', () => {
  it('sets isPinned true when entry key is in pinned set', () => {
    const entries = [makeEntry('reviews', 'pinned-one')];
    const config = {
      slots: {},
      pinned: ['reviews:pinned-one'],
      badges: {},
      excluded: [],
    };
    const result = buildDashboard(entries, config);
    assert.equal(result[0].meta.isPinned, true);
  });

  it('sets isPinned false when entry key is NOT in pinned set', () => {
    const entries = [makeEntry('reviews', 'not-pinned')];
    const config = {
      slots: {},
      pinned: [],
      badges: {},
      excluded: [],
    };
    const result = buildDashboard(entries, config);
    assert.equal(result[0].meta.isPinned, false);
  });

  it('sets badgeText from badges map', () => {
    const entries = [makeEntry('reviews', 'award-winner')];
    const config = {
      slots: {},
      pinned: [],
      badges: { 'reviews:award-winner': 'Top Pick' },
      excluded: [],
    };
    const result = buildDashboard(entries, config);
    assert.equal(result[0].meta.badgeText, 'Top Pick');
  });

  it('sets badgeText to null when absent from badges map', () => {
    const entries = [makeEntry('reviews', 'no-badge')];
    const result = buildDashboard(entries);
    assert.equal(result[0].meta.badgeText, null);
  });

  it('combines isPinned and badgeText independently', () => {
    const entries = [
      makeEntry('reviews', 'both'),
      makeEntry('news', 'neither'),
    ];
    const config = {
      slots: {},
      pinned: ['reviews:both'],
      badges: { 'reviews:both': 'Editors Choice' },
      excluded: [],
    };
    const result = buildDashboard(entries, config);
    const both = result.find((r) => r.entry.id === 'both');
    const neither = result.find((r) => r.entry.id === 'neither');
    assert.equal(both.meta.isPinned, true);
    assert.equal(both.meta.badgeText, 'Editors Choice');
    assert.equal(neither.meta.isPinned, false);
    assert.equal(neither.meta.badgeText, null);
  });
});

describe('buildDashboard — edge cases', () => {
  it('returns fewer than 15 when not enough eligible entries', () => {
    const entries = makeEntries(3);
    const result = buildDashboard(entries);
    assert.equal(result.length, 3);
  });

  it('handles entries with null dates gracefully', () => {
    const entries = [
      makeEntry('reviews', 'no-dates', {
        datePublished: null,
        dateUpdated: null,
      }),
      makeEntry('reviews', 'has-date', {
        datePublished: new Date('2025-01-01'),
      }),
    ];
    const result = buildDashboard(entries);
    assert.equal(result.length, 2);
    // Entry with a date sorts first
    assert.equal(result[0].entry.id, 'has-date');
    assert.equal(result[1].entry.id, 'no-dates');
  });

  it('handles entries from mixed collections', () => {
    const entries = [
      makeEntry('reviews', 'r1', { datePublished: new Date('2025-01-01') }),
      makeEntry('news', 'n1', { datePublished: new Date('2025-06-01') }),
      makeEntry('guides', 'g1', { datePublished: new Date('2025-03-01') }),
    ];
    const result = buildDashboard(entries);
    assert.equal(result.length, 3);
    // Preserves collection identity
    assert.equal(result[0].entry._collection, 'news');
    assert.equal(result[1].entry._collection, 'guides');
    assert.equal(result[2].entry._collection, 'reviews');
  });
});

// ─── Full-grid coverage tests ───────────────────────────────────────────────
// Verify pin/badge metadata reaches every slot position in the dashboard layout:
//   Slot 1  = Hero card (index 0)
//   Slots 2-4  = Row 2 cards (indices 1-3)
//   Slot 5  = Large cinematic tile (index 4)
//   Slots 6-8  = Row 3 cards (indices 5-7)
//   Slots 9-11 = Row 4 cards (indices 8-10)
//   Slots 12-15 = Row 5 cards (indices 11-14)

describe('buildDashboard — pins/badges in every slot position', () => {
  // Build 15 entries, pin and badge specific ones targeting each row type
  const entries = makeEntries(15, 'reviews');

  const config = {
    slots: {},
    pinned: [
      'reviews:entry-0',   // slot 1 (hero)
      'reviews:entry-1',   // slot 2 (row2)
      'reviews:entry-4',   // slot 5 (large tile)
      'reviews:entry-5',   // slot 6 (row3)
      'reviews:entry-8',   // slot 9 (row4)
      'reviews:entry-11',  // slot 12 (row5)
    ],
    badges: {
      'reviews:entry-0': 'Top Pick',         // hero
      'reviews:entry-2': 'Editors Choice',   // row2 (slot 3)
      'reviews:entry-4': 'Best Overall',     // large tile
      'reviews:entry-7': 'Hot Take',         // row3 (slot 8)
      'reviews:entry-10': 'Award Winner',    // row4 (slot 11)
      'reviews:entry-14': 'Staff Pick',      // row5 (slot 15)
    },
    excluded: [],
  };

  const result = buildDashboard(entries, config);

  it('produces exactly 15 entries', () => {
    assert.equal(result.length, 15);
  });

  // Hero (index 0, slot 1)
  it('hero card (slot 1) has isPinned and badgeText', () => {
    assert.equal(result[0].meta.isPinned, true);
    assert.equal(result[0].meta.badgeText, 'Top Pick');
  });

  // Row 2 (indices 1-3, slots 2-4)
  it('row2 slot 2 has pin, no badge', () => {
    assert.equal(result[1].meta.isPinned, true);
    assert.equal(result[1].meta.badgeText, null);
  });

  it('row2 slot 3 has badge, no pin', () => {
    assert.equal(result[2].meta.isPinned, false);
    assert.equal(result[2].meta.badgeText, 'Editors Choice');
  });

  it('row2 slot 4 has neither pin nor badge', () => {
    assert.equal(result[3].meta.isPinned, false);
    assert.equal(result[3].meta.badgeText, null);
  });

  // Large tile (index 4, slot 5)
  it('large tile (slot 5) has both pin and badge', () => {
    assert.equal(result[4].meta.isPinned, true);
    assert.equal(result[4].meta.badgeText, 'Best Overall');
  });

  // Row 3 (indices 5-7, slots 6-8)
  it('row3 slot 6 has pin, no badge', () => {
    assert.equal(result[5].meta.isPinned, true);
    assert.equal(result[5].meta.badgeText, null);
  });

  it('row3 slot 8 has badge, no pin', () => {
    assert.equal(result[7].meta.isPinned, false);
    assert.equal(result[7].meta.badgeText, 'Hot Take');
  });

  // Row 4 (indices 8-10, slots 9-11)
  it('row4 slot 9 has pin, no badge', () => {
    assert.equal(result[8].meta.isPinned, true);
    assert.equal(result[8].meta.badgeText, null);
  });

  it('row4 slot 11 has badge, no pin', () => {
    assert.equal(result[10].meta.isPinned, false);
    assert.equal(result[10].meta.badgeText, 'Award Winner');
  });

  // Row 5 (indices 11-14, slots 12-15)
  it('row5 slot 12 has pin, no badge', () => {
    assert.equal(result[11].meta.isPinned, true);
    assert.equal(result[11].meta.badgeText, null);
  });

  it('row5 slot 15 has badge, no pin', () => {
    assert.equal(result[14].meta.isPinned, false);
    assert.equal(result[14].meta.badgeText, 'Staff Pick');
  });

  it('unpinned/unbadged slots default to isPinned=false, badgeText=null', () => {
    // Slot 7 (index 6) — row3, no pin, no badge
    assert.equal(result[6].meta.isPinned, false);
    assert.equal(result[6].meta.badgeText, null);
    // Slot 10 (index 9) — row4, no pin, no badge
    assert.equal(result[9].meta.isPinned, false);
    assert.equal(result[9].meta.badgeText, null);
    // Slot 14 (index 13) — row5, no pin, no badge
    assert.equal(result[13].meta.isPinned, false);
    assert.equal(result[13].meta.badgeText, null);
  });
});

describe('buildDashboard — manual slot placement across all rows', () => {
  // 15 entries from mixed collections, manually place into specific row positions
  const entries = [
    makeEntry('news', 'hero-article', { datePublished: new Date('2025-01-15') }),
    makeEntry('reviews', 'row2-a', { datePublished: new Date('2025-01-14') }),
    makeEntry('reviews', 'row2-b', { datePublished: new Date('2025-01-13') }),
    makeEntry('guides', 'row2-c', { datePublished: new Date('2025-01-12') }),
    makeEntry('guides', 'large-tile', { datePublished: new Date('2025-01-11') }),
    makeEntry('news', 'row3-a', { datePublished: new Date('2025-01-10') }),
    makeEntry('news', 'row3-b', { datePublished: new Date('2025-01-09') }),
    makeEntry('reviews', 'row3-c', { datePublished: new Date('2025-01-08') }),
    makeEntry('reviews', 'row4-a', { datePublished: new Date('2025-01-07') }),
    makeEntry('guides', 'row4-b', { datePublished: new Date('2025-01-06') }),
    makeEntry('guides', 'row4-c', { datePublished: new Date('2025-01-05') }),
    makeEntry('news', 'row5-a', { datePublished: new Date('2025-01-04') }),
    makeEntry('news', 'row5-b', { datePublished: new Date('2025-01-03') }),
    makeEntry('reviews', 'row5-c', { datePublished: new Date('2025-01-02') }),
    makeEntry('reviews', 'row5-d', { datePublished: new Date('2025-01-01') }),
  ];

  // Manually place the oldest entry into hero slot, and another old one into large tile
  const config = {
    slots: {
      '1': { collection: 'reviews', id: 'row5-d' },   // force oldest into hero
      '5': { collection: 'reviews', id: 'row5-c' },   // force second-oldest into large tile
    },
    pinned: [
      'reviews:row5-d',
      'reviews:row5-c',
    ],
    badges: {
      'reviews:row5-d': 'Top Pick',
      'reviews:row5-c': 'Best Value',
    },
    excluded: [],
  };

  const result = buildDashboard(entries, config);

  it('hero (slot 1) contains manually placed entry', () => {
    assert.equal(result[0].entry.id, 'row5-d');
    assert.equal(result[0].entry._collection, 'reviews');
    assert.equal(result[0].meta.isPinned, true);
    assert.equal(result[0].meta.badgeText, 'Top Pick');
  });

  it('large tile (slot 5) contains manually placed entry', () => {
    assert.equal(result[4].entry.id, 'row5-c');
    assert.equal(result[4].entry._collection, 'reviews');
    assert.equal(result[4].meta.isPinned, true);
    assert.equal(result[4].meta.badgeText, 'Best Value');
  });

  it('remaining slots auto-fill by date without duplicating manual entries', () => {
    const ids = result.map((r) => r.entry.id);
    // No duplicates
    assert.equal(new Set(ids).size, 15);
    // Manual entries not in auto-fill positions
    assert.notEqual(result[1].entry.id, 'row5-d');
    assert.notEqual(result[1].entry.id, 'row5-c');
  });

  it('auto-filled slots sort by newest date descending', () => {
    // Slots 2-4 (indices 1-3) should be the 3 newest remaining entries
    assert.equal(result[1].entry.id, 'hero-article');   // Jan 15 — newest remaining
    assert.equal(result[2].entry.id, 'row2-a');          // Jan 14
    assert.equal(result[3].entry.id, 'row2-b');          // Jan 13
  });
});

describe('buildDashboard — production dashboard.json shape', () => {
  // Simulate the exact shape of our real dashboard.json to ensure it parses
  const entries = [
    makeEntry('news', 'monitor/msi-unveils-mag', { datePublished: new Date('2025-06-01') }),
    makeEntry('reviews', 'keyboard/asus-rog-strix', { datePublished: new Date('2025-05-01') }),
    makeEntry('guides', 'mouse/mouse-best-overall', { datePublished: new Date('2025-04-01') }),
    makeEntry('news', 'ai/common-sense-machines', { datePublished: new Date('2025-03-01') }),
    makeEntry('reviews', 'mouse/razer-viper-v3-pro', { datePublished: new Date('2025-02-01') }),
    ...makeEntries(10, 'reviews'),  // filler
  ];

  const config = {
    slots: {
      '1': { collection: 'news', id: 'monitor/msi-unveils-mag' },
      '2': { collection: 'reviews', id: 'keyboard/asus-rog-strix' },
      '5': { collection: 'guides', id: 'mouse/mouse-best-overall' },
      '8': { collection: 'news', id: 'ai/common-sense-machines' },
      '12': { collection: 'reviews', id: 'mouse/razer-viper-v3-pro' },
    },
    pinned: [
      'news:monitor/msi-unveils-mag',
      'reviews:keyboard/asus-rog-strix',
      'guides:mouse/mouse-best-overall',
      'reviews:mouse/razer-viper-v3-pro',
      'news:ai/common-sense-machines',
    ],
    badges: {
      'news:monitor/msi-unveils-mag': 'Top Pick',
      'reviews:keyboard/asus-rog-strix': 'Editors Choice',
      'guides:mouse/mouse-best-overall': 'Best Overall',
      'news:ai/common-sense-machines': 'Hot Take',
      'reviews:mouse/razer-viper-v3-pro': 'Award Winner',
    },
    excluded: [],
  };

  const result = buildDashboard(entries, config);

  it('slot 1 (hero) is pinned with correct badge', () => {
    assert.equal(result[0].entry.id, 'monitor/msi-unveils-mag');
    assert.equal(result[0].meta.isPinned, true);
    assert.equal(result[0].meta.badgeText, 'Top Pick');
  });

  it('slot 2 (row2) is pinned with correct badge', () => {
    assert.equal(result[1].entry.id, 'keyboard/asus-rog-strix');
    assert.equal(result[1].meta.isPinned, true);
    assert.equal(result[1].meta.badgeText, 'Editors Choice');
  });

  it('slot 5 (large tile) is pinned with correct badge', () => {
    assert.equal(result[4].entry.id, 'mouse/mouse-best-overall');
    assert.equal(result[4].meta.isPinned, true);
    assert.equal(result[4].meta.badgeText, 'Best Overall');
  });

  it('slot 8 (row3) is pinned with correct badge', () => {
    assert.equal(result[7].entry.id, 'ai/common-sense-machines');
    assert.equal(result[7].meta.isPinned, true);
    assert.equal(result[7].meta.badgeText, 'Hot Take');
  });

  it('slot 12 (row5) is pinned with correct badge', () => {
    assert.equal(result[11].entry.id, 'mouse/razer-viper-v3-pro');
    assert.equal(result[11].meta.isPinned, true);
    assert.equal(result[11].meta.badgeText, 'Award Winner');
  });

  it('non-pinned auto-fill slots have no pin/badge', () => {
    // Slot 3 (index 2) — auto-fill, no pin/badge in config
    assert.equal(result[2].meta.isPinned, false);
    assert.equal(result[2].meta.badgeText, null);
  });
});

describe('splitBadge', () => {
  it('splits two-word text into two lines', () => {
    assert.deepEqual(splitBadge('Top Pick'), ['Top', 'Pick']);
  });

  it('defaults empty text to "Top Pick"', () => {
    assert.deepEqual(splitBadge(''), ['Top', 'Pick']);
  });

  it('defaults null to "Top Pick"', () => {
    assert.deepEqual(splitBadge(null), ['Top', 'Pick']);
  });

  it('pads single word with empty string', () => {
    assert.deepEqual(splitBadge('Winner'), ['Winner', '']);
  });

  it('truncates to 2 words max', () => {
    assert.deepEqual(splitBadge('Best Of Year'), ['Best', 'Of']);
  });
});

// ─── Category filtering upstream ────────────────────────────────────────────
// WHY: The content gateway (getReviews/getGuides/getNews) filters out articles
// whose category is disabled in categories.json BEFORE they reach buildDashboard.
// These tests verify that buildDashboard handles the resulting gaps correctly:
// manual slots referencing filtered-out articles, pinned/badged articles that
// no longer exist in allEntries, etc.

describe('buildDashboard — category filtering upstream', () => {
  it('manual slot referencing missing article auto-fills from remaining', () => {
    // Simulate: article was in slot 1 but its category got disabled upstream
    const entries = [
      makeEntry('reviews', 'mouse-review', { datePublished: new Date('2025-06-01') }),
      makeEntry('guides', 'guide-1', { datePublished: new Date('2025-03-01') }),
    ];
    const config = {
      slots: {
        '1': { collection: 'news', id: 'filtered-out-article' },  // not in allEntries
      },
      pinned: [],
      badges: {},
      excluded: [],
    };
    const result = buildDashboard(entries, config);
    // Slot 1 auto-fills with newest remaining
    assert.equal(result[0].entry.id, 'mouse-review');
    assert.equal(result[1].entry.id, 'guide-1');
    assert.equal(result.length, 2);
  });

  it('pinned article missing from allEntries does not crash', () => {
    const entries = [
      makeEntry('reviews', 'exists', { datePublished: new Date('2025-06-01') }),
    ];
    const config = {
      slots: {},
      pinned: ['news:gone-article'],  // pinned but not in allEntries
      badges: {},
      excluded: [],
    };
    const result = buildDashboard(entries, config);
    assert.equal(result.length, 1);
    assert.equal(result[0].entry.id, 'exists');
    // Existing entry should NOT be marked as pinned
    assert.equal(result[0].meta.isPinned, false);
  });

  it('badged article missing from allEntries produces no stale metadata', () => {
    const entries = [
      makeEntry('guides', 'still-here', { datePublished: new Date('2025-03-01') }),
    ];
    const config = {
      slots: {},
      pinned: [],
      badges: { 'news:gone-article': 'Top Pick' },  // badge for missing article
      excluded: [],
    };
    const result = buildDashboard(entries, config);
    assert.equal(result.length, 1);
    assert.equal(result[0].entry.id, 'still-here');
    assert.equal(result[0].meta.badgeText, null);
  });

  it('all manual slots reference missing articles — pure date-sort fallback', () => {
    const entries = [
      makeEntry('reviews', 'r1', { datePublished: new Date('2025-06-01') }),
      makeEntry('reviews', 'r2', { datePublished: new Date('2025-05-01') }),
      makeEntry('reviews', 'r3', { datePublished: new Date('2025-04-01') }),
    ];
    const config = {
      slots: {
        '1': { collection: 'news', id: 'gone-1' },
        '2': { collection: 'news', id: 'gone-2' },
        '5': { collection: 'news', id: 'gone-3' },
      },
      pinned: ['news:gone-1', 'news:gone-2'],
      badges: { 'news:gone-1': 'Hot Take' },
      excluded: [],
    };
    const result = buildDashboard(entries, config);
    // All manual slots fail to resolve, auto-fill takes over with date sort
    assert.equal(result.length, 3);
    assert.equal(result[0].entry.id, 'r1');
    assert.equal(result[1].entry.id, 'r2');
    assert.equal(result[2].entry.id, 'r3');
    // No stale pins/badges leak into result
    assert.equal(result[0].meta.isPinned, false);
    assert.equal(result[0].meta.badgeText, null);
  });

  it('mixed manual slots — some resolve, some missing', () => {
    const entries = [
      makeEntry('reviews', 'r1', { datePublished: new Date('2025-06-01') }),
      makeEntry('reviews', 'r2', { datePublished: new Date('2025-05-01') }),
      makeEntry('guides', 'g1', { datePublished: new Date('2025-04-01') }),
    ];
    const config = {
      slots: {
        '1': { collection: 'reviews', id: 'r2' },     // exists
        '3': { collection: 'news', id: 'gone-1' },     // missing
        '5': { collection: 'guides', id: 'g1' },       // exists
      },
      pinned: ['reviews:r2'],
      badges: { 'guides:g1': 'Best Guide' },
      excluded: [],
    };
    const result = buildDashboard(entries, config);
    assert.equal(result.length, 3);
    // Slot 1: manual r2
    assert.equal(result[0].entry.id, 'r2');
    assert.equal(result[0].meta.isPinned, true);
    // Slot 2: auto-fill r1 (newest remaining)
    assert.equal(result[1].entry.id, 'r1');
    // Slot 3 was supposed to be gone-1, but missing → auto-fill skips (no more entries)
    // Slot 5 (index 4): manual g1 — but only 3 entries total, so it fills at index 2
    // Actually with 3 entries: slot 1=r2, slot 2=auto(r1), slot 3=auto(nothing→skip),
    // slot 4=auto(nothing), slot 5=g1 → but g1 placed at slot 5 (index 4), only 3 entries.
    // The result filters out nulls, so we get [r2, r1, g1] in that order.
    assert.equal(result[2].entry.id, 'g1');
    assert.equal(result[2].meta.badgeText, 'Best Guide');
  });
});
