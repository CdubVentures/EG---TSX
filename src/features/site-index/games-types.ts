// ─── Games index types ──────────────────────────────────────────────────────
// Shared shapes used by the games-page-builder, components, and route.

import type { PackedGame } from './games-helpers';
import type { PaginationData } from './build-pagination';

export interface GameFilterGenre {
  key: string;
  label: string;
  url: string;
  count: number;
  active: boolean;
}

export interface GameStaticPathProps {
  genre: string;
  page: number;
  totalPages: number;
  allGames: PackedGame[];      // every published game (used for dashboard pool)
  pageGames: PackedGame[];     // genre-filtered list for this page
  allCount: number;            // total across all genres
  filterGenres: GameFilterGenre[];
  countsMap: Map<string, number>;
  preferredOrder: string[];
}

export interface GameStaticPath {
  params: { slug: string | undefined };
  props: GameStaticPathProps;
}

export interface GamesSeoVm {
  title: string;
  description: string;
  canonicalUrl: string;
  ogImage: string;
  structuredData: object[];
}

export interface GamesBreadcrumb {
  label: string;
  href?: string;
}

export interface GamesBleedVm {
  type: 'games';
  typeLabel: string;
  category: string;             // = active genre slug ('' for all)
  categoryLabel: string;
  categoryClass?: string;
  page: number;
  headerDek: string;
  dashboardItems: PackedGame[];
  heading: string;
  breadcrumbs: GamesBreadcrumb[];
}

export interface GamesBodyVm {
  type: 'games';
  heading: string;
  pageItems: PackedGame[];
  pagination: PaginationData;
  filterGenres: GameFilterGenre[];
  activeGenre?: string;
  categoryClass?: string;
  allCount: number;
}

export interface GamesPageVm {
  seo: GamesSeoVm;
  bleed: GamesBleedVm;
  body: GamesBodyVm;
}
