import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

const ROOT = resolve(import.meta.dirname, '..');
const APP_SOURCE = readFileSync(join(ROOT, 'config', 'ui', 'app.tsx'), 'utf8');
const PANELS_SOURCE = readFileSync(join(ROOT, 'config', 'ui', 'panels.tsx'), 'utf8');
const SHARED_UI_SOURCE = readFileSync(join(ROOT, 'config', 'ui', 'shared-ui.tsx'), 'utf8');
const APP_STYLES = readFileSync(join(ROOT, 'config', 'ui', 'app.css'), 'utf8');

function makeContentPanelPayload() {
  return {
    summary: {
      totalArticles: 5,
      eligibleArticles: 5,
      disabledArticles: 0,
      slotCount: 15,
      manualCount: 2,
      pinnedCount: 1,
      badgedCount: 1,
      excludedCount: 0,
    },
    statusRight: '5 articles  Â·  5 eligible  Â·  0 disabled  Â·  15 slots',
    manualSlots: {
      '1': 'reviews:review-a',
      '5': 'guides:guide-a',
    },
    pinned: ['reviews:review-a'],
    badges: {
      'reviews:review-a': 'Top Pick',
    },
    excluded: [],
    dashboardSlots: Array.from({ length: 15 }, (_, index) => ({
      slotNumber: index + 1,
      rowIndex: index === 0 ? 0 : index < 4 ? 1 : index === 4 ? 2 : index < 8 ? 3 : index < 11 ? 4 : 5,
      columnStart: 0,
      columnSpan: index === 0 || index === 4 ? 12 : index >= 11 ? 3 : 4,
      rowWeight: index === 0 ? 3 : index === 4 ? 2 : index >= 11 ? 1.5 : 2,
      rowLabel: index === 0 ? 'Hero' : index === 4 ? 'Feature' : index === 11 ? 'Latest' : '',
      isManual: index === 0 || index === 4,
      manualKey: index === 0 ? 'reviews:review-a' : index === 4 ? 'guides:guide-a' : '',
      article:
        index === 0
          ? {
              key: 'reviews:review-a',
              collection: 'reviews',
              collectionLabel: 'Reviews',
              collectionColor: '#89b4fa',
              entryId: 'review-a',
              title: 'Review A',
              category: 'mouse',
              categoryLabel: 'Mouse',
              categoryColor: '#00aeff',
              datePublished: '2025-01-02',
              dateUpdated: '',
              sortDate: '2025-01-02',
              dateText: '01-02-25 p',
              hasHero: true,
              fullArticle: true,
              draft: false,
              categoryActive: true,
              isPinned: true,
              badge: 'Top Pick',
              isExcluded: false,
              isManualAssigned: true,
              feedLabels: ['Dash', 'Rev H'],
              feedPosition: 0,
            }
          : index === 4
            ? {
                key: 'guides:guide-a',
                collection: 'guides',
                collectionLabel: 'Guides',
                collectionColor: '#a6e3a1',
                entryId: 'guide-a',
                title: 'Guide A',
                category: 'mouse',
                categoryLabel: 'Mouse',
                categoryColor: '#00aeff',
                datePublished: '2025-01-03',
                dateUpdated: '',
                sortDate: '2025-01-03',
                dateText: '01-03-25 p',
                hasHero: true,
                fullArticle: true,
                draft: false,
                categoryActive: true,
                isPinned: false,
                badge: '',
                isExcluded: false,
                isManualAssigned: true,
                feedLabels: ['Dash', 'Guide H'],
                feedPosition: 4,
              }
            : null,
    })),
    articlePool: [
      {
        key: 'news:news-a',
        collection: 'news',
        collectionLabel: 'News',
        collectionColor: '#fab387',
        entryId: 'news-a',
        title: 'News A',
        category: 'mouse',
        categoryLabel: 'Mouse',
        categoryColor: '#00aeff',
        datePublished: '2025-01-04',
        dateUpdated: '',
        sortDate: '2025-01-04',
        dateText: '01-04-25 p',
        hasHero: true,
        fullArticle: true,
        draft: false,
        categoryActive: true,
        isPinned: false,
        badge: '',
        isExcluded: false,
        isManualAssigned: false,
        feedLabels: ['News F', 'News L'],
        feedPosition: 6,
      },
    ],
    tabs: {
      reviews: [],
      guides: [],
      news: [],
      brands: [],
      games: [],
    },
    version: 1,
  };
}

function makeCategoriesPanelPayload(categoryId = 'mouse') {
  return {
    siteColors: {
      primary: '#123456',
      secondary: '#654321',
      derivedColors: {
        accent: '#111111',
        hover: '#222222',
        'grad-start': '#333333',
        dark: '#444444',
        soft: '#555555',
      },
    },
    categories: [
      {
        id: categoryId,
        label: categoryId.toUpperCase(),
        plural: `${categoryId.toUpperCase()}s`,
        color: '#00aeff',
        derivedColors: {
          base: '#00aeff',
          accent: '#10beff',
          hover: '#0090dd',
          'grad-start': '#0088cc',
          'score-end': '#0077bb',
          dark: '#003344',
          soft: '#88ddee',
        },
        product: { production: true, vite: true },
        content: { production: true, vite: true },
        collections: {
          dataProducts: true,
          reviews: true,
          guides: true,
          news: true,
        },
        counts: { products: 1, reviews: 1, guides: 1, news: 1 },
        countText: '1 products  |  1 reviews Â· 1 guides Â· 1 news',
        presence: { hasProducts: true, hasContent: true },
        showProductToggles: true,
        showContentToggles: true,
        iconStatus: {
          exists: true,
          label: `${categoryId}.svg`,
          path: `public/images/navbar/${categoryId}.svg`,
          tooltip: 'Found',
        },
      },
    ],
    categoryCount: 1,
    statusRight: '1 categories',
    version: 1,
  };
}

function makeHubToolsPanelPayload() {
  return {
    toolTypes: [
      { key: 'hub', label: 'Hub' },
      { key: 'database', label: 'Database' },
      { key: 'versus', label: 'Versus' },
      { key: 'radar', label: 'Radars' },
      { key: 'shapes', label: 'Shapes' },
    ],
    categories: [
      {
        id: 'mouse',
        label: 'Mouse',
        color: '#00aeff',
        productActive: true,
        enabledCount: 5,
        totalCount: 5,
      },
      {
        id: 'keyboard',
        label: 'Keyboard',
        color: '#ff6b6b',
        productActive: true,
        enabledCount: 4,
        totalCount: 5,
      },
    ],
    tools: {
      mouse: [
        {
          tool: 'hub',
          title: 'Hub',
          description: 'Explore and compare over 500 gaming mouse',
          subtitle: 'Your One-Stop Mouse Hub',
          url: '/hubs/mouse',
          svg: '<svg />',
          enabled: true,
          navbar: true,
          hero: '/images/tools/mouse/hub/hero-img',
        },
        {
          tool: 'database',
          title: 'Database',
          description: 'Full database of mice',
          subtitle: 'Your One-Stop Mouse database',
          url: '/hubs/mouse?view=list',
          svg: '<svg />',
          enabled: true,
          navbar: false,
          hero: '',
        },
      ],
      keyboard: [
        {
          tool: 'hub',
          title: 'Hub',
          description: 'Browse and compare 100s gaming keyboard',
          subtitle: 'Your One-Stop Keyboard Hub',
          url: '/hubs/keyboard',
          svg: '',
          enabled: true,
          navbar: true,
          hero: '/images/tools/keyboard/hub/hero-img',
        },
      ],
    },
    tooltips: {
      hub: 'Main hub landing pages.',
      database: 'Structured lists.',
      versus: 'Side-by-side comparisons.',
      radar: 'Visual scorecards.',
      shapes: 'Shape profile catalog.',
    },
    index: {
      all: ['mouse:hub'],
      hub: ['mouse:hub'],
      database: [],
      versus: [],
      radar: [],
      shapes: [],
    },
    statusRight: '6 tools across 2 categories',
    version: 1,
  };
}

function makeIndexHeroesPanelPayload() {
  return {
    types: [
      { key: 'reviews', label: 'Reviews', color: '#89b4fa', slotCount: 6 },
      { key: 'news', label: 'News', color: '#fab387', slotCount: 6 },
      { key: 'guides', label: 'Guides', color: '#a6e3a1', slotCount: 6 },
      { key: 'brands', label: 'Brands', color: '#cba6f7', slotCount: 6 },
    ],
    activeType: 'reviews',
    activeCategory: '_all',
    categories: {
      reviews: [
        { key: '_all', label: 'All', count: 2 },
        { key: 'mouse', label: 'Mouse', count: 2 },
      ],
      news: [{ key: '_all', label: 'All', count: 0 }],
      guides: [{ key: '_all', label: 'All', count: 0 }],
      brands: [{ key: '_all', label: 'All', count: 0 }],
    },
    pools: {
      reviews: [
        {
          key: 'reviews:review-a',
          type: 'reviews',
          title: 'Review A',
          category: 'mouse',
          categoryLabel: 'Mouse',
          categoryColor: '#00aeff',
          categories: ['mouse'],
          dateText: '01-02-25 p',
          sortDate: '2025-01-02',
          isPinned: true,
          badge: 'Top Pick',
        },
        {
          key: 'reviews:review-b',
          type: 'reviews',
          title: 'Review B',
          category: 'keyboard',
          categoryLabel: 'Keyboard',
          categoryColor: '#ff6b6b',
          categories: ['keyboard'],
          dateText: '01-03-25 p',
          sortDate: '2025-01-03',
          isPinned: false,
          badge: '',
        },
      ],
      news: [],
      guides: [],
      brands: [],
    },
    slots: {
      reviews: [null, null, null, null, null, null],
      news: [null, null, null, null, null, null],
      guides: [null, null, null, null, null, null],
      brands: [null, null, null, null, null, null],
    },
    overrides: {
      reviews: { _all: ['reviews:review-a'] },
      news: { _all: [] },
      guides: { _all: [] },
      brands: { _all: [] },
    },
    statusRight: 'Index Heroes ready',
    version: 1,
  };
}

describe('React desktop editor helpers', () => {
  it('prefers projectRootName for the sidebar footer label', async () => {
    const { getSidebarFooterText } = await import('../config/ui/desktop-model.ts');
    assert.equal(
      getSidebarFooterText({
        appTitle: 'EG Config Manager',
        projectRootName: 'EG - TSX',
      }),
      'EG - TSX',
    );
  });

  it('builds Content request payloads from the editable state only', async () => {
    const { toContentRequestPayload } = await import('../config/ui/desktop-model.ts');
    assert.deepEqual(
      toContentRequestPayload(makeContentPanelPayload()),
      {
        manualSlots: {
          '1': 'reviews:review-a',
          '5': 'guides:guide-a',
        },
        pinned: ['reviews:review-a'],
        badges: {
          'reviews:review-a': 'Top Pick',
        },
        excluded: [],
      },
    );
  });

  it('derives the homepage pool from eligible non-manual articles only', async () => {
    const { getEligiblePoolArticles } = await import('../config/ui/desktop-model.ts');
    const panel = makeContentPanelPayload();
    panel.articlePool.push({
      ...panel.articlePool[0],
      key: 'reviews:review-b',
      collection: 'reviews',
      collectionLabel: 'Reviews',
      entryId: 'review-b',
      title: 'Review B',
      isExcluded: true,
      datePublished: '2025-01-05',
      sortDate: '2025-01-05',
      dateText: '01-05-25 p',
    });

    const result = getEligiblePoolArticles(panel, {
      collection: 'all',
      search: '',
    });

    assert.deepEqual(result.map((article) => article.key), ['news:news-a']);
  });

  it('sorts collection tabs by pinned state when requested', async () => {
    const { sortCollectionArticles } = await import('../config/ui/desktop-model.ts');
    const panel = makeContentPanelPayload();
    const sorted = sortCollectionArticles(
      [
        panel.dashboardSlots[0].article,
        {
          ...panel.dashboardSlots[0].article,
          key: 'reviews:review-z',
          title: 'Review Z',
          sortDate: '2025-01-10',
          isPinned: false,
        },
      ].filter(Boolean),
      'pinned',
    );

    assert.deepEqual(sorted.map((article) => article.key), [
      'reviews:review-a',
      'reviews:review-z',
    ]);
  });

  it('assigns an article to a slot without duplicating it elsewhere', async () => {
    const { assignArticleToSlot } = await import('../config/ui/content-editor.ts');
    const result = assignArticleToSlot(makeContentPanelPayload(), 'guides:guide-a', 1);
    assert.equal(result.manualSlots['1'], 'guides:guide-a');
    assert.ok(!Object.values(result.manualSlots).includes('reviews:review-a'));
    assert.equal(Object.values(result.manualSlots).filter((key) => key === 'guides:guide-a').length, 1);
  });

  it('assigns to the first open slot when no slot number is provided', async () => {
    const { assignArticleToSlot } = await import('../config/ui/content-editor.ts');
    const result = assignArticleToSlot(makeContentPanelPayload(), 'news:news-a');
    assert.equal(result.manualSlots['2'], 'news:news-a');
  });

  it('excluding an article removes its manual slot override', async () => {
    const { setArticleExcluded } = await import('../config/ui/content-editor.ts');
    const result = setArticleExcluded(makeContentPanelPayload(), 'reviews:review-a', true);
    assert.ok(!('1' in result.manualSlots));
    assert.deepEqual(result.excluded, ['reviews:review-a']);
  });

  it('removing a manual slot clears only that override', async () => {
    const { removeArticleFromSlot } = await import('../config/ui/content-editor.ts');
    const result = removeArticleFromSlot(makeContentPanelPayload(), 5);
    assert.deepEqual(result.manualSlots, {
      '1': 'reviews:review-a',
    });
  });

  it('pin toggles keep the list unique and sorted', async () => {
    const { setArticlePinned } = await import('../config/ui/content-editor.ts');
    const added = setArticlePinned(makeContentPanelPayload(), 'guides:guide-a', true);
    assert.deepEqual(added.pinned, ['guides:guide-a', 'reviews:review-a']);

    const removed = setArticlePinned(added, 'reviews:review-a', false);
    assert.deepEqual(removed.pinned, ['guides:guide-a']);
  });

  it('badge changes trim values and remove empty badges', async () => {
    const { setArticleBadge } = await import('../config/ui/content-editor.ts');
    const added = setArticleBadge(makeContentPanelPayload(), 'guides:guide-a', '  Staff Pick  ');
    assert.equal(added.badges['guides:guide-a'], 'Staff Pick');

    const removed = setArticleBadge(added, 'reviews:review-a', '   ');
    assert.ok(!('reviews:review-a' in removed.badges));
  });

  it('moving a manual article onto another manual slot swaps them', async () => {
    const { moveAssignedArticle } = await import('../config/ui/content-editor.ts');
    const result = moveAssignedArticle(makeContentPanelPayload(), 1, 5);
    assert.deepEqual(result.manualSlots, {
      '1': 'guides:guide-a',
      '5': 'reviews:review-a',
    });
  });

  it('resetting manual slots clears every override', async () => {
    const { resetManualSlots } = await import('../config/ui/content-editor.ts');
    const result = resetManualSlots(makeContentPanelPayload());
    assert.deepEqual(result.manualSlots, {});
  });
});

describe('React desktop presentational panels', () => {
  it('renders the frozen Categories grid through the extracted shared view', async () => {
    const { CategoriesPanelView } = await import('../config/ui/panels.tsx');
    const markup = renderToStaticMarkup(
      React.createElement(CategoriesPanelView, {
        panel: {
          siteColors: {
            primary: '#123456',
            secondary: '#654321',
            derivedColors: {
              accent: '#111111',
              hover: '#222222',
              'grad-start': '#333333',
              dark: '#444444',
              soft: '#555555',
            },
          },
          categories: [
            {
              id: 'mouse',
              label: 'Mouse',
              plural: 'Mice',
              color: '#00aeff',
              derivedColors: {
                base: '#00aeff',
                accent: '#10beff',
                hover: '#0090dd',
                'grad-start': '#0088cc',
                'score-end': '#0077bb',
                dark: '#003344',
                soft: '#88ddee',
              },
              product: { production: true, vite: true },
              content: { production: true, vite: true },
              collections: {
                dataProducts: true,
                reviews: true,
                guides: true,
                news: true,
              },
              counts: { products: 1, reviews: 1, guides: 1, news: 1 },
              countText: '1 products  |  1 reviews Â· 1 guides Â· 1 news',
              presence: { hasProducts: true, hasContent: true },
              showProductToggles: true,
              showContentToggles: true,
              iconStatus: {
                exists: true,
                label: 'mouse.svg',
                path: 'public/images/navbar/mouse.svg',
                tooltip: 'Found',
              },
            },
          ],
          categoryCount: 1,
          statusRight: '1 categories',
          version: 1,
        },
        onSiteColorPick() {},
        onCategoryColorPick() {},
        onCategoryChange() {},
        onToggleChange() {},
        onAddCategory() {},
      }),
    );

    assert.match(markup, /categories-panel__grid/);
    assert.match(markup, /category-card/);
    assert.match(markup, /\+ Add Category/);
  });

  it('renders the Content dashboard and pool through the extracted shared view', async () => {
    const { ContentPanelView } = await import('../config/ui/panels.tsx');
    const markup = renderToStaticMarkup(
      React.createElement(ContentPanelView, {
        panel: makeContentPanelPayload(),
        onAssignToSlot() {},
        onRemoveSlot() {},
        onTogglePinned() {},
        onToggleExcluded() {},
        onBadgeChange() {},
        onSelectCollection() {},
        activeCollection: 'all',
      }),
    );

    assert.match(markup, /content-panel/);
    assert.match(markup, /Dashboard Layout/);
    assert.match(markup, /Article Pool/);
    assert.match(markup, /Review A/);
    assert.match(markup, /News A/);
  });

  it('renders Content as main tabs with separate collection subtabs', async () => {
    const { ContentPanelView } = await import('../config/ui/panels.tsx');
    const panel = makeContentPanelPayload();
    panel.tabs.reviews = [panel.dashboardSlots[0].article].filter(Boolean);

    const markup = renderToStaticMarkup(
      React.createElement(ContentPanelView, {
        panel,
        onAssignToSlot() {},
        onRemoveSlot() {},
        onTogglePinned() {},
        onToggleExcluded() {},
        onBadgeChange() {},
        onSelectCollection() {},
        activeCollection: 'reviews',
      }),
    );

    assert.match(markup, /content-panel__main-tabs/);
    assert.match(markup, /content-panel__subtabs/);
    assert.match(markup, />Homepage</);
    assert.match(markup, />Collections</);
    assert.match(markup, /content-panel__subtab/);
    assert.match(markup, />Reviews</);
  });

  it('renders full collection labels in the Article Pool Type column', async () => {
    const { ContentPanelView } = await import('../config/ui/panels.tsx');
    const panel = makeContentPanelPayload();
    panel.articlePool = [
      {
        ...panel.articlePool[0],
        key: 'guides:guide-z',
        collection: 'guides',
        collectionLabel: 'Guides',
        entryId: 'guide-z',
        title: 'Guide Z',
        datePublished: '2025-01-08',
        sortDate: '2025-01-08',
        dateText: '01-08-25 p',
      },
    ];

    const markup = renderToStaticMarkup(
      React.createElement(ContentPanelView, {
        panel,
        onAssignToSlot() {},
        onRemoveSlot() {},
        onTogglePinned() {},
        onToggleExcluded() {},
        onBadgeChange() {},
        onSelectCollection() {},
        activeCollection: 'all',
      }),
    );

    assert.match(markup, />Guides</);
    assert.doesNotMatch(markup, />GDE</);
  });

  it('renders the full legacy feed legend labels for homepage logic readability', async () => {
    const { ContentPanelView } = await import('../config/ui/panels.tsx');
    const markup = renderToStaticMarkup(
      React.createElement(ContentPanelView, {
        panel: makeContentPanelPayload(),
        onAssignToSlot() {},
        onRemoveSlot() {},
        onTogglePinned() {},
        onToggleExcluded() {},
        onBadgeChange() {},
        onSelectCollection() {},
        activeCollection: 'all',
      }),
    );

    assert.match(markup, />Dash</);
    assert.match(markup, />News F</);
    assert.match(markup, />Games</);
    assert.match(markup, />Rev H</);
    assert.match(markup, />Rev</);
    assert.match(markup, />Guide H</);
    assert.match(markup, />Guides</);
    assert.match(markup, />News L &amp; C</);
  });

  it('uses themed inline icons in Content instead of emoji glyphs', async () => {
    const { ContentPanelView } = await import('../config/ui/panels.tsx');
    const markup = renderToStaticMarkup(
      React.createElement(ContentPanelView, {
        panel: makeContentPanelPayload(),
        onAssignToSlot() {},
        onRemoveSlot() {},
        onTogglePinned() {},
        onToggleExcluded() {},
        onBadgeChange() {},
        onSelectCollection() {},
        activeCollection: 'all',
      }),
    );

    assert.match(markup, /inline-icon/);
    assert.doesNotMatch(markup, /ðŸ“Œ|ðŸ”’|ðŸ“…|Ã—/u);
  });

  it('renders dedicated preview icons for the full legacy category set', async () => {
    const { CategoriesPanelView } = await import('../config/ui/panels.tsx');
    const legacyCategoryIds = [
      'mouse',
      'keyboard',
      'monitor',
      'headset',
      'mousepad',
      'controller',
      'hardware',
      'game',
      'gpu',
      'ai',
    ];

    for (const categoryId of legacyCategoryIds) {
      const markup = renderToStaticMarkup(
        React.createElement(CategoriesPanelView, {
          panel: makeCategoriesPanelPayload(categoryId),
          onSiteColorPick() {},
          onCategoryColorPick() {},
          onCategoryChange() {},
          onToggleChange() {},
          onAddCategory() {},
        }),
      );

      assert.doesNotMatch(
        markup,
        /category-preview-icon__text/,
        `Expected dedicated icon for ${categoryId}`,
      );
    }
  });

  it('renders Hub Tools with dense home/index surfaces from the extracted shared view', async () => {
    const { HubToolsPanelView } = await import('../config/ui/panels.tsx');
    const markup = renderToStaticMarkup(
      React.createElement(HubToolsPanelView, {
        panel: makeHubToolsPanelPayload(),
        activeCategory: 'mouse',
        activeIndexView: 'all',
        onSelectCategory() {},
        onSelectIndexView() {},
        onToolFieldChange() {},
        onToolToggle() {},
        onMoveTool() {},
        onRemoveTool() {},
        onAddTool() {},
        onTooltipChange() {},
        onIndexAssign() {},
        onIndexRemove() {},
      }),
    );

    assert.match(markup, /hub-tools-panel/);
    assert.match(markup, /Hub Tools Home/);
    assert.match(markup, /Hub Tools Index/);
    assert.match(markup, /mouse:hub/);
    assert.match(markup, /tooltip/);
  });

  it('renders Index Heroes with Content-aligned tab hierarchy and per-article accent hooks', async () => {
    const { IndexHeroesPanelView } = await import('../config/ui/panels.tsx');
    const markup = renderToStaticMarkup(
      React.createElement(IndexHeroesPanelView, {
        panel: makeIndexHeroesPanelPayload(),
        onSelectType() {},
        onSelectCategory() {},
        onAssignToSlot() {},
        onRemoveSlot() {},
      }),
    );

    assert.match(markup, /content-panel__main-tabs/);
    assert.match(markup, /content-panel__subtabs/);
    assert.match(markup, /content-pool__row/);
    assert.match(markup, /content-dashboard__slot/);
    assert.match(markup, /--content-accent:#00aeff/i);
    assert.match(markup, /--content-accent:#ff6b6b/i);
    assert.match(markup, /index-heroes-pool__col--date/);
    assert.match(markup, /content-dashboard__slot-date/);
    assert.match(markup, /manual/);
    assert.match(markup, /auto/);
  });
});

describe('ConfigDesktopApp integration points', () => {
  it('uses the project root name in the sidebar footer', () => {
    assert.match(APP_SOURCE, /shell\?\.projectRootName/);
  });

  it('sends unsaved category edits through the preview endpoint', () => {
    assert.match(APP_SOURCE, /\/api\/panels\/categories\/preview/);
  });

  it('renders the Content panel instead of falling back to the placeholder', () => {
    assert.match(APP_SOURCE, /activePanel === 'Content'/);
    assert.match(APP_SOURCE, /<ContentPanel/);
  });

  it('uses the Content preview and save endpoints from the React shell', () => {
    assert.match(APP_SOURCE, /\/api\/panels\/content\/preview/);
    assert.match(APP_SOURCE, /\/api\/panels\/content\/save/);
  });

  it('renders and wires the Index Heroes panel via the same preview/save pattern', () => {
    assert.match(APP_SOURCE, /activePanel === 'Index Heroes'/);
    assert.match(APP_SOURCE, /<IndexHeroesPanel/);
    assert.match(APP_SOURCE, /\/api\/panels\/index-heroes\/preview/);
    assert.match(APP_SOURCE, /\/api\/panels\/index-heroes\/save/);
  });

  it('renders and wires Hub Tools via the same preview/save pattern', () => {
    assert.match(APP_SOURCE, /activePanel === 'Hub Tools'/);
    assert.match(APP_SOURCE, /<HubToolsPanel/);
    assert.match(APP_SOURCE, /\/api\/panels\/hub-tools\/preview/);
    assert.match(APP_SOURCE, /\/api\/panels\/hub-tools\/save/);
  });
});

describe('Content token and density contract', () => {
  it('keeps feed legend colors tokenized (no hardcoded hex in FEED_LEGEND)', () => {
    const legendMatch = PANELS_SOURCE.match(
      /const FEED_LEGEND(?:\s*:\s*[^=]+)?\s*=\s*\[[\s\S]*?\];/,
    );
    assert.ok(legendMatch, 'Missing FEED_LEGEND definition');
    assert.doesNotMatch(legendMatch[0], /#[0-9a-fA-F]{6}/);
  });

  it('uses article/category accent color for pool row text', () => {
    assert.match(
      APP_STYLES,
      /\.content-pool__row\s*\{[\s\S]*color:\s*var\(--content-accent\);/m,
    );
  });

  it('uses article/category accent border color for auto dashboard tiles', () => {
    assert.match(
      APP_STYLES,
      /\.content-dashboard__slot--auto\s*\{[\s\S]*border-color:\s*var\(--content-accent/m,
    );
  });

  it('uses larger typography tokens for content tabs and feed guide labels', () => {
    assert.match(APP_STYLES, /--font-size-content-nav:\s*14px;/);
    assert.match(APP_STYLES, /--font-size-content-pill:\s*11px;/);
    assert.match(
      APP_STYLES,
      /\.content-panel__main-tab\s*\{[\s\S]*font-size:\s*var\(--font-size-content-nav\);/m,
    );
    assert.match(
      APP_STYLES,
      /\.content-panel__subtab,\s*\n\.content-panel__filter-pill,\s*\n\.content-panel__sort-pill\s*\{[\s\S]*font-size:\s*var\(--font-size-content-pill\);/m,
    );
    assert.match(
      APP_STYLES,
      /\.content-panel__feed-pill\s*\{[\s\S]*font-size:\s*var\(--font-size-content-pill\);/m,
    );
  });

  it('uses larger pool table typography and a themed dark scrollbar', () => {
    assert.match(APP_STYLES, /--font-size-content-pool-head:\s*13px;/);
    assert.match(APP_STYLES, /--font-size-content-pool-row:\s*13px;/);
    assert.match(
      APP_STYLES,
      /\.content-pool__head\s*\{[\s\S]*font-size:\s*var\(--font-size-content-pool-head\);/m,
    );
    assert.match(
      APP_STYLES,
      /\.content-pool__row\s*\{[\s\S]*font-size:\s*var\(--font-size-content-pool-row\);/m,
    );
    assert.match(APP_STYLES, /\.content-pool__body\s*\{[\s\S]*scrollbar-color:\s*var\(--color-surface-2\)\s+var\(--color-base\);/m);
    assert.match(APP_STYLES, /\.content-pool__body::-webkit-scrollbar\s*\{/m);
    assert.match(APP_STYLES, /\.content-pool__body::-webkit-scrollbar-thumb\s*\{[\s\S]*background:\s*var\(--color-surface-2\);/m);
  });

  it('uses shared reusable UI primitives instead of hand-rolled per-panel controls', () => {
    assert.match(PANELS_SOURCE, /from '\.\/shared-ui'/);
  });

  it('resets inherited dashboard row tracks for Index Heroes slots to prevent brands row drift', () => {
    assert.match(
      APP_STYLES,
      /\.index-heroes-slots__grid\s*\{[\s\S]*grid-template-rows:\s*none;/m,
    );
  });
});

describe('Theme token architecture contract', () => {
  it('keeps legacy-clone as the hard default skin with square geometry and flat elevation', () => {
    assert.match(APP_STYLES, /html\[data-theme="legacy-clone"\]/);
    assert.match(APP_STYLES, /--radius-control:\s*0px;/);
    assert.match(APP_STYLES, /--radius-surface:\s*0px;/);
    assert.match(APP_STYLES, /--radius-dialog:\s*0px;/);
    assert.match(APP_STYLES, /--shadow-card:\s*none;/);
    assert.match(APP_STYLES, /--shadow-dialog:\s*none;/);
    assert.match(APP_STYLES, /--shadow-toast:\s*none;/);
  });

  it('provides an alternate themed skin block through token overrides only', () => {
    assert.match(APP_STYLES, /html\[data-theme="arcade-neon"\]\s*\{/);
    assert.match(APP_STYLES, /html\[data-theme="arcade-neon"\][\s\S]*--color-base:/);
    assert.match(APP_STYLES, /html\[data-theme="arcade-neon"\][\s\S]*--font-ui:/);
    assert.match(APP_STYLES, /html\[data-theme="arcade-neon"\][\s\S]*--radius-control:/);
    assert.match(APP_STYLES, /html\[data-theme="arcade-neon"\][\s\S]*--shadow-card:/);
  });

  it('provides a pip-boy themed skin block through token overrides only', () => {
    assert.match(APP_STYLES, /html\[data-theme="pip-boy"\]\s*\{/);
    assert.match(APP_STYLES, /html\[data-theme="pip-boy"\][\s\S]*--color-base:/);
    assert.match(APP_STYLES, /html\[data-theme="pip-boy"\][\s\S]*--font-ui:/);
    assert.match(APP_STYLES, /html\[data-theme="pip-boy"\][\s\S]*--radius-control:/);
    assert.match(APP_STYLES, /html\[data-theme="pip-boy"\][\s\S]*--shadow-card:/);
    assert.match(APP_STYLES, /html\[data-theme="pip-boy"\][\s\S]*--color-text:\s*#33ff33;/);
  });

  it('binds the root data-theme to shell theme id instead of hardcoding legacy-clone', () => {
    assert.match(APP_SOURCE, /function resolveThemeId\(themeId:\s*string \| undefined\): IconThemeId/);
    assert.match(APP_SOURCE, /root\.dataset\.theme = resolveThemeId\(themeId\);/);
    assert.doesNotMatch(APP_SOURCE, /root\.dataset\.theme = 'legacy-clone';/);
  });
});

describe('Theme-swappable icon contract', () => {
  it('switches sidebar icon assets by icon theme id at render time', () => {
    assert.match(APP_SOURCE, /const NAV_ICON_SETS:\s*Record<IconThemeId,\s*Record<string,\s*JSX\.Element>>/);
    assert.match(APP_SOURCE, /function NavIcon\(\{ panelKey, themeId \}:\s*\{ panelKey:\s*string; themeId:\s*IconThemeId \}\)/);
    assert.match(APP_SOURCE, /const themedIcons = NAV_ICON_SETS\[themeId\] \?\? NAV_ICON_SETS\['legacy-clone'\];/);
    assert.match(APP_SOURCE, /<NavIcon panelKey=\{item\.key\} themeId=\{iconThemeId\} \/>/);
    assert.doesNotMatch(APP_SOURCE, /fontSize=\"\d+\"/);
    assert.doesNotMatch(APP_SOURCE, /fontWeight=\"\d+\"/);
  });

  it('wires shared action/status icons through icon theme context', () => {
    assert.match(SHARED_UI_SOURCE, /createContext<IconThemeId>\('legacy-clone'\)/);
    assert.match(SHARED_UI_SOURCE, /useContext\(IconThemeContext\)/);
    assert.match(SHARED_UI_SOURCE, /const ICON_PATHS:\s*Record<IconThemeId,\s*Record<IconName,\s*ReactNode>>/);
  });
});

describe('Categories row spacing contract', () => {
  it('keeps row rhythm but adds exactly 4px between Label inputs and Product toggles', () => {
    assert.match(
      APP_STYLES,
      /\.category-card__row--inputs\s*\+\s*\.category-card__row--toggles\s*\{\s*margin-top:\s*calc\(var\(--card-row-gap\)\s*\+\s*4px\);\s*\}/s,
    );
  });

  it('uses a product-only toggle hook and reduces product toggle height by exactly 2px', () => {
    assert.match(PANELS_SOURCE, /className="toggle-group toggle-group--product"/);
    assert.match(
      APP_STYLES,
      /\.toggle-group--product\s+\.toggle__track\s*\{\s*height:\s*calc\(var\(--toggle-height\)\s*-\s*2px\);\s*\}/s,
    );
  });
});

describe('Categories color dialog immediacy contract', () => {
  it('renders a direct color input in the dialog and removes the extra picker button', () => {
    assert.match(
      APP_SOURCE,
      /<input\s+className="color-dialog__picker"\s+type="color"\s+value=\{normalized\}\s+onChange=\{\(event\) => setDraftColor\(event\.target\.value\)\}\s*\/>/s,
    );
    assert.doesNotMatch(APP_SOURCE, />\s*System Picker\s*</s);
    assert.match(
      APP_STYLES,
      /\.color-dialog__picker\s*\{\s*width:\s*100%;\s*min-height:\s*calc\(var\(--button-height\)\s*\+\s*8px\);\s*padding:\s*0;\s*border:\s*var\(--border-width-hairline\)\s*solid\s*var\(--color-surface-2\);\s*background:\s*transparent;\s*cursor:\s*pointer;\s*\}/s,
    );
    assert.match(
      APP_STYLES,
      /\.color-dialog__picker::-webkit-color-swatch-wrapper\s*\{\s*padding:\s*0;\s*\}/s,
    );
    assert.match(
      APP_STYLES,
      /\.color-dialog__picker::-webkit-color-swatch\s*\{\s*border:\s*0;\s*\}/s,
    );
  });

  it('renders always-visible themed HSL controls for immediate color editing', () => {
    assert.match(APP_SOURCE, /className="color-dialog__sliders"/);
    assert.match(
      APP_SOURCE,
      /className="color-dialog__slider-input color-dialog__slider-input--hue"\s+type="range"\s+min="0"\s+max="360"/s,
    );
    assert.match(
      APP_SOURCE,
      /className="color-dialog__slider-input color-dialog__slider-input--saturation"\s+type="range"\s+min="0"\s+max="100"/s,
    );
    assert.match(
      APP_SOURCE,
      /className="color-dialog__slider-input color-dialog__slider-input--lightness"\s+type="range"\s+min="0"\s+max="100"/s,
    );
    assert.match(
      APP_STYLES,
      /\.color-dialog__sliders\s*\{\s*display:\s*grid;\s*gap:\s*6px;\s*\}/s,
    );
    assert.match(
      APP_STYLES,
      /\.color-dialog__slider-input--hue\s*\{[\s\S]*linear-gradient\(\s*to right,\s*hsl\(0 100% 50%\),\s*hsl\(60 100% 50%\),\s*hsl\(120 100% 50%\),\s*hsl\(180 100% 50%\),\s*hsl\(240 100% 50%\),\s*hsl\(300 100% 50%\),\s*hsl\(360 100% 50%\)\s*\);[\s\S]*\}/s,
    );
  });
});

describe('Context bar save button contract', () => {
  it('uses a dedicated save-button hook and increases width and font size', () => {
    assert.match(APP_SOURCE, /className="token-button token-button--accent context-bar__save-button"/);
    assert.match(
      APP_STYLES,
      /\.token-button\.context-bar__save-button\s*\{\s*min-width:\s*calc\(var\(--button-height\)\s*\*\s*3\);\s*font-size:\s*calc\(var\(--font-size-heading\)\s*-\s*1px\);\s*font-weight:\s*var\(--font-weight-medium\);\s*\}/s,
    );
  });
});

describe('Sidebar logo wordmark contract', () => {
  it('renders EG Config using the shared navbar wordmark class hooks', () => {
    assert.match(
      APP_SOURCE,
      /<span className="site-name sidebar__logo-wordmark">\s*<span className="navsitename1">EG<\/span>\s*<span className="navsitename2">Config<\/span>\s*<\/span>/s,
    );
  });

  it('mirrors navbar logo styling primitives for the config sidebar logo', () => {
    assert.match(APP_STYLES, /--logo-font1:\s*"Futura",\s*sans-serif;/);
    assert.match(APP_STYLES, /--font-size-shell-logo:\s*25px;/);
    assert.match(
      APP_STYLES,
      /\.sidebar__logo\s*\{\s*display:\s*flex;\s*align-items:\s*center;\s*min-height:\s*var\(--logo-height\);\s*padding-inline:\s*var\(--shell-sidebar-padding-x\);\s*\}/s,
    );
    assert.match(
      APP_STYLES,
      /\.sidebar__logo-wordmark\s*\{\s*display:\s*flex;\s*align-items:\s*center;\s*font-size:\s*var\(--font-size-shell-logo\);\s*font-family:\s*var\(--logo-font1\);\s*font-weight:\s*var\(--font-weight-bold\);\s*color:\s*var\(--color-text\);\s*letter-spacing:\s*(?:-0\.65px|var\(--shell-logo-wordmark-spacing\));\s*overflow:\s*visible;\s*border-radius:\s*(?:2px|var\(--radius-control\));\s*gap:\s*0\.05em;\s*\}/s,
    );
    assert.match(
      APP_STYLES,
      /\.sidebar__logo-wordmark\s+\.navsitename1\s*\{\s*padding:\s*0\.15em;\s*background:\s*linear-gradient\(to right,\s*var\(--theme-site-gradient-start\),\s*var\(--theme-site-gradient-end\)\);\s*color:\s*var\(--color-text\);\s*text-box-trim:\s*trim-both;\s*text-box-edge:\s*cap alphabetic;\s*\}/s,
    );
    assert.match(
      APP_STYLES,
      /\.sidebar__logo-wordmark\s+\.navsitename2\s*\{\s*display:\s*inline-block;\s*margin-right:\s*0\.75rem;\s*line-height:\s*1\.1em;\s*height:\s*auto;\s*padding-bottom:\s*0\.1em;\s*overflow:\s*visible;\s*transform:\s*translateY\(0\.05em\);\s*\}/s,
    );
    assert.doesNotMatch(
      APP_STYLES,
      /\.sidebar__logo-wordmark\s+\.navsitename2\s*\{[^}]*text-box-trim:/s,
    );
    assert.doesNotMatch(
      APP_STYLES,
      /\.sidebar__logo-wordmark\s+\.navsitename2\s*\{[^}]*text-box-edge:/s,
    );
    assert.match(
      APP_STYLES,
      /@supports not \(text-box-trim:\s*trim-both\)\s*\{\s*\.sidebar__logo-wordmark\s+\.navsitename1\s*\{\s*line-height:\s*0\.85em;\s*height:\s*0\.85em;\s*\}\s*\}/s,
    );
  });
});

