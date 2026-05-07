// ─── Dashboard config gateway — editorial slot control, pins, badges ─────────
// WHY: The Content panel in config/eg-config.pyw writes config/data/content.json with manual
// slot assignments, pin flags, badge text, and exclusions. This module reads
// that config and applies the production algorithm used by the consolidated
// config app to produce the final ordered dashboard entries.

import { z } from 'zod';
import type { DashboardEntry } from './article-helpers';
import {
  buildDashboard as buildDashboardPure,
  entryKey as entryKeyPure,
  splitBadge as splitBadgePure,
  sortByPinnedThenDate as sortByPinnedThenDatePure,
} from './dashboard-filter.mjs';
import dashboardRaw from '../../config/data/content.json';

// ─── Zod schema ─────────────────────────────────────────────────────────────

const slotRefSchema = z.object({
  collection: z.string(),
  id: z.string(),
});

const indexHeroesPerTypeSchema = z.record(z.string(), z.array(z.string())).default({});

const dashboardConfigSchema = z.object({
  slots: z.record(z.string(), slotRefSchema).default({}),
  pinned: z.array(z.string()).default([]),
  badges: z.record(z.string(), z.string()).default({}),
  excluded: z.array(z.string()).default([]),
  indexHeroes: z.object({
    reviews: indexHeroesPerTypeSchema,
    news: indexHeroesPerTypeSchema,
    guides: indexHeroesPerTypeSchema,
    brands: indexHeroesPerTypeSchema,
    games: indexHeroesPerTypeSchema,
  }).default({ reviews: {}, news: {}, guides: {}, brands: {}, games: {} }),
});

export type DashboardConfig = z.infer<typeof dashboardConfigSchema>;

// WHY: Parse at import time — fail fast with clear Zod error on corrupt JSON.
const dashboardConfig: DashboardConfig = dashboardConfigSchema.parse(dashboardRaw);

// ─── Global pin/badge config (used by all home page sections) ────────────────

export const pinnedSet: Set<string> = new Set(dashboardConfig.pinned);
export const badgesMap: Record<string, string> = dashboardConfig.badges;
export const indexHeroes: DashboardConfig['indexHeroes'] = dashboardConfig.indexHeroes;

// ─── Re-exported types ──────────────────────────────────────────────────────

export interface DashboardMeta {
  isPinned: boolean;
  badgeText: string | null;
}

export interface EnrichedDashboardEntry {
  entry: DashboardEntry;
  meta: DashboardMeta;
}

// ─── Re-exports from pure filter module ─────────────────────────────────────

export const entryKey: (entry: DashboardEntry) => string = entryKeyPure;
export const splitBadge: (text: string, delimiter?: string) => [string, string] = splitBadgePure;
export const sortByPinnedThenDate: (entries: DashboardEntry[], pinnedSet?: Set<string>) => DashboardEntry[] = sortByPinnedThenDatePure;

// ─── Public API ─────────────────────────────────────────────────────────────

/**
 * Build the 15-slot dashboard from all article entries + editorial config.
 * Defaults to the validated content.json config if none provided.
 */
export function buildDashboard(
  allEntries: DashboardEntry[],
  config?: DashboardConfig,
): EnrichedDashboardEntry[] {
  return buildDashboardPure(allEntries, config ?? dashboardConfig);
}
