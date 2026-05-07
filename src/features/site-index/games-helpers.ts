// ─── TS gateway for games-helpers ────────────────────────────────────────────
// WHY: .mjs gateway pattern per AGENTS.md.

import {
  slugifyGenre as slugifyGenrePure,
  labelFromSlug as labelFromSlugPure,
  titleCase as titleCasePure,
  parseGenres as parseGenresPure,
  stripExtAndSize as stripExtAndSizePure,
  ensureBoxCoverBase as ensureBoxCoverBasePure,
  ensureHeroBase as ensureHeroBasePure,
  packGame as packGamePure,
  buildGenreCounts as buildGenreCountsPure,
  isPublishedGame as isPublishedGamePure,
  pickOgImage as pickOgImagePure,
} from './games-helpers.mjs';

export interface GameEntryLike {
  id: string;
  data: Record<string, unknown> & {
    title?: string;
    game?: string;
    genre?: string | string[];
    hero?: string;
    heroAlt?: string;
    boxCoverArt?: string;
    iDashboard?: string;
    iFilteredDashboard?: string;
    publish?: boolean;
  };
}

export interface PackedGame {
  slug: string;
  name: string;
  url: string;
  genres: string[];
  boxCoverArt: string;
  logoBase: string;
  logoExt: string;
  dashKey: unknown;
  iDashboard: string | null;
  iFilteredDashboard: string | null;
}

export const slugifyGenre: (s: string) => string = slugifyGenrePure;
export const labelFromSlug: (s: string) => string = labelFromSlugPure;
export const titleCase: (s: string) => string = titleCasePure;
export const parseGenres: (rec: { genre?: string | string[] }) => string[] = parseGenresPure;
export const stripExtAndSize: (p: string) => string = stripExtAndSizePure;
export const ensureBoxCoverBase: (rec: Record<string, unknown>, slug: string) => string = ensureBoxCoverBasePure;
export const ensureHeroBase: (rec: Record<string, unknown>, slug: string) => string = ensureHeroBasePure;
export const packGame: (entry: GameEntryLike) => PackedGame = packGamePure as (entry: GameEntryLike) => PackedGame;
export const buildGenreCounts: (games: PackedGame[]) => Map<string, number> = buildGenreCountsPure;
export const isPublishedGame: (entry: GameEntryLike) => boolean = isPublishedGamePure;
export const pickOgImage: (
  dashboard: PackedGame[] | undefined,
  list: PackedGame[] | undefined,
  siteOrigin?: string,
) => string = pickOgImagePure;
