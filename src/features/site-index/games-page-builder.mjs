// ─── Games page builder — pure logic ────────────────────────────────────────
// Builds static-path props and full page VMs for /games/, /games/{genre}/,
// /games/{genre}/page/N/. Mirrors the shape of page-builder.mjs but adapts
// for genre buckets (a game can appear in multiple genres) and the
// games-specific dashboard selector.

import { buildPagination } from './build-pagination.mjs';
import {
  buildGenreCounts,
  isPublishedGame,
  packGame,
  pickOgImage,
  titleCase,
  labelFromSlug,
} from './games-helpers.mjs';
import { selectDashboard6 } from './games-dashboard-select.mjs';
import { buildGamesStructuredData } from './games-structured-data.mjs';

/**
 * Sort packed games A→Z by name (locale-aware, case-insensitive).
 * @param {Array<{name: string}>} arr
 * @returns {Array<{name: string}>}
 */
function sortAZ(arr) {
  return arr.slice().sort((a, b) =>
    String(a.name).localeCompare(String(b.name), 'en', { sensitivity: 'base' }),
  );
}

/**
 * Pack + filter a list of game entries into the canonical PackedGame shape.
 * @param {Array<{ id: string, data: object }>} entries
 * @returns {Array<import('./games-helpers.mjs').PackedGame>}
 */
export function packAndFilterGames(entries) {
  return entries
    .filter(isPublishedGame)
    .map(packGame)
    .filter((g) => g.slug && g.name);
}

/**
 * Build static paths for every games URL. Mirrors HBS routes:
 *   /games/                    — all games, page 1
 *   /games/page/N/             — all games, page N
 *   /games/{genre}/            — genre-filtered, page 1
 *   /games/{genre}/page/N/     — genre-filtered, page N
 *
 * @param {{ entries: Array<{id: string, data: object}>, perPage: number }} opts
 * @returns {Array<{ params: { slug: string|undefined }, props: object }>}
 */
export function buildGamesStaticPaths({ entries, perPage }) {
  const all = packAndFilterGames(entries);
  const allAZ = sortAZ(all);
  const counts = buildGenreCounts(all);
  const genreSlugs = Array.from(counts.keys()).sort((a, b) =>
    a.localeCompare(b, 'en', { sensitivity: 'base' }),
  );

  /** @type {Array<[string, Array<typeof all[number]>]>} */
  const buckets = [['', allAZ]];
  for (const genre of genreSlugs) {
    const bucket = allAZ.filter((g) => Array.isArray(g.genres) && g.genres.includes(genre));
    if (bucket.length > 0) buckets.push([genre, bucket]);
  }

  const baseFilterGenres = genreSlugs.map((g) => ({
    key: g,
    label: titleCase(g),
    url: `/games/${g}/`,
    count: counts.get(g) || 0,
    active: false,
  }));

  const paths = [];

  for (const [genre, list] of buckets) {
    const totalPages = Math.max(1, Math.ceil(list.length / perPage));

    for (let page = 1; page <= totalPages; page += 1) {
      let slug;
      if (genre && page > 1) slug = `${genre}/page/${page}`;
      else if (genre) slug = genre;
      else if (page > 1) slug = `page/${page}`;
      else slug = undefined;

      paths.push({
        params: { slug },
        props: {
          genre,
          page,
          totalPages,
          allGames: allAZ,
          pageGames: list,
          allCount: all.length,
          filterGenres: baseFilterGenres.map((fc) => ({ ...fc, active: fc.key === genre })),
          countsMap: counts,
          preferredOrder: genreSlugs,
        },
      });
    }
  }

  return paths;
}

/**
 * Build the full page VM for a games index URL.
 *
 * @param {{
 *   typeLabel: string,
 *   headerDek: string,
 *   siteUrl: string,
 *   perPage: number,
 *   pageProps: object,
 *   now?: Date,
 * }} opts
 * @returns {object}
 */
export function buildGamesPageVm({
  typeLabel,
  headerDek,
  siteUrl,
  perPage,
  pageProps,
  now,
}) {
  const {
    genre,
    page,
    totalPages,
    allGames,
    pageGames,
    allCount,
    filterGenres,
    countsMap,
    preferredOrder,
  } = pageProps;

  // Slice for pagination
  const startIdx = (page - 1) * perPage;
  const sliceForPage = pageGames.slice(startIdx, startIdx + perPage);

  // Dashboard pool: when filtering by genre, pull from the same filtered list
  // (HBS renderGamesIndex uses `list` after filter). Use `allGames` for "all".
  const dashboardPool = genre
    ? allGames.filter((g) => Array.isArray(g.genres) && g.genres.includes(genre))
    : allGames;

  const seedKey = genre ? `/games/${genre}/` : '/games/';
  const dashboardItems = page === 1
    ? selectDashboard6(dashboardPool, {
      genreSlug: genre,
      countsMap,
      preferredOrder,
      seedKey,
      now,
    })
    : [];

  const dashIds = new Set(dashboardItems.map((g) => g.slug));
  const pageItems = page === 1 && dashboardItems.length > 0
    ? sliceForPage.filter((g) => !dashIds.has(g.slug))
    : sliceForPage;

  const baseUrl = genre ? `/games/${genre}` : '/games';
  const pagination = buildPagination({ baseUrl, current: page, total: totalPages });

  const categoryLabel = genre ? labelFromSlug(genre) : '';
  const categoryLabelTitle = genre ? titleCase(genre) : '';
  const heading = genre ? `${categoryLabelTitle} Games` : 'Games';
  const feedHeading = genre ? `${categoryLabelTitle} Games` : `All ${typeLabel}`;

  const breadcrumbs = [
    { label: 'Home', href: '/' },
    { label: 'Games', href: genre || page > 1 ? '/games/' : undefined },
  ];
  if (genre) {
    breadcrumbs.push({
      label: categoryLabelTitle,
      href: page > 1 ? `/games/${genre}/` : undefined,
    });
  }
  if (page > 1) {
    breadcrumbs.push({ label: `Page ${page}` });
  }

  const canonicalUrl = genre
    ? (page > 1 ? `${siteUrl}/games/${genre}/page/${page}/` : `${siteUrl}/games/${genre}/`)
    : (page > 1 ? `${siteUrl}/games/page/${page}/` : `${siteUrl}/games/`);

  const title = genre ? `Games • ${categoryLabelTitle} - EG` : 'Games - EG';
  const description = genre
    ? `Browse ${categoryLabelTitle} games—news, guides, updates and more on EG Gear.`
    : 'Browse all games by genre. Explore news, guides, updates and more on EG Gear.';

  const ogImage = pickOgImage(dashboardItems, allGames, siteUrl);
  const categoryClass = genre ? `${genre}-color` : undefined;

  const structuredData = buildGamesStructuredData({
    siteUrl,
    canonicalUrl,
    title,
    description,
    breadcrumbs,
    items: allGames,
  });

  return {
    seo: { title, description, canonicalUrl, ogImage, structuredData },
    bleed: {
      type: 'games',
      typeLabel,
      category: genre,
      categoryLabel,
      categoryClass,
      page,
      headerDek,
      dashboardItems,
      heading,
      breadcrumbs,
    },
    body: {
      type: 'games',
      heading: feedHeading,
      pageItems,
      pagination,
      filterGenres,
      activeGenre: genre || undefined,
      categoryClass,
      allCount,
    },
  };
}
