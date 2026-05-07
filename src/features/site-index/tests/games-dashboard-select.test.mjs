import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { selectDashboard6, buildDaySeed } from '../games-dashboard-select.mjs';

const FIXED_NOW = new Date(Date.UTC(2026, 4, 2, 12, 0, 0)); // 2026-05-02 stable

function makeGame(overrides = {}) {
  return {
    slug: overrides.slug,
    name: overrides.name || overrides.slug,
    genres: overrides.genres || [],
    iDashboard: overrides.iDashboard || null,
    iFilteredDashboard: overrides.iFilteredDashboard || null,
    dashKey: overrides.dashKey ?? null,
    ...overrides,
  };
}

const SAMPLE = [
  makeGame({ slug: 'apex-legends', genres: ['battle-royale-games'], iDashboard: 'all_2' }),
  makeGame({ slug: 'fortnite', genres: ['battle-royale-games'] }),
  makeGame({ slug: 'pubg', genres: ['battle-royale-games'] }),
  makeGame({ slug: 'valorant', genres: ['fps', 'tactical-shooter'] }),
  makeGame({ slug: 'counter-strike-2', genres: ['fps', 'tactical-shooter'] }),
  makeGame({ slug: 'overwatch-2', genres: ['hero-shooter'] }),
  makeGame({ slug: 'dota-2', genres: ['moba'] }),
  makeGame({ slug: 'league-of-legends', genres: ['moba'] }),
  makeGame({ slug: 'world-of-warcraft', genres: ['mmorpg'] }),
  makeGame({ slug: 'rainbow-six-siege', genres: ['fps', 'tactical-shooter'] }),
  makeGame({ slug: 'call-of-duty-warzone', genres: ['battle-royale-games', 'fps'] }),
];

const COUNTS = new Map([
  ['battle-royale-games', 4],
  ['fps', 4],
  ['tactical-shooter', 3],
  ['hero-shooter', 1],
  ['moba', 2],
  ['mmorpg', 1],
]);

describe('buildDaySeed', () => {
  it('produces the same seed for the same date+key', () => {
    const a = buildDaySeed('/games/', '', FIXED_NOW);
    const b = buildDaySeed('/games/', '', FIXED_NOW);
    assert.equal(a, b);
  });
  it('produces different seeds for different keys', () => {
    const a = buildDaySeed('/games/', '', FIXED_NOW);
    const b = buildDaySeed('/games/fps/', 'fps', FIXED_NOW);
    assert.notEqual(a, b);
  });
  it('produces different seeds for different dates', () => {
    const a = buildDaySeed('/games/', '', new Date(Date.UTC(2026, 4, 2)));
    const b = buildDaySeed('/games/', '', new Date(Date.UTC(2026, 4, 3)));
    assert.notEqual(a, b);
  });
});

describe('selectDashboard6 — determinism', () => {
  it('returns identical output across runs for the same date+key', () => {
    const a = selectDashboard6(SAMPLE, { countsMap: COUNTS, seedKey: '/games/', now: FIXED_NOW });
    const b = selectDashboard6(SAMPLE, { countsMap: COUNTS, seedKey: '/games/', now: FIXED_NOW });
    assert.deepEqual(a.map((g) => g.slug), b.map((g) => g.slug));
  });

  it('returns different ordering on different dates', () => {
    const a = selectDashboard6(SAMPLE, {
      countsMap: COUNTS, seedKey: '/games/', now: new Date(Date.UTC(2026, 0, 1)),
    });
    const b = selectDashboard6(SAMPLE, {
      countsMap: COUNTS, seedKey: '/games/', now: new Date(Date.UTC(2026, 6, 1)),
    });
    assert.notDeepEqual(a.map((g) => g.slug), b.map((g) => g.slug));
  });
});

describe('selectDashboard6 — pin priority', () => {
  it('places iDashboard=all_N pin in slot N when no genre filter', () => {
    const out = selectDashboard6(SAMPLE, { countsMap: COUNTS, seedKey: '/games/', now: FIXED_NOW });
    // apex-legends has iDashboard: all_2 → slot index 1
    assert.equal(out[1].slug, 'apex-legends');
  });

  it('uses iFilteredDashboard when filtering by that genre', () => {
    const list = [
      makeGame({ slug: 'a', genres: ['fps'], iFilteredDashboard: 'fps_1' }),
      makeGame({ slug: 'b', genres: ['fps'] }),
      makeGame({ slug: 'c', genres: ['fps'] }),
    ];
    const counts = new Map([['fps', 3]]);
    const out = selectDashboard6(list, {
      genreSlug: 'fps', countsMap: counts, seedKey: '/games/fps/', now: FIXED_NOW,
    });
    assert.equal(out[0].slug, 'a');
  });

  it('honours dashKey: bool pins when no slot pin available', () => {
    const list = [
      makeGame({ slug: 'a', genres: ['fps'], dashKey: true }),
      makeGame({ slug: 'b', genres: ['fps'] }),
    ];
    const counts = new Map([['fps', 2]]);
    const out = selectDashboard6(list, { countsMap: counts, seedKey: 'k', now: FIXED_NOW });
    assert.ok(out.some((g) => g.slug === 'a'));
  });
});

describe('selectDashboard6 — output bounds', () => {
  it('returns at most 6 games', () => {
    const out = selectDashboard6(SAMPLE, { countsMap: COUNTS, seedKey: '/games/', now: FIXED_NOW });
    assert.ok(out.length <= 6);
  });

  it('returns no duplicates', () => {
    const out = selectDashboard6(SAMPLE, { countsMap: COUNTS, seedKey: '/games/', now: FIXED_NOW });
    const slugs = out.map((g) => g.slug);
    assert.equal(new Set(slugs).size, slugs.length);
  });

  it('returns empty when list is empty', () => {
    assert.deepEqual(selectDashboard6([], { now: FIXED_NOW }), []);
  });

  it('respects genre filter — no off-genre games leak in', () => {
    const out = selectDashboard6(SAMPLE, {
      genreSlug: 'fps',
      countsMap: COUNTS,
      seedKey: '/games/fps/',
      now: FIXED_NOW,
    });
    for (const g of out) {
      assert.ok(g.genres.includes('fps'), `expected ${g.slug} to be in fps genre`);
    }
  });
});
