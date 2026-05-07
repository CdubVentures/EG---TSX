import { CONFIG } from '@core/config';
import { getBrands, getGames, getGuides, getNews, getReviews } from '@core/content';
import { pinnedSet, badgesMap, indexHeroes } from '@core/dashboard';
import { getProducts } from '@core/products';
import type { DashboardEntry } from '@core/article-helpers';
import { toFeaturedItem, type FeaturedItem } from '@features/home/featured-scroller-utils';
import {
  buildSiteIndexPageVm,
  buildSiteIndexStaticPaths,
  enrichReviewItemsWithScores,
  type SiteIndexStaticPath,
  type SiteIndexStaticPathProps,
  type SiteIndexPageVm,
  type SiteIndexType,
} from './page-builder';
import {
  buildBrandStaticPaths,
  buildBrandBleedVm,
  buildBrandBodyVm,
  type BrandStaticPath,
  type BrandStaticPathProps,
  type BrandBleedVm,
  type BrandBodyVm,
} from './brand-page-builder';
import { packBrand } from './brand-helpers';
import {
  buildGamesStaticPaths,
  buildGamesPageVm,
  type BuildGamesStaticPathsOptions,
  type BuildGamesPageVmOptions,
} from './games-page-builder';
import type { GameEntryLike } from './games-helpers';
import type { GameStaticPath, GameStaticPathProps, GamesPageVm } from './games-types';

type SiteIndexEnrichItems = (args: {
  items: FeaturedItem[];
  entries: DashboardEntry[];
}) => FeaturedItem[] | Promise<FeaturedItem[]>;

export interface SiteIndexDefinition {
  type: SiteIndexType;
  typeLabel: string;
  headerDek: string;
  loadEntries: () => Promise<DashboardEntry[]>;
  enrichItems?: SiteIndexEnrichItems;
}

async function loadTaggedEntries(
  type: SiteIndexType,
  loader: () => Promise<Array<{ id: string; data: DashboardEntry['data'] }>>,
): Promise<DashboardEntry[]> {
  const entries = await loader();
  return entries.map((entry) => ({
    ...entry,
    _collection: type,
  })) as DashboardEntry[];
}

export const reviewsIndexDefinition: SiteIndexDefinition = {
  type: 'reviews',
  typeLabel: 'Reviews',
  headerDek: 'In-depth, unbiased hardware reviews—mice, keyboards, GPUs, monitors, and more—focused on real-world performance, build quality, and value.',
  loadEntries: () => loadTaggedEntries('reviews', getReviews),
  enrichItems: async ({ items, entries }) => {
    const products = await getProducts() as unknown as Array<{ id: string; data: Record<string, unknown> }>;
    return enrichReviewItemsWithScores({ items, entries, products });
  },
};

export const guidesIndexDefinition: SiteIndexDefinition = {
  type: 'guides',
  typeLabel: 'Guides',
  headerDek: 'Hands-on buying guides, top picks, and step-by-step tutorials to help you choose and use the best gaming and PC tech.',
  loadEntries: () => loadTaggedEntries('guides', getGuides),
};

export const newsIndexDefinition: SiteIndexDefinition = {
  type: 'news',
  typeLabel: 'News',
  headerDek: 'Fast, factual coverage of gaming, hardware, and PC tech—new gear launches, updates, patches, and industry moves.',
  loadEntries: () => loadTaggedEntries('news', getNews),
};

export async function getSiteIndexStaticPaths(
  definition: SiteIndexDefinition,
): Promise<SiteIndexStaticPath[]> {
  const entries = await definition.loadEntries();
  return buildSiteIndexStaticPaths({
    type: definition.type,
    entries,
    categories: CONFIG.contentCategories,
    perPage: CONFIG.pagination.indexPerPage,
  });
}

export async function buildSiteIndexVm(
  definition: SiteIndexDefinition,
  pageProps: SiteIndexStaticPathProps,
): Promise<SiteIndexPageVm> {
  return buildSiteIndexPageVm({
    type: definition.type,
    typeLabel: definition.typeLabel,
    headerDek: definition.headerDek,
    siteUrl: CONFIG.site.url,
    perPage: CONFIG.pagination.indexPerPage,
    pageProps,
    mapEntryToFeaturedItem: (entry) => {
      const item = toFeaturedItem(entry, { pinnedSet, badgesMap });
      item.isPinned = false;
      return item;
    },
    pinnedSet,
    indexHeroesForType: (indexHeroes as Record<string, Record<string, string[]>>)[definition.type],
    enrichItems: definition.enrichItems,
  });
}

// ─── Brands index ─────────────────────────────────────────────────────────────

const BRAND_HEADER_DEK = 'Browse gaming & PC tech brands. Filter by category and jump straight to each brand hub.';

export async function getBrandStaticPaths(): Promise<BrandStaticPath[]> {
  const brands = await getBrands();
  return buildBrandStaticPaths({
    brands,
    categories: CONFIG.contentCategories,
    perPage: CONFIG.pagination.brandsPerPage,
  });
}

export async function buildBrandPageVm(
  pageProps: BrandStaticPathProps,
): Promise<{ bleed: BrandBleedVm; body: BrandBodyVm }> {
  // WHY: Config overrides take priority over iDashboard frontmatter pins
  const brandOverrides = (indexHeroes as Record<string, Record<string, string[]>>)['brands'] ?? {};
  const overrideKey = pageProps.category || '_all';
  const overridesForView = brandOverrides[overrideKey] ?? [];

  const bleed = buildBrandBleedVm({
    brands: pageProps.brands,
    category: pageProps.category,
    page: pageProps.page,
    categoryList: CONFIG.contentCategories,
    headerDek: BRAND_HEADER_DEK,
    siteUrl: CONFIG.site.url,
    overrides: overridesForView,
  });

  // WHY: pack brands once for body VM — bleed packs internally (29 brands, negligible)
  const packedBrands = pageProps.brands.map(packBrand);
  const body = buildBrandBodyVm({
    brands: packedBrands,
    page: pageProps.page,
    perPage: CONFIG.pagination.brandsPerPage,
    category: pageProps.category,
    filterCategories: bleed.filterCategories,
  });

  return { bleed, body };
}

export type { BrandStaticPath, BrandStaticPathProps, BrandBleedVm, BrandBodyVm };

// ─── Games index ──────────────────────────────────────────────────────────────

const GAMES_HEADER_DEK =
  'Find the most played and talked-about games. Filter by genre and jump into each game’s hub.';
const GAMES_TYPE_LABEL = 'Games';

export async function getGamesStaticPaths(): Promise<GameStaticPath[]> {
  const entries = (await getGames()) as unknown as GameEntryLike[];
  return buildGamesStaticPaths({
    entries,
    perPage: CONFIG.pagination.indexPerPage,
  });
}

export async function buildGamesPageVmFromProps(
  pageProps: GameStaticPathProps,
): Promise<GamesPageVm> {
  return buildGamesPageVm({
    typeLabel: GAMES_TYPE_LABEL,
    headerDek: GAMES_HEADER_DEK,
    siteUrl: CONFIG.site.url,
    perPage: CONFIG.pagination.indexPerPage,
    pageProps,
  });
}

export type { GameStaticPath, GameStaticPathProps, GamesPageVm };
export type { BuildGamesStaticPathsOptions, BuildGamesPageVmOptions };
