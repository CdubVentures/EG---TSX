// ─── Dashboard config gateway — editorial slot control, pins, badges ─────────
// WHY: The dashboard-manager GUI writes config/data/dashboard.json with manual
// slot assignments, pin flags, badge text, and exclusions. This module reads
// that config and applies the production algorithm (same as simulate_dashboard()
// in dashboard-manager.pyw) to produce the final ordered dashboard entries.

import { z } from 'zod';
import type { DashboardEntry } from './article-helpers';
import {
  buildDashboard as buildDashboardPure,
  entryKey as entryKeyPure,
  splitBadge as splitBadgePure,
} from './dashboard-filter.mjs';
import dashboardRaw from '../../config/data/dashboard.json';

// ─── Zod schema ─────────────────────────────────────────────────────────────

const slotRefSchema = z.object({
  collection: z.string(),
  id: z.string(),
});

const dashboardConfigSchema = z.object({
  slots: z.record(z.string(), slotRefSchema).default({}),
  pinned: z.array(z.string()).default([]),
  badges: z.record(z.string(), z.string()).default({}),
  excluded: z.array(z.string()).default([]),
});

export type DashboardConfig = z.infer<typeof dashboardConfigSchema>;

// WHY: Parse at import time — fail fast with clear Zod error on corrupt JSON.
const dashboardConfig: DashboardConfig = dashboardConfigSchema.parse(dashboardRaw);

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

// ─── Public API ─────────────────────────────────────────────────────────────

/**
 * Build the 15-slot dashboard from all article entries + editorial config.
 * Defaults to the validated dashboard.json config if none provided.
 */
export function buildDashboard(
  allEntries: DashboardEntry[],
  config?: DashboardConfig,
): EnrichedDashboardEntry[] {
  return buildDashboardPure(allEntries, config ?? dashboardConfig);
}
