// ─── TS gateway for page-builder ─────────────────────────────────────────────
// WHY: .mjs gateway pattern per AGENTS.md — pure logic importable by node --test,
// TS gateway adds types and wires in @core/category-contract.

import { label } from '@core/category-contract';
import type { DashboardEntry } from '@core/article-helpers';
import type { FeaturedItem } from '@features/home/featured-scroller-utils';
import type { FilterCategory, PaginationData } from './build-pagination';
import type { StructuredDataEntry } from './structured-data';
import {
  buildSiteIndexStaticPaths as buildSiteIndexStaticPathsPure,
  buildSiteIndexPageVm as buildSiteIndexPageVmPure,
  enrichReviewItemsWithScores as enrichReviewItemsWithScoresPure,
} from './page-builder.mjs';

export type SiteIndexType = 'reviews' | 'guides' | 'news' | 'brands';

export interface SiteIndexStaticPathProps {
  category: string;
  page: number;
  totalPages: number;
  allItems: DashboardEntry[];
  allCount: number;
  filterCats: FilterCategory[];
}

export interface SiteIndexStaticPath {
  params: { slug: string | undefined };
  props: SiteIndexStaticPathProps;
}

export interface BuildSiteIndexStaticPathsOptions {
  type: SiteIndexType;
  entries: DashboardEntry[];
  categories: string[];
  perPage: number;
}

export interface SiteIndexSeoVm {
  title: string;
  description: string;
  canonicalUrl: string;
  structuredData: StructuredDataEntry[];
}

export interface SiteIndexBleedVm {
  type: SiteIndexType;
  typeLabel: string;
  category: string;
  categoryLabel: string;
  categoryClass?: string;
  page: number;
  headerDek: string;
  dashboardItems: FeaturedItem[];
  heading: string;
  breadcrumbs: Array<{ label: string; href?: string }>;
}

export interface SiteIndexBodyVm {
  type: SiteIndexType;
  typeLabel: string;
  pageItems: FeaturedItem[];
  heading: string;
  pagination: PaginationData;
  filterCategories: FilterCategory[];
  activeCategory?: string;
  categoryClass?: string;
  allCount: number;
  dashboardCount: number;
}

export interface SiteIndexPageVm {
  seo: SiteIndexSeoVm;
  bleed: SiteIndexBleedVm;
  body: SiteIndexBodyVm;
}

export interface BuildSiteIndexPageVmOptions {
  type: SiteIndexType;
  typeLabel: string;
  headerDek: string;
  siteUrl: string;
  perPage: number;
  pageProps: SiteIndexStaticPathProps;
  mapEntryToFeaturedItem: (entry: DashboardEntry) => FeaturedItem;
  pinnedSet?: Set<string>;
  indexHeroesForType?: Record<string, string[]>;
  enrichItems?: (args: {
    items: FeaturedItem[];
    entries: DashboardEntry[];
  }) => FeaturedItem[] | Promise<FeaturedItem[]>;
}

export interface EnrichReviewItemsWithScoresOptions {
  items: FeaturedItem[];
  entries: DashboardEntry[];
  products: Array<{ id: string; data: Record<string, unknown> }>;
}

export function buildSiteIndexStaticPaths(opts: BuildSiteIndexStaticPathsOptions): SiteIndexStaticPath[] {
  return buildSiteIndexStaticPathsPure({ ...opts, labelFn: label }) as SiteIndexStaticPath[];
}

export async function buildSiteIndexPageVm(opts: BuildSiteIndexPageVmOptions): Promise<SiteIndexPageVm> {
  return buildSiteIndexPageVmPure({ ...opts, labelFn: label }) as Promise<SiteIndexPageVm>;
}

export function enrichReviewItemsWithScores(opts: EnrichReviewItemsWithScoresOptions): FeaturedItem[] {
  return enrichReviewItemsWithScoresPure(opts) as FeaturedItem[];
}
