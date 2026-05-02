import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

function makeEntry({
  id,
  collection = 'reviews',
  category = 'mouse',
  hero = 'hero',
  title = `Title ${id}`,
  description = `Description ${id}`,
  datePublished = '2025-01-01T00:00:00Z',
  extraData = {},
} = {}) {
  return {
    id,
    _collection: collection,
    data: {
      title,
      description,
      category,
      hero,
      datePublished: new Date(datePublished),
      ...extraData,
    },
  };
}

function mapEntryToFeaturedItem(entry) {
  const heroName = entry.data.hero ?? '';
  return {
    id: entry.id,
    _compositeKey: `${entry._collection}:${entry.id}`,
    url: `/${entry._collection}/${entry.id}`,
    title: entry.data.title,
    description: entry.data.description,
    category: entry.data.category,
    categoryLabel: entry.data.category ? `${entry.data.category[0].toUpperCase()}${entry.data.category.slice(1)}` : '',
    heroPath: heroName ? `/images/${entry._collection}/${entry.id}/${heroName}` : '',
    srcset: heroName ? `/images/${entry._collection}/${entry.id}/${heroName}_s.webp 400w` : '',
    dateFormatted: 'Published | Jan 1, 2025',
    isPinned: false,
  };
}

describe('site-index page builder', () => {
  describe('buildSiteIndexStaticPaths()', () => {
    it('builds shared all/category pagination paths and activates only populated filters', async () => {
      const { buildSiteIndexStaticPaths } = await import('../page-builder.mjs');

      const entries = [
        makeEntry({ id: 'mouse-1', category: 'mouse' }),
        makeEntry({ id: 'mouse-2', category: 'mouse', datePublished: '2025-01-02T00:00:00Z' }),
        makeEntry({ id: 'mouse-3', category: 'mouse', datePublished: '2025-01-03T00:00:00Z' }),
        makeEntry({ id: 'keyboard-1', category: 'keyboard', datePublished: '2025-01-04T00:00:00Z' }),
        makeEntry({ id: 'no-hero', category: 'monitor', hero: '' }),
      ];

      const paths = buildSiteIndexStaticPaths({
        type: 'reviews',
        entries,
        categories: ['mouse', 'keyboard', 'monitor'],
        perPage: 2,
      });

      assert.deepEqual(
        paths.map((path) => path.params.slug),
        [undefined, 'page/2', 'page/3', 'mouse', 'mouse/page/2', 'keyboard', 'monitor']
      );

      const allPath = paths.find((path) => path.params.slug === undefined);
      assert.deepEqual(
        allPath.props.filterCats.map((cat) => [cat.key, cat.active, cat.count, cat.url]),
        [
          ['mouse', false, 3, '/reviews/mouse/'],
          ['keyboard', false, 1, '/reviews/keyboard/'],
          ['monitor', false, 1, '/reviews/monitor/'],
        ]
      );
      assert.equal(allPath.props.allCount, 5);

      const mousePath = paths.find((path) => path.params.slug === 'mouse');
      assert.deepEqual(
        mousePath.props.filterCats.map((cat) => [cat.key, cat.active]),
        [
          ['mouse', true],
          ['keyboard', false],
          ['monitor', false],
        ]
      );
      assert.equal(mousePath.props.category, 'mouse');
      assert.equal(mousePath.props.page, 1);
      assert.equal(mousePath.props.totalPages, 2);
      assert.deepEqual(
        mousePath.props.allItems.map((entry) => entry.id),
        ['mouse-1', 'mouse-2', 'mouse-3']
      );
    });
  });

  describe('buildSiteIndexPageVm()', () => {
    it('builds the all-view reviews VM and removes dashboard items from the first feed page', async () => {
      const { buildSiteIndexPageVm } = await import('../page-builder.mjs');

      const entries = [
        makeEntry({ id: 'mouse-older', collection: 'news', category: 'mouse', datePublished: '2025-01-01T00:00:00Z' }),
        makeEntry({ id: 'keyboard-mid', collection: 'news', category: 'keyboard', datePublished: '2025-01-02T00:00:00Z' }),
        makeEntry({ id: 'monitor-newer', collection: 'news', category: 'monitor', datePublished: '2025-01-03T00:00:00Z' }),
        makeEntry({ id: 'mouse-newest', collection: 'news', category: 'mouse', datePublished: '2025-01-04T00:00:00Z' }),
      ];

      const vm = await buildSiteIndexPageVm({
        type: 'reviews',
        typeLabel: 'Reviews',
        headerDek: 'Header dek',
        siteUrl: 'https://eggear.com',
        perPage: 4,
        mapEntryToFeaturedItem,
        pageProps: {
          category: '',
          page: 1,
          totalPages: 1,
          allItems: entries,
          allCount: 4,
          filterCats: [
            { key: 'mouse', label: 'Mouse', url: '/reviews/mouse/', count: 2, active: false },
            { key: 'keyboard', label: 'Keyboard', url: '/reviews/keyboard/', count: 1, active: false },
            { key: 'monitor', label: 'Monitor', url: '/reviews/monitor/', count: 1, active: false },
          ],
        },
        pinnedSet: new Set(),
        indexHeroesForType: {},
      });

      assert.equal(vm.seo.title, 'Reviews - EG');
      assert.equal(vm.seo.description, 'Browse the latest reviews from EG Gear.');
      assert.equal(vm.seo.canonicalUrl, 'https://eggear.com/reviews/');
      assert.equal(vm.seo.structuredData.length, 2);
      assert.equal(vm.seo.structuredData[0]['@type'], 'BreadcrumbList');
      assert.equal(vm.seo.structuredData[0]['@id'], 'https://eggear.com/reviews/#breadcrumb');
      assert.deepEqual(
        vm.seo.structuredData[0].itemListElement.map((item) => ({
          position: item.position,
          name: item.name,
          item: item.item,
        })),
        [
          { position: 1, name: 'Home', item: 'https://eggear.com/' },
          { position: 2, name: 'Reviews', item: 'https://eggear.com/reviews/' },
        ]
      );
      assert.equal(vm.seo.structuredData[1]['@type'], 'CollectionPage');
      assert.equal(vm.seo.structuredData[1]['@id'], 'https://eggear.com/reviews/#collection-page');
      assert.equal(vm.seo.structuredData[1].url, 'https://eggear.com/reviews/');
      assert.equal(vm.seo.structuredData[1].name, 'Reviews - EG');
      assert.deepEqual(vm.seo.structuredData[1].isPartOf, {
        '@id': 'https://eggear.com/#website',
      });
      assert.deepEqual(vm.seo.structuredData[1].breadcrumb, {
        '@id': 'https://eggear.com/reviews/#breadcrumb',
      });

      assert.equal(vm.bleed.heading, 'Reviews');
      assert.deepEqual(
        vm.bleed.breadcrumbs,
        [
          { label: 'Home', href: '/' },
          { label: 'Reviews', href: undefined },
        ]
      );
      assert.deepEqual(
        vm.bleed.dashboardItems.map((item) => item.id),
        ['mouse-newest', 'monitor-newer', 'keyboard-mid']
      );

      assert.equal(vm.body.heading, 'All Reviews');
      assert.equal(vm.body.dashboardCount, 3);
      assert.equal(vm.body.categoryClass, undefined);
      assert.deepEqual(vm.body.pageItems.map((item) => item.id), ['mouse-older']);
      assert.equal(vm.body.pagination.baseUrl, '/reviews');
      assert.equal(vm.body.pagination.current, 1);
    });

    it('builds category/page SEO and breadcrumbs exactly like the current route files', async () => {
      const { buildSiteIndexPageVm } = await import('../page-builder.mjs');

      const entries = [
        makeEntry({ id: 'mouse-1', category: 'mouse', datePublished: '2025-01-01T00:00:00Z' }),
        makeEntry({ id: 'mouse-2', category: 'mouse', datePublished: '2025-01-02T00:00:00Z' }),
        makeEntry({ id: 'mouse-3', category: 'mouse', datePublished: '2025-01-03T00:00:00Z' }),
        makeEntry({ id: 'mouse-4', category: 'mouse', datePublished: '2025-01-04T00:00:00Z' }),
        makeEntry({ id: 'mouse-5', category: 'mouse', datePublished: '2025-01-05T00:00:00Z' }),
      ];

      const vm = await buildSiteIndexPageVm({
        type: 'guides',
        typeLabel: 'Guides',
        headerDek: 'Guides dek',
        siteUrl: 'https://eggear.com',
        perPage: 3,
        mapEntryToFeaturedItem,
        pageProps: {
          category: 'mouse',
          page: 2,
          totalPages: 2,
          allItems: entries,
          allCount: 5,
          filterCats: [
            { key: 'mouse', label: 'Mouse', url: '/guides/mouse/', count: 5, active: true },
          ],
        },
        pinnedSet: new Set(),
        indexHeroesForType: {},
      });

      assert.equal(vm.seo.title, 'Mouse Guides - EG');
      assert.equal(vm.seo.description, 'Browse the latest guides in mouse from EG Gear.');
      assert.equal(vm.seo.canonicalUrl, 'https://eggear.com/guides/mouse/page/2/');
      assert.equal(vm.seo.structuredData.length, 2);
      assert.equal(vm.seo.structuredData[0]['@type'], 'BreadcrumbList');
      assert.deepEqual(
        vm.seo.structuredData[0].itemListElement.map((item) => ({
          position: item.position,
          name: item.name,
          item: item.item,
        })),
        [
          { position: 1, name: 'Home', item: 'https://eggear.com/' },
          { position: 2, name: 'Guides', item: 'https://eggear.com/guides/' },
          { position: 3, name: 'Mouse', item: 'https://eggear.com/guides/mouse/' },
          { position: 4, name: 'Page 2', item: 'https://eggear.com/guides/mouse/page/2/' },
        ]
      );
      assert.equal(vm.seo.structuredData[1]['@type'], 'CollectionPage');
      assert.equal(vm.seo.structuredData[1]['@id'], 'https://eggear.com/guides/mouse/page/2/#collection-page');
      assert.equal(vm.seo.structuredData[1].url, 'https://eggear.com/guides/mouse/page/2/');
      assert.equal(vm.seo.structuredData[1].name, 'Mouse Guides - EG');
      assert.deepEqual(vm.seo.structuredData[1].breadcrumb, {
        '@id': 'https://eggear.com/guides/mouse/page/2/#breadcrumb',
      });

      assert.equal(vm.bleed.heading, 'Mouse Guides');
      assert.deepEqual(
        vm.bleed.breadcrumbs,
        [
          { label: 'Home', href: '/' },
          { label: 'Guides', href: '/guides/' },
          { label: 'Mouse', href: '/guides/mouse/' },
          { label: 'Page 2' },
        ]
      );

      assert.equal(vm.body.heading, 'Mouse Guides');
      assert.equal(vm.body.dashboardCount, 0);
      assert.equal(vm.body.categoryClass, 'mouse-color');
      assert.equal(vm.body.pagination.current, 2);
      assert.equal(vm.body.pagination.prevUrl, '/guides/mouse/');
      assert.equal(vm.body.pagination.nextUrl, '');
      assert.deepEqual(
        vm.body.pageItems.map((item) => item.id),
        ['mouse-2', 'mouse-1']
      );
    });

    it('uses index hero overrides before the shared dashboard algorithm', async () => {
      const { buildSiteIndexPageVm } = await import('../page-builder.mjs');

      const entries = [
        makeEntry({ id: 'mouse-older', collection: 'news', category: 'mouse', datePublished: '2025-01-01T00:00:00Z' }),
        makeEntry({ id: 'keyboard-mid', collection: 'news', category: 'keyboard', datePublished: '2025-01-02T00:00:00Z' }),
        makeEntry({ id: 'monitor-newer', collection: 'news', category: 'monitor', datePublished: '2025-01-03T00:00:00Z' }),
        makeEntry({ id: 'mouse-newest', collection: 'news', category: 'mouse', datePublished: '2025-01-04T00:00:00Z' }),
      ];

      const vm = await buildSiteIndexPageVm({
        type: 'news',
        typeLabel: 'News',
        headerDek: 'News dek',
        siteUrl: 'https://eggear.com',
        perPage: 4,
        mapEntryToFeaturedItem,
        pageProps: {
          category: '',
          page: 1,
          totalPages: 1,
          allItems: entries,
          allCount: 4,
          filterCats: [
            { key: 'mouse', label: 'Mouse', url: '/news/mouse/', count: 2, active: false },
            { key: 'keyboard', label: 'Keyboard', url: '/news/keyboard/', count: 1, active: false },
            { key: 'monitor', label: 'Monitor', url: '/news/monitor/', count: 1, active: false },
          ],
        },
        pinnedSet: new Set(),
        indexHeroesForType: {
          _all: ['news:keyboard-mid', 'news:mouse-newest'],
        },
      });

      assert.deepEqual(
        vm.bleed.dashboardItems.map((item) => item.id),
        ['keyboard-mid', 'mouse-newest', 'monitor-newer']
      );
    });

    it('keeps hero-less articles in the feed while preferring hero-backed dashboard picks', async () => {
      const { buildSiteIndexPageVm } = await import('../page-builder.mjs');

      const entries = [
        makeEntry({ id: 'mouse-older', collection: 'news', category: 'mouse', datePublished: '2025-01-01T00:00:00Z', hero: 'hero' }),
        makeEntry({ id: 'keyboard-mid', collection: 'news', category: 'keyboard', datePublished: '2025-01-02T00:00:00Z', hero: 'hero' }),
        makeEntry({ id: 'monitor-mid', collection: 'news', category: 'monitor', datePublished: '2025-01-03T00:00:00Z', hero: 'hero' }),
        makeEntry({ id: 'nohero-newest', collection: 'news', category: 'mouse', datePublished: '2025-01-04T00:00:00Z', hero: '' }),
      ];

      const vm = await buildSiteIndexPageVm({
        type: 'news',
        typeLabel: 'News',
        headerDek: 'News dek',
        siteUrl: 'https://eggear.com',
        perPage: 4,
        mapEntryToFeaturedItem,
        pageProps: {
          category: '',
          page: 1,
          totalPages: 1,
          allItems: entries,
          allCount: 4,
          filterCats: [
            { key: 'mouse', label: 'Mouse', url: '/news/mouse/', count: 2, active: false },
            { key: 'keyboard', label: 'Keyboard', url: '/news/keyboard/', count: 1, active: false },
            { key: 'monitor', label: 'Monitor', url: '/news/monitor/', count: 1, active: false },
          ],
        },
        pinnedSet: new Set(),
        indexHeroesForType: {},
      });

      assert.deepEqual(
        vm.bleed.dashboardItems.map((item) => item.id),
        ['monitor-mid', 'keyboard-mid', 'mouse-older']
      );
      assert.deepEqual(vm.body.pageItems.map((item) => item.id), ['nohero-newest']);
      assert.equal(vm.body.pageItems[0].heroPath, '');
    });

  });

  describe('enrichReviewItemsWithScores()', () => {
    it('copies matching product overall scores onto review items', async () => {
      const { enrichReviewItemsWithScores } = await import('../page-builder.mjs');

      const entries = [
        makeEntry({
          id: 'razer-viper-v3-pro-review',
          category: 'mouse',
          extraData: { productId: 'mouse/razer/viper-v3-pro' },
        }),
        makeEntry({
          id: 'logitech-g-pro-x-review',
          category: 'mouse',
          extraData: { productId: 'mouse/logitech/g-pro-x' },
        }),
      ];

      const items = [
        {
          id: 'razer-viper-v3-pro-review',
          _compositeKey: 'reviews:razer-viper-v3-pro-review',
          url: '/reviews/razer-viper-v3-pro-review',
          title: 'Razer review',
          description: 'Desc',
          category: 'mouse',
          categoryLabel: 'Mouse',
          heroPath: '/img/razer',
          srcset: '/img/razer_s.webp 400w',
          dateFormatted: 'Published | Jan 1, 2025',
          isPinned: false,
        },
        {
          id: 'logitech-g-pro-x-review',
          _compositeKey: 'reviews:logitech-g-pro-x-review',
          url: '/reviews/logitech-g-pro-x-review',
          title: 'Logitech review',
          description: 'Desc',
          category: 'mouse',
          categoryLabel: 'Mouse',
          heroPath: '/img/logitech',
          srcset: '/img/logitech_s.webp 400w',
          dateFormatted: 'Published | Jan 1, 2025',
          isPinned: false,
        },
      ];

      const enriched = enrichReviewItemsWithScores({
        items,
        entries,
        products: [
          { id: 'mouse/razer/viper-v3-pro', data: { overall: 94 } },
          { id: 'mouse/logitech/g-pro-x', data: { overall: 0 } },
          { id: 'mouse/corsair/m75', data: { overall: 88 } },
        ],
      });

      assert.equal(enriched[0].overall, 94);
      assert.equal(enriched[1].overall, undefined);
    });
  });
});
