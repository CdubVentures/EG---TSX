import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  packAndFilterGames,
  buildGamesStaticPaths,
  buildGamesPageVm,
} from '../games-page-builder.mjs';

const FIXED_NOW = new Date(Date.UTC(2026, 4, 2, 12, 0, 0));

function makeEntry(id, overrides = {}) {
  return {
    id,
    data: {
      title: overrides.title || id,
      game: overrides.title || id,
      genre: overrides.genre,
      hero: 'box-art-cover',
      iDashboard: overrides.iDashboard,
      publish: overrides.publish !== false,
    },
  };
}

const ENTRIES = [
  makeEntry('apex-legends', { genre: 'battle royale games', iDashboard: 'all_2', title: 'Apex Legends' }),
  makeEntry('fortnite', { genre: 'battle royale games', title: 'Fortnite' }),
  makeEntry('valorant', { genre: 'fps, tactical shooter', title: 'Valorant' }),
  makeEntry('counter-strike-2', { genre: 'fps, tactical shooter', title: 'Counter-Strike 2' }),
  makeEntry('overwatch-2', { genre: 'hero shooter', title: 'Overwatch 2' }),
  makeEntry('dota-2', { genre: 'moba', title: 'Dota 2' }),
  makeEntry('hidden', { publish: false, genre: 'fps', title: 'Hidden Game' }),
];

describe('packAndFilterGames', () => {
  it('drops unpublished games', () => {
    const out = packAndFilterGames(ENTRIES);
    assert.ok(!out.some((g) => g.slug === 'hidden'));
    assert.equal(out.length, 6);
  });
});

describe('buildGamesStaticPaths', () => {
  it('emits one path for /games/ + one per genre with games', () => {
    const paths = buildGamesStaticPaths({ entries: ENTRIES, perPage: 24 });
    const slugs = paths.map((p) => p.params.slug);
    assert.ok(slugs.includes(undefined), 'expected /games/ path');
    assert.ok(slugs.includes('battle-royale-games'));
    assert.ok(slugs.includes('fps'));
    assert.ok(slugs.includes('tactical-shooter'));
    assert.ok(slugs.includes('hero-shooter'));
    assert.ok(slugs.includes('moba'));
  });

  it('does not emit a misc bucket when every game has a genre', () => {
    const paths = buildGamesStaticPaths({ entries: ENTRIES, perPage: 24 });
    const slugs = paths.map((p) => p.params.slug);
    assert.ok(!slugs.includes('misc'));
  });

  it('paginates buckets larger than perPage', () => {
    const many = Array.from({ length: 30 }, (_, i) =>
      makeEntry(`g${i}`, { genre: 'fps', title: `Game ${i}` }),
    );
    const paths = buildGamesStaticPaths({ entries: many, perPage: 12 });
    const fpsPaths = paths.filter((p) => p.params.slug?.startsWith('fps'));
    // 30 / 12 = 3 pages → 'fps' (page 1), 'fps/page/2', 'fps/page/3'
    assert.equal(fpsPaths.length, 3);
  });

  it('marks the active filter pill correctly', () => {
    const paths = buildGamesStaticPaths({ entries: ENTRIES, perPage: 24 });
    const fpsPath = paths.find((p) => p.params.slug === 'fps');
    const fpsPill = fpsPath.props.filterGenres.find((f) => f.key === 'fps');
    assert.equal(fpsPill.active, true);
    const otherPill = fpsPath.props.filterGenres.find((f) => f.key === 'moba');
    assert.equal(otherPill.active, false);
  });
});

describe('buildGamesPageVm', () => {
  const paths = buildGamesStaticPaths({ entries: ENTRIES, perPage: 24 });
  const allGamesPath = paths.find((p) => p.params.slug === undefined);

  it('builds SEO + bleed + body sections', () => {
    const vm = buildGamesPageVm({
      typeLabel: 'Games',
      headerDek: 'Browse games.',
      siteUrl: 'https://eggear.com',
      perPage: 24,
      pageProps: allGamesPath.props,
      now: FIXED_NOW,
    });
    assert.equal(vm.seo.title, 'Games - EG');
    assert.equal(vm.seo.canonicalUrl, 'https://eggear.com/games/');
    assert.equal(vm.bleed.heading, 'Games');
    assert.equal(vm.bleed.type, 'games');
    assert.equal(vm.body.heading, 'All Games');
    assert.ok(vm.bleed.dashboardItems.length > 0);
  });

  it('uses genre title in heading + canonical URL when filtered', () => {
    const fpsPath = paths.find((p) => p.params.slug === 'fps');
    const vm = buildGamesPageVm({
      typeLabel: 'Games',
      headerDek: 'Browse games.',
      siteUrl: 'https://eggear.com',
      perPage: 24,
      pageProps: fpsPath.props,
      now: FIXED_NOW,
    });
    assert.equal(vm.bleed.heading, 'Fps Games');
    assert.equal(vm.body.heading, 'Fps Games');
    assert.equal(vm.seo.canonicalUrl, 'https://eggear.com/games/fps/');
    assert.equal(vm.seo.title, 'Games • Fps - EG');
    assert.equal(vm.bleed.category, 'fps');
    // dashboard should only contain fps games
    for (const g of vm.bleed.dashboardItems) {
      assert.ok(g.genres.includes('fps'));
    }
  });

  it('breadcrumbs include Home, Games, and active genre', () => {
    const fpsPath = paths.find((p) => p.params.slug === 'fps');
    const vm = buildGamesPageVm({
      typeLabel: 'Games',
      headerDek: '',
      siteUrl: 'https://eggear.com',
      perPage: 24,
      pageProps: fpsPath.props,
      now: FIXED_NOW,
    });
    assert.equal(vm.bleed.breadcrumbs.length, 3);
    assert.equal(vm.bleed.breadcrumbs[0].label, 'Home');
    assert.equal(vm.bleed.breadcrumbs[1].label, 'Games');
    assert.equal(vm.bleed.breadcrumbs[2].label, 'Fps');
  });

  it('emits CollectionPage + BreadcrumbList structured data', () => {
    const vm = buildGamesPageVm({
      typeLabel: 'Games',
      headerDek: '',
      siteUrl: 'https://eggear.com',
      perPage: 24,
      pageProps: allGamesPath.props,
      now: FIXED_NOW,
    });
    const types = vm.seo.structuredData.map((d) => d['@type']);
    assert.ok(types.includes('BreadcrumbList'));
    assert.ok(types.includes('CollectionPage'));
    const collection = vm.seo.structuredData.find((d) => d['@type'] === 'CollectionPage');
    assert.equal(collection.mainEntity['@type'], 'ItemList');
    assert.ok(collection.mainEntity.itemListElement.length > 0);
    assert.equal(collection.mainEntity.itemListElement[0].item['@type'], 'VideoGame');
  });

  it('removes dashboard games from page items on page 1', () => {
    const vm = buildGamesPageVm({
      typeLabel: 'Games',
      headerDek: '',
      siteUrl: 'https://eggear.com',
      perPage: 24,
      pageProps: allGamesPath.props,
      now: FIXED_NOW,
    });
    const dashSlugs = new Set(vm.bleed.dashboardItems.map((g) => g.slug));
    for (const item of vm.body.pageItems) {
      assert.ok(!dashSlugs.has(item.slug), `${item.slug} should not appear in body if in dashboard`);
    }
  });
});
