// ─── TS gateway for brand-helpers ────────────────────────────────────────────
// WHY: .mjs gateway pattern per AGENTS.md — pure logic importable by node --test,
// TS gateway adds types and composes with Astro-specific concerns.

import {
  packBrand as packBrandPure,
  brandLogoSrcSet as brandLogoSrcSetPure,
  buildBrandCategoryCounts as buildBrandCategoryCountsPure,
  buildBrandFilterCategories as buildBrandFilterCategoriesPure,
} from './brand-helpers.mjs';
import type { BrandTileItem } from './brand-types';
import type { FilterCategory } from './build-pagination';

interface BrandEntry {
  id: string;
  data: {
    brand: string;
    displayName?: string;
    categories?: string[];
    navbar?: string[];
    iDashboard?: string;
    iFilteredDashboard?: string;
    logoStyle?: string;
    datePublished?: Date | string;
    dateUpdated?: Date | string;
  };
}

export const packBrand: (entry: BrandEntry) => BrandTileItem = packBrandPure;
export const brandLogoSrcSet: (logoBase: string) => string = brandLogoSrcSetPure;
export const buildBrandCategoryCounts: (brands: BrandTileItem[], categoryList: string[]) => Map<string, number> = buildBrandCategoryCountsPure;
export const buildBrandFilterCategories: (brands: BrandTileItem[], categoryList: string[], activeCategory: string) => FilterCategory[] = buildBrandFilterCategoriesPure;
