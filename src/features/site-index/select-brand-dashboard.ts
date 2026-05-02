// ─── TS gateway for selectBrandDashboard ─────────────────────────────────────
// WHY: .mjs gateway pattern per AGENTS.md — pure logic importable by node --test,
// TS gateway adds types and composes with Astro-specific concerns.

import { selectBrandDashboard as selectBrandDashboardPure } from './select-brand-dashboard.mjs';
import type { BrandTileItem } from './brand-types';

export interface SelectBrandDashboardOptions {
  brands: BrandTileItem[];
  categorySlug: string;
  categories: string[];
  overrides?: string[];
}

export const selectBrandDashboard: (opts: SelectBrandDashboardOptions) => BrandTileItem[] = selectBrandDashboardPure;
