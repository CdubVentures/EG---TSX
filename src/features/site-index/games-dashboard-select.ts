// ─── TS gateway for games-dashboard-select ───────────────────────────────────

import {
  selectDashboard6 as selectDashboard6Pure,
  buildDaySeed as buildDaySeedPure,
} from './games-dashboard-select.mjs';
import type { PackedGame } from './games-helpers';

export interface SelectDashboard6Options {
  genreSlug?: string;
  countsMap?: Map<string, number>;
  preferredOrder?: string[];
  seedKey?: string;
  now?: Date;
}

export const selectDashboard6: (
  list: PackedGame[],
  opts?: SelectDashboard6Options,
) => PackedGame[] = selectDashboard6Pure as (
  list: PackedGame[],
  opts?: SelectDashboard6Options,
) => PackedGame[];

export const buildDaySeed: (
  seedKey: string,
  gen: string,
  now?: Date,
) => number = buildDaySeedPure;
