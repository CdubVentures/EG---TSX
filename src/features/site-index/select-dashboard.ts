// ─── TS gateway for selectDashboard ──────────────────────────────────────────
// WHY: .mjs gateway pattern per AGENTS.md — pure logic importable by node --test,
// TS gateway adds types and composes with Astro-specific concerns.

import { selectDashboard as selectDashboardPure } from './select-dashboard.mjs';
import type { FeaturedItem } from '@features/home/featured-scroller-utils';

export interface SelectDashboardOptions {
  items: FeaturedItem[];
  pinnedSet?: Set<string>;
  categorySlug?: string;
  count?: number;
  overrides?: string[];
}

export const selectDashboard: (opts: SelectDashboardOptions) => FeaturedItem[] = selectDashboardPure;
