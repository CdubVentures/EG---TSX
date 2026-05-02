import type { DashboardEntry } from './article-helpers';

export interface DashboardFilterMeta {
  isPinned: boolean;
  badgeText: string | null;
}

export interface DashboardFilterSlotRef {
  collection: string;
  id: string;
}

export interface DashboardFilterConfig {
  slots?: Record<string, DashboardFilterSlotRef>;
  pinned?: string[];
  badges?: Record<string, string>;
  excluded?: string[];
}

export interface DashboardFilterResult {
  entry: DashboardEntry;
  meta: DashboardFilterMeta;
}

export const NUM_SLOTS: number;

export function entryKey(entry: DashboardEntry): string;

export function splitBadge(
  text: string | null | undefined,
  delimiter?: string,
): [string, string];

export function sortByPinnedThenDate(
  entries: DashboardEntry[],
  pinnedSet?: Set<string>,
): DashboardEntry[];

export function buildDashboard(
  allEntries: DashboardEntry[],
  config?: DashboardFilterConfig,
): DashboardFilterResult[];
