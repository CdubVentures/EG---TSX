// ─── TS gateway for games-page-builder ───────────────────────────────────────

import {
  buildGamesStaticPaths as buildGamesStaticPathsPure,
  buildGamesPageVm as buildGamesPageVmPure,
  packAndFilterGames as packAndFilterGamesPure,
} from './games-page-builder.mjs';
import type {
  GameEntryLike,
  PackedGame,
} from './games-helpers';
import type {
  GameStaticPath,
  GameStaticPathProps,
  GamesPageVm,
} from './games-types';

export interface BuildGamesStaticPathsOptions {
  entries: GameEntryLike[];
  perPage: number;
}

export interface BuildGamesPageVmOptions {
  typeLabel: string;
  headerDek: string;
  siteUrl: string;
  perPage: number;
  pageProps: GameStaticPathProps;
  now?: Date;
}

export const packAndFilterGames: (entries: GameEntryLike[]) => PackedGame[] =
  packAndFilterGamesPure as (entries: GameEntryLike[]) => PackedGame[];

export const buildGamesStaticPaths: (
  opts: BuildGamesStaticPathsOptions,
) => GameStaticPath[] = buildGamesStaticPathsPure as (
  opts: BuildGamesStaticPathsOptions,
) => GameStaticPath[];

export const buildGamesPageVm: (opts: BuildGamesPageVmOptions) => GamesPageVm =
  buildGamesPageVmPure as (opts: BuildGamesPageVmOptions) => GamesPageVm;
