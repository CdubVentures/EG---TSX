// ─── TS gateway for brand-page-builder ───────────────────────────────────────
// WHY: .mjs gateway pattern per AGENTS.md — pure logic importable by node --test,
// TS gateway adds types and composes with Astro-specific concerns.

import {
  buildBrandStaticPaths as buildBrandStaticPathsPure,
  buildBrandBleedVm as buildBrandBleedVmPure,
  buildBrandBodyVm as buildBrandBodyVmPure,
} from './brand-page-builder.mjs';
import type { BrandTileItem } from './brand-types';
import type { FilterCategory, PaginationData } from './build-pagination';

interface BrandEntry {
  id: string;
  data: {
    brand: string;
    displayName?: string;
    categories?: string[];
    navbar?: string[];
    iDashboard?: string;
    iFilteredDashboard?: string;
    publish?: boolean;
    [key: string]: unknown;
  };
}

export interface BrandStaticPathProps {
  brands: BrandEntry[];
  category: string;
  page: number;
  totalPages: number;
}

export interface BrandStaticPath {
  params: { slug: string | undefined };
  props: BrandStaticPathProps;
}

export interface BuildBrandStaticPathsOptions {
  brands: BrandEntry[];
  categories: string[];
  perPage: number;
}

export interface BrandBleedVm {
  type: 'brands';
  typeLabel: string;
  heading: string;
  headerDek: string;
  breadcrumbs: Array<{ label: string; href?: string }>;
  category: string;
  categoryLabel: string;
  categoryClass?: string;
  page: number;
  brandDashboardItems: BrandTileItem[];
  filterCategories: FilterCategory[];
}

export interface BuildBrandBleedVmOptions {
  brands: BrandEntry[];
  category: string;
  page: number;
  categoryList: string[];
  headerDek: string;
  siteUrl: string;
  overrides?: string[];
}

export function buildBrandStaticPaths(opts: BuildBrandStaticPathsOptions): BrandStaticPath[] {
  return buildBrandStaticPathsPure(opts) as BrandStaticPath[];
}

export function buildBrandBleedVm(opts: BuildBrandBleedVmOptions): BrandBleedVm {
  return buildBrandBleedVmPure(opts) as BrandBleedVm;
}

export interface BrandBodyVm {
  type: 'brands';
  typeLabel: string;
  heading: string;
  pageItems: BrandTileItem[];
  allCount: number;
  pagination: PaginationData;
  filterCategories: FilterCategory[];
  activeCategory?: string;
  categoryClass?: string;
}

export interface BuildBrandBodyVmOptions {
  brands: BrandTileItem[];
  page: number;
  perPage: number;
  category: string;
  filterCategories: FilterCategory[];
}

export function buildBrandBodyVm(opts: BuildBrandBodyVmOptions): BrandBodyVm {
  return buildBrandBodyVmPure(opts) as BrandBodyVm;
}
