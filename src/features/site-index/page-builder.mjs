// ─── Site-index page builder — pure logic ────────────────────────────────────
// WHY: .mjs so node --test can import without Astro transpilation.
// Gateway: page-builder.ts re-exports with TS types + wires in @core/category-contract.

import { sortByPinnedThenDate } from '../../core/dashboard-filter.mjs';
import { buildPagination } from './build-pagination.mjs';
import { selectDashboard } from './select-dashboard.mjs';
import { buildSiteIndexStructuredData } from './structured-data.mjs';

/**
 * Titlecase fallback when no labelFn is provided.
 * @param {string} s
 * @returns {string}
 */
function fallbackLabel(s) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/**
 * Build static paths for site-index routes (reviews, news, guides).
 *
 * @param {{ type: string, entries: Array, categories: string[], perPage: number, labelFn?: (id: string) => string }} opts
 * @returns {Array<{ params: { slug: string | undefined }, props: object }>}
 */
export function buildSiteIndexStaticPaths({ type, entries, categories, perPage, labelFn }) {
  const toLabel = labelFn || fallbackLabel;
  const paths = [];
  const allItems = entries;
  const catMap = new Map();
  catMap.set('', allItems);

  for (const category of categories) {
    const catItems = allItems.filter((entry) => entry.data.category === category);
    if (catItems.length > 0) {
      catMap.set(category, catItems);
    }
  }

  const filterCats = [];
  for (const category of categories) {
    const catItems = catMap.get(category);
    if (catItems && catItems.length > 0) {
      filterCats.push({
        key: category,
        label: toLabel(category),
        url: `/${type}/${category}/`,
        count: catItems.length,
        active: false,
      });
    }
  }

  for (const [category, items] of catMap) {
    const totalPages = Math.max(1, Math.ceil(items.length / perPage));

    for (let page = 1; page <= totalPages; page += 1) {
      let slug;
      if (category && page > 1) slug = `${category}/page/${page}`;
      else if (category) slug = category;
      else if (page > 1) slug = `page/${page}`;
      else slug = undefined;

      paths.push({
        params: { slug },
        props: {
          category,
          page,
          totalPages,
          allItems: items,
          allCount: allItems.length,
          filterCats: filterCats.map((filterCat) => ({
            ...filterCat,
            active: filterCat.key === category,
          })),
        },
      });
    }
  }

  return paths;
}

/**
 * Build the full page view model for a site-index page.
 *
 * @param {{ type: string, typeLabel: string, headerDek: string, siteUrl: string, perPage: number, pageProps: object, mapEntryToFeaturedItem: Function, pinnedSet?: Set, indexHeroesForType?: Record<string, string[]>, enrichItems?: Function, labelFn?: (id: string) => string }} opts
 * @returns {Promise<object>}
 */
export async function buildSiteIndexPageVm({
  type,
  typeLabel,
  headerDek,
  siteUrl,
  perPage,
  pageProps,
  mapEntryToFeaturedItem,
  pinnedSet = new Set(),
  indexHeroesForType = {},
  enrichItems,
  labelFn,
}) {
  const toLabel = labelFn || fallbackLabel;
  const { category, page, totalPages, allItems, allCount, filterCats } = pageProps;
  const sorted = sortByPinnedThenDate(allItems, pinnedSet);
  let featuredItems = sorted.map((entry) => mapEntryToFeaturedItem(entry));

  if (enrichItems) {
    featuredItems = await enrichItems({ items: featuredItems, entries: sorted });
  }

  const heroOverrides = indexHeroesForType[category || '_all'] ?? [];
  const dashItems = page === 1
    ? selectDashboard({
      items: featuredItems,
      pinnedSet,
      categorySlug: category,
      overrides: heroOverrides,
    })
    : [];
  const showDashboard = dashItems.length > 0;
  const dashIds = new Set(showDashboard ? dashItems.map((item) => item.id) : []);

  const startIdx = (page - 1) * perPage;
  const rawPageItems = featuredItems.slice(startIdx, startIdx + perPage);
  const pageItems = page === 1 && showDashboard
    ? rawPageItems.filter((item) => !dashIds.has(item.id))
    : rawPageItems;

  const baseUrl = category ? `/${type}/${category}` : `/${type}`;
  const pagination = buildPagination({ baseUrl, current: page, total: totalPages });

  const categoryLabel = category ? toLabel(category) : '';
  const heading = category ? `${categoryLabel} ${typeLabel}` : typeLabel;
  const feedHeading = category ? `${categoryLabel} ${typeLabel}` : `All ${typeLabel}`;

  const breadcrumbs = [
    { label: 'Home', href: '/' },
    { label: typeLabel, href: category || page > 1 ? `/${type}/` : undefined },
  ];
  if (category) {
    breadcrumbs.push({
      label: categoryLabel,
      href: page > 1 ? `/${type}/${category}/` : undefined,
    });
  }
  if (page > 1) {
    breadcrumbs.push({ label: `Page ${page}` });
  }

  const canonicalUrl = category
    ? (page > 1 ? `${siteUrl}/${type}/${category}/page/${page}/` : `${siteUrl}/${type}/${category}/`)
    : (page > 1 ? `${siteUrl}/${type}/page/${page}/` : `${siteUrl}/${type}/`);
  const title = category
    ? `${categoryLabel} ${typeLabel} - EG`
    : `${typeLabel} - EG`;
  const description = `Browse the latest ${typeLabel.toLowerCase()}${category ? ` in ${categoryLabel.toLowerCase()}` : ''} from EG Gear.`;
  const categoryClass = category ? `${category}-color` : undefined;
  const structuredData = buildSiteIndexStructuredData({
    siteUrl,
    canonicalUrl,
    title,
    description,
    breadcrumbs,
  });

  return {
    seo: {
      title,
      description,
      canonicalUrl,
      structuredData,
    },
    bleed: {
      type,
      typeLabel,
      category,
      categoryLabel,
      categoryClass,
      page,
      headerDek,
      dashboardItems: dashItems,
      heading,
      breadcrumbs,
    },
    body: {
      type,
      typeLabel,
      pageItems,
      heading: feedHeading,
      pagination,
      filterCategories: filterCats,
      activeCategory: category || undefined,
      categoryClass,
      allCount,
      dashboardCount: showDashboard ? dashItems.length : 0,
    },
  };
}

/**
 * Enrich review items with product overall scores.
 *
 * @param {{ items: Array, entries: Array, products: Array<{ id: string, data: Record<string, unknown> }> }} opts
 * @returns {Array}
 */
export function enrichReviewItemsWithScores({ items, entries, products }) {
  const scoreMap = new Map();
  for (const product of products) {
    const overall = product.data.overall;
    if (typeof overall === 'number' && overall > 0) {
      scoreMap.set(product.id, overall);
    }
  }

  const productIdByEntryId = new Map();
  for (const entry of entries) {
    const productId = entry.data.productId;
    if (typeof productId === 'string' && productId.length > 0) {
      productIdByEntryId.set(entry.id, productId);
    }
  }

  return items.map((item) => {
    const productId = productIdByEntryId.get(item.id);
    if (!productId || !scoreMap.has(productId)) {
      return item;
    }
    return {
      ...item,
      overall: scoreMap.get(productId),
    };
  });
}
