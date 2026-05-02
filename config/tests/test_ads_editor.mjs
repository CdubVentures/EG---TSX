/**
 * test_ads_editor.mjs — Tests for Ads panel pure editor functions.
 * TDD RED phase: all tests written before implementation.
 * Runner: node --test config/tests/test_ads_editor.mjs
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  // Registry
  setGlobalField,
  setPositionField,
  addPosition,
  deletePosition,
  duplicatePosition,
  parseSizes,
  filterPositions,
  // Inline
  setInlineCollectionField,
  setInlineDefaultsField,
  calculateInlineAds,
  // Sponsors
  addCreative,
  deleteCreative,
  setCreativeField,
  normalizeWeights,
  getCreativeStatus,
} from '../ui/ads-editor.mjs';

// ── Factories ───────────────────────────────────────────────────────────

function makeRegistry(overrides = {}) {
  return {
    global: {
      adsenseClient: 'ca-pub-5013419984370459',
      adLabel: 'Ad',
      showProductionPlaceholders: true,
      loadSampleAds: true,
      sampleAdMode: 'mixed',
      sampleAdNetwork: 'mixed',
    },
    positions: {
      sidebar: {
        provider: 'adsense',
        adSlot: '6560707323',
        sizes: '300x400,300x250',
        display: true,
        notes: 'Standard sidebar',
      },
      in_content: {
        provider: 'adsense',
        adSlot: '1051669276',
        sizes: '970x250,728x90',
        display: true,
        placementType: 'inline',
        notes: 'Inline content',
      },
    },
    ...overrides,
  };
}

function makeInline(overrides = {}) {
  return {
    defaults: { position: 'in_content' },
    collections: {
      reviews: {
        enabled: true,
        desktop: { firstAfter: 3, every: 5, max: 8 },
        mobile: { firstAfter: 3, every: 4, max: 10 },
        wordScaling: {
          enabled: true,
          desktopWordsPerAd: 450,
          mobileWordsPerAd: 350,
          minFirstAdWords: 150,
        },
      },
      games: { enabled: false },
    },
    ...overrides,
  };
}

function makeSponsors(overrides = {}) {
  return {
    creatives: {
      sidebar: [
        {
          label: 'Razer Spring',
          img: '/images/ads/razer.webp',
          href: 'https://razer.com',
          width: 300,
          height: 400,
          weight: 50,
          startDate: '2026-01-01',
          endDate: '2026-06-30',
          rel: 'nofollow sponsored noopener',
          alt: 'Razer gear',
        },
        {
          label: 'SteelSeries',
          img: '/images/ads/steel.webp',
          href: 'https://steelseries.com',
          width: 300,
          height: 400,
          weight: 50,
          startDate: '2026-03-01',
          endDate: '2026-09-30',
          rel: 'nofollow sponsored noopener',
          alt: 'SteelSeries',
        },
      ],
    },
    ...overrides,
  };
}

// ── setGlobalField ──────────────────────────────────────────────────────

describe('setGlobalField', () => {
  it('sets a string field', () => {
    const registry = makeRegistry();
    const result = setGlobalField(registry, 'adLabel', 'Advertisement');
    assert.equal(result.global.adLabel, 'Advertisement');
  });

  it('sets a boolean field', () => {
    const registry = makeRegistry();
    const result = setGlobalField(registry, 'loadSampleAds', false);
    assert.equal(result.global.loadSampleAds, false);
  });

  it('does not mutate the original', () => {
    const registry = makeRegistry();
    setGlobalField(registry, 'adLabel', 'Changed');
    assert.equal(registry.global.adLabel, 'Ad');
  });

  it('preserves other global fields', () => {
    const registry = makeRegistry();
    const result = setGlobalField(registry, 'adLabel', 'New');
    assert.equal(result.global.adsenseClient, 'ca-pub-5013419984370459');
  });

  it('preserves positions', () => {
    const registry = makeRegistry();
    const result = setGlobalField(registry, 'adLabel', 'New');
    assert.equal(result.positions.sidebar.provider, 'adsense');
  });
});

// ── setPositionField ────────────────────────────────────────────────────

describe('setPositionField', () => {
  it('sets provider on a position', () => {
    const registry = makeRegistry();
    const result = setPositionField(registry, 'sidebar', 'provider', 'direct');
    assert.equal(result.positions.sidebar.provider, 'direct');
  });

  it('sets display on a position', () => {
    const registry = makeRegistry();
    const result = setPositionField(registry, 'sidebar', 'display', false);
    assert.equal(result.positions.sidebar.display, false);
  });

  it('sets adSlot on a position', () => {
    const registry = makeRegistry();
    const result = setPositionField(registry, 'sidebar', 'adSlot', '9999');
    assert.equal(result.positions.sidebar.adSlot, '9999');
  });

  it('does not mutate the original', () => {
    const registry = makeRegistry();
    setPositionField(registry, 'sidebar', 'provider', 'direct');
    assert.equal(registry.positions.sidebar.provider, 'adsense');
  });

  it('preserves other positions', () => {
    const registry = makeRegistry();
    const result = setPositionField(registry, 'sidebar', 'provider', 'direct');
    assert.equal(result.positions.in_content.provider, 'adsense');
  });

  it('preserves other fields on the same position', () => {
    const registry = makeRegistry();
    const result = setPositionField(registry, 'sidebar', 'provider', 'direct');
    assert.equal(result.positions.sidebar.adSlot, '6560707323');
  });
});

// ── addPosition ─────────────────────────────────────────────────────────

describe('addPosition', () => {
  it('adds a new position with defaults', () => {
    const registry = makeRegistry();
    const result = addPosition(registry, 'new_unit', 'adsense');
    assert.ok(result !== null);
    assert.ok('new_unit' in result.positions);
    assert.equal(result.positions.new_unit.provider, 'adsense');
    assert.equal(result.positions.new_unit.display, true);
  });

  it('validates name pattern — rejects uppercase', () => {
    const registry = makeRegistry();
    const result = addPosition(registry, 'BadName', 'adsense');
    assert.equal(result, null);
  });

  it('validates name pattern — rejects spaces', () => {
    const registry = makeRegistry();
    const result = addPosition(registry, 'bad name', 'adsense');
    assert.equal(result, null);
  });

  it('validates name pattern — rejects empty', () => {
    const registry = makeRegistry();
    const result = addPosition(registry, '', 'adsense');
    assert.equal(result, null);
  });

  it('validates name pattern — rejects leading underscore', () => {
    const registry = makeRegistry();
    const result = addPosition(registry, '_bad', 'adsense');
    assert.equal(result, null);
  });

  it('accepts valid names with hyphens and underscores', () => {
    const registry = makeRegistry();
    const result = addPosition(registry, 'hero-top_bar', 'direct');
    assert.ok(result !== null);
    assert.equal(result.positions['hero-top_bar'].provider, 'direct');
  });

  it('rejects duplicate names', () => {
    const registry = makeRegistry();
    const result = addPosition(registry, 'sidebar', 'adsense');
    assert.equal(result, null);
  });

  it('does not mutate the original', () => {
    const registry = makeRegistry();
    addPosition(registry, 'new_one', 'adsense');
    assert.ok(!('new_one' in registry.positions));
  });
});

// ── deletePosition ──────────────────────────────────────────────────────

describe('deletePosition', () => {
  it('removes a position by name', () => {
    const registry = makeRegistry();
    const result = deletePosition(registry, 'sidebar');
    assert.ok(!('sidebar' in result.positions));
  });

  it('no-op when only 1 position remains', () => {
    const registry = makeRegistry({
      positions: {
        only_one: { provider: 'adsense', adSlot: '123', sizes: '', display: true, notes: '' },
      },
    });
    const result = deletePosition(registry, 'only_one');
    assert.ok('only_one' in result.positions);
  });

  it('does not mutate the original', () => {
    const registry = makeRegistry();
    deletePosition(registry, 'sidebar');
    assert.ok('sidebar' in registry.positions);
  });

  it('preserves other positions', () => {
    const registry = makeRegistry();
    const result = deletePosition(registry, 'sidebar');
    assert.ok('in_content' in result.positions);
  });
});

// ── duplicatePosition ───────────────────────────────────────────────────

describe('duplicatePosition', () => {
  it('copies fields to new name', () => {
    const registry = makeRegistry();
    const result = duplicatePosition(registry, 'sidebar', 'sidebar_copy');
    assert.ok(result !== null);
    assert.equal(result.positions.sidebar_copy.provider, 'adsense');
    assert.equal(result.positions.sidebar_copy.adSlot, '6560707323');
  });

  it('preserves the original position', () => {
    const registry = makeRegistry();
    const result = duplicatePosition(registry, 'sidebar', 'sidebar_copy');
    assert.ok(result !== null);
    assert.ok('sidebar' in result.positions);
  });

  it('returns null if source does not exist', () => {
    const registry = makeRegistry();
    const result = duplicatePosition(registry, 'nonexistent', 'new_copy');
    assert.equal(result, null);
  });

  it('returns null if new name is invalid', () => {
    const registry = makeRegistry();
    const result = duplicatePosition(registry, 'sidebar', 'Bad Name');
    assert.equal(result, null);
  });

  it('returns null if new name already exists', () => {
    const registry = makeRegistry();
    const result = duplicatePosition(registry, 'sidebar', 'in_content');
    assert.equal(result, null);
  });

  it('does not mutate the original', () => {
    const registry = makeRegistry();
    duplicatePosition(registry, 'sidebar', 'sidebar_copy');
    assert.ok(!('sidebar_copy' in registry.positions));
  });
});

// ── parseSizes ──────────────────────────────────────────────────────────

describe('parseSizes', () => {
  it('parses valid sizes', () => {
    const result = parseSizes('300x400,728x90');
    assert.deepStrictEqual(result, [
      { width: 300, height: 400 },
      { width: 728, height: 90 },
    ]);
  });

  it('trims whitespace', () => {
    const result = parseSizes(' 300x400 , 728x90 ');
    assert.deepStrictEqual(result, [
      { width: 300, height: 400 },
      { width: 728, height: 90 },
    ]);
  });

  it('skips invalid entries', () => {
    const result = parseSizes('300x400,bad,728x90');
    assert.deepStrictEqual(result, [
      { width: 300, height: 400 },
      { width: 728, height: 90 },
    ]);
  });

  it('returns empty array for empty string', () => {
    assert.deepStrictEqual(parseSizes(''), []);
  });

  it('returns empty array for all-invalid', () => {
    assert.deepStrictEqual(parseSizes('abc,def'), []);
  });

  it('handles single valid size', () => {
    assert.deepStrictEqual(parseSizes('300x250'), [{ width: 300, height: 250 }]);
  });
});

// ── filterPositions ─────────────────────────────────────────────────────

describe('filterPositions', () => {
  it('returns all names when query is empty', () => {
    const names = ['sidebar', 'in_content', 'hero'];
    assert.deepStrictEqual(filterPositions(names, ''), ['sidebar', 'in_content', 'hero']);
  });

  it('filters by case-insensitive substring', () => {
    const names = ['sidebar', 'sidebar_sticky', 'in_content', 'hero_leaderboard'];
    assert.deepStrictEqual(filterPositions(names, 'side'), ['sidebar', 'sidebar_sticky']);
  });

  it('case insensitive match', () => {
    const names = ['sidebar', 'SIDEBAR_STICKY'];
    assert.deepStrictEqual(filterPositions(names, 'SIDE'), ['sidebar', 'SIDEBAR_STICKY']);
  });

  it('returns empty array when no match', () => {
    const names = ['sidebar', 'in_content'];
    assert.deepStrictEqual(filterPositions(names, 'xyz'), []);
  });
});

// ── setInlineCollectionField ────────────────────────────────────────────

describe('setInlineCollectionField', () => {
  it('sets a top-level collection field (enabled)', () => {
    const inline = makeInline();
    const result = setInlineCollectionField(inline, 'reviews', 'enabled', false);
    assert.equal(result.collections.reviews.enabled, false);
  });

  it('sets a nested desktop field', () => {
    const inline = makeInline();
    const result = setInlineCollectionField(inline, 'reviews', 'desktop.firstAfter', 5);
    assert.equal(result.collections.reviews.desktop.firstAfter, 5);
  });

  it('sets a nested mobile field', () => {
    const inline = makeInline();
    const result = setInlineCollectionField(inline, 'reviews', 'mobile.max', 15);
    assert.equal(result.collections.reviews.mobile.max, 15);
  });

  it('sets a nested wordScaling field', () => {
    const inline = makeInline();
    const result = setInlineCollectionField(inline, 'reviews', 'wordScaling.enabled', false);
    assert.equal(result.collections.reviews.wordScaling.enabled, false);
  });

  it('does not mutate the original', () => {
    const inline = makeInline();
    setInlineCollectionField(inline, 'reviews', 'enabled', false);
    assert.equal(inline.collections.reviews.enabled, true);
  });

  it('preserves other collections', () => {
    const inline = makeInline();
    const result = setInlineCollectionField(inline, 'reviews', 'enabled', false);
    assert.equal(result.collections.games.enabled, false);
  });

  it('initializes desktop defaults when enabling a collection without cadence data', () => {
    const inline = makeInline();
    // games only has { enabled: false } — no desktop/mobile/wordScaling
    const result = setInlineCollectionField(inline, 'games', 'enabled', true);
    assert.equal(result.collections.games.enabled, true);
    assert.deepStrictEqual(result.collections.games.desktop, { firstAfter: 3, every: 5, max: 8 });
  });

  it('initializes mobile defaults when enabling a collection without cadence data', () => {
    const inline = makeInline();
    const result = setInlineCollectionField(inline, 'games', 'enabled', true);
    assert.deepStrictEqual(result.collections.games.mobile, { firstAfter: 3, every: 4, max: 10 });
  });

  it('initializes wordScaling defaults when enabling a collection without cadence data', () => {
    const inline = makeInline();
    const result = setInlineCollectionField(inline, 'games', 'enabled', true);
    assert.deepStrictEqual(result.collections.games.wordScaling, {
      enabled: false,
      desktopWordsPerAd: 450,
      mobileWordsPerAd: 350,
      minFirstAdWords: 150,
    });
  });

  it('does not overwrite existing cadence data when re-enabling', () => {
    const inline = makeInline();
    // reviews already has cadence data — re-enabling should not reset it
    const disabled = setInlineCollectionField(inline, 'reviews', 'enabled', false);
    const reEnabled = setInlineCollectionField(disabled, 'reviews', 'enabled', true);
    assert.deepStrictEqual(reEnabled.collections.reviews.desktop, { firstAfter: 3, every: 5, max: 8 });
    assert.deepStrictEqual(reEnabled.collections.reviews.wordScaling.desktopWordsPerAd, 450);
  });

  it('does not initialize defaults when setting enabled to false', () => {
    const inline = makeInline();
    const result = setInlineCollectionField(inline, 'games', 'enabled', false);
    assert.equal(result.collections.games.desktop, undefined);
    assert.equal(result.collections.games.mobile, undefined);
  });
});

// ── setInlineDefaultsField ──────────────────────────────────────────────

describe('setInlineDefaultsField', () => {
  it('sets the position default', () => {
    const inline = makeInline();
    const result = setInlineDefaultsField(inline, 'position', 'sidebar');
    assert.equal(result.defaults.position, 'sidebar');
  });

  it('does not mutate the original', () => {
    const inline = makeInline();
    setInlineDefaultsField(inline, 'position', 'sidebar');
    assert.equal(inline.defaults.position, 'in_content');
  });
});

// ── calculateInlineAds ──────────────────────────────────────────────────

describe('calculateInlineAds', () => {
  it('word-scaling mode: 2000 words with reviews config', () => {
    const cfg = makeInline().collections.reviews;
    const result = calculateInlineAds(2000, cfg);
    // 2000 / 450 = 4.44 → 4 desktop, 2000 / 350 = 5.71 → 5 mobile
    assert.equal(result.desktop, 4);
    assert.equal(result.mobile, 5);
  });

  it('word-scaling mode: caps at max', () => {
    const cfg = makeInline().collections.reviews;
    const result = calculateInlineAds(100000, cfg);
    assert.equal(result.desktop, 8);   // max 8
    assert.equal(result.mobile, 10);   // max 10
  });

  it('word-scaling mode: zero words', () => {
    const cfg = makeInline().collections.reviews;
    const result = calculateInlineAds(0, cfg);
    assert.equal(result.desktop, 0);
    assert.equal(result.mobile, 0);
  });

  it('paragraph fallback when word-scaling disabled', () => {
    const cfg = {
      enabled: true,
      desktop: { firstAfter: 3, every: 5, max: 8 },
      mobile: { firstAfter: 3, every: 4, max: 10 },
      wordScaling: { enabled: false, desktopWordsPerAd: 450, mobileWordsPerAd: 350, minFirstAdWords: 150 },
    };
    // 2000 words → paras = max(1, 2000/100) = 20
    // desktop: paras(20) > first(3), 1 + (20-3-1)//5 = 1+3 = 4
    // mobile: paras(20) > first(3), 1 + (20-3-1)//4 = 1+4 = 5
    const result = calculateInlineAds(2000, cfg);
    assert.equal(result.desktop, 4);
    assert.equal(result.mobile, 5);
  });

  it('paragraph fallback: below firstAfter threshold', () => {
    const cfg = {
      enabled: true,
      desktop: { firstAfter: 3, every: 5, max: 8 },
      mobile: { firstAfter: 3, every: 4, max: 10 },
      wordScaling: { enabled: false, desktopWordsPerAd: 0, mobileWordsPerAd: 0, minFirstAdWords: 0 },
    };
    // 200 words → paras = max(1, 200/100) = 2, not > 3 → 0 ads
    const result = calculateInlineAds(200, cfg);
    assert.equal(result.desktop, 0);
    assert.equal(result.mobile, 0);
  });

  it('disabled collection returns zero', () => {
    const cfg = { enabled: false };
    const result = calculateInlineAds(2000, cfg);
    assert.equal(result.desktop, 0);
    assert.equal(result.mobile, 0);
  });

  it('no wordScaling object uses paragraph fallback', () => {
    const cfg = {
      enabled: true,
      desktop: { firstAfter: 3, every: 5, max: 8 },
      mobile: { firstAfter: 3, every: 4, max: 10 },
    };
    const result = calculateInlineAds(2000, cfg);
    assert.equal(result.desktop, 4);
    assert.equal(result.mobile, 5);
  });
});

// ── addCreative ─────────────────────────────────────────────────────────

describe('addCreative', () => {
  it('appends a new creative with defaults', () => {
    const sponsors = makeSponsors();
    const result = addCreative(sponsors, 'sidebar');
    assert.equal(result.creatives.sidebar.length, 3);
    const last = result.creatives.sidebar[2];
    assert.equal(last.label, '');
    assert.equal(last.weight, 0);
  });

  it('creates position array if it does not exist', () => {
    const sponsors = makeSponsors();
    const result = addCreative(sponsors, 'hero');
    assert.equal(result.creatives.hero.length, 1);
  });

  it('does not mutate the original', () => {
    const sponsors = makeSponsors();
    addCreative(sponsors, 'sidebar');
    assert.equal(sponsors.creatives.sidebar.length, 2);
  });
});

// ── deleteCreative ──────────────────────────────────────────────────────

describe('deleteCreative', () => {
  it('removes a creative by index', () => {
    const sponsors = makeSponsors();
    const result = deleteCreative(sponsors, 'sidebar', 0);
    assert.equal(result.creatives.sidebar.length, 1);
    assert.equal(result.creatives.sidebar[0].label, 'SteelSeries');
  });

  it('does not mutate the original', () => {
    const sponsors = makeSponsors();
    deleteCreative(sponsors, 'sidebar', 0);
    assert.equal(sponsors.creatives.sidebar.length, 2);
  });

  it('returns unchanged if position does not exist', () => {
    const sponsors = makeSponsors();
    const result = deleteCreative(sponsors, 'nonexistent', 0);
    assert.deepStrictEqual(Object.keys(result.creatives), ['sidebar']);
  });
});

// ── setCreativeField ────────────────────────────────────────────────────

describe('setCreativeField', () => {
  it('sets label on a creative', () => {
    const sponsors = makeSponsors();
    const result = setCreativeField(sponsors, 'sidebar', 0, 'label', 'New Label');
    assert.equal(result.creatives.sidebar[0].label, 'New Label');
  });

  it('sets weight on a creative', () => {
    const sponsors = makeSponsors();
    const result = setCreativeField(sponsors, 'sidebar', 1, 'weight', 75);
    assert.equal(result.creatives.sidebar[1].weight, 75);
  });

  it('does not mutate the original', () => {
    const sponsors = makeSponsors();
    setCreativeField(sponsors, 'sidebar', 0, 'label', 'Changed');
    assert.equal(sponsors.creatives.sidebar[0].label, 'Razer Spring');
  });

  it('preserves other creatives', () => {
    const sponsors = makeSponsors();
    const result = setCreativeField(sponsors, 'sidebar', 0, 'label', 'Changed');
    assert.equal(result.creatives.sidebar[1].label, 'SteelSeries');
  });
});

// ── normalizeWeights ────────────────────────────────────────────────────

describe('normalizeWeights', () => {
  it('scales proportionally to 100', () => {
    const sponsors = makeSponsors();
    const result = normalizeWeights(sponsors, 'sidebar');
    const w0 = result.creatives.sidebar[0].weight;
    const w1 = result.creatives.sidebar[1].weight;
    assert.equal(w0 + w1, 100);
    assert.equal(w0, 50);
    assert.equal(w1, 50);
  });

  it('handles unequal weights', () => {
    const sponsors = makeSponsors();
    sponsors.creatives.sidebar[0] = { ...sponsors.creatives.sidebar[0], weight: 30 };
    sponsors.creatives.sidebar[1] = { ...sponsors.creatives.sidebar[1], weight: 70 };
    const result = normalizeWeights(sponsors, 'sidebar');
    assert.equal(result.creatives.sidebar[0].weight, 30);
    assert.equal(result.creatives.sidebar[1].weight, 70);
  });

  it('handles all-zero weights by distributing equally', () => {
    const sponsors = makeSponsors();
    sponsors.creatives.sidebar[0] = { ...sponsors.creatives.sidebar[0], weight: 0 };
    sponsors.creatives.sidebar[1] = { ...sponsors.creatives.sidebar[1], weight: 0 };
    const result = normalizeWeights(sponsors, 'sidebar');
    assert.equal(result.creatives.sidebar[0].weight, 50);
    assert.equal(result.creatives.sidebar[1].weight, 50);
  });

  it('handles single creative', () => {
    const sponsors = makeSponsors({
      creatives: {
        sidebar: [
          { label: 'Solo', img: '', href: '', width: 300, height: 400, weight: 42, startDate: '', endDate: '', rel: '', alt: '' },
        ],
      },
    });
    const result = normalizeWeights(sponsors, 'sidebar');
    assert.equal(result.creatives.sidebar[0].weight, 100);
  });

  it('returns unchanged for empty position', () => {
    const sponsors = makeSponsors({ creatives: { sidebar: [] } });
    const result = normalizeWeights(sponsors, 'sidebar');
    assert.deepStrictEqual(result.creatives.sidebar, []);
  });

  it('does not mutate the original', () => {
    const sponsors = makeSponsors();
    normalizeWeights(sponsors, 'sidebar');
    assert.equal(sponsors.creatives.sidebar[0].weight, 50);
  });
});

// ── getCreativeStatus ───────────────────────────────────────────────────

describe('getCreativeStatus', () => {
  it('returns "active" when today is within date range', () => {
    const creative = {
      startDate: '2020-01-01',
      endDate: '2099-12-31',
    };
    assert.equal(getCreativeStatus(creative), 'active');
  });

  it('returns "scheduled" when start date is in the future', () => {
    const creative = {
      startDate: '2099-01-01',
      endDate: '2099-12-31',
    };
    assert.equal(getCreativeStatus(creative), 'scheduled');
  });

  it('returns "expired" when end date is in the past', () => {
    const creative = {
      startDate: '2020-01-01',
      endDate: '2020-12-31',
    };
    assert.equal(getCreativeStatus(creative), 'expired');
  });

  it('returns "active" when dates are empty', () => {
    const creative = { startDate: '', endDate: '' };
    assert.equal(getCreativeStatus(creative), 'active');
  });

  it('returns "active" when only start date is in the past', () => {
    const creative = { startDate: '2020-01-01', endDate: '' };
    assert.equal(getCreativeStatus(creative), 'active');
  });
});
