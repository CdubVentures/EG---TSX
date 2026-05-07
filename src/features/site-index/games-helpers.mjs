// ─── Games helpers — pure logic ─────────────────────────────────────────────
// WHY: .mjs gateway pattern per AGENTS.md — pure logic importable by node --test,
// TS gateway adds types and wires Astro-specific concerns.
// Port of EG-HBS routes/site_index_games.routes.js helpers (lines 24-125, 376-386).

/**
 * Lowercase, replace non-alphanumeric runs with single dashes, trim leading/trailing.
 * Mirrors HBS `slugify(String(s).trim())`.
 * @param {string} s
 * @returns {string}
 */
export function slugifyGenre(s) {
  return String(s ?? '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Convert a slug back to a display label (dashes → spaces, collapsed).
 * Mirrors HBS `_label`.
 * @param {string} s
 * @returns {string}
 */
export function labelFromSlug(s) {
  return String(s ?? '')
    .replace(/-/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Title-case each word in a label.
 * @param {string} s
 * @returns {string}
 */
export function titleCase(s) {
  return labelFromSlug(s).replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Parse a game's genre field into a slug array. Accepts string (comma/pipe/slash
 * delimited), array, or empty/missing. Mirrors HBS `parseGenres`.
 * @param {{ genre?: string | string[] }} rec
 * @returns {string[]}
 */
export function parseGenres(rec) {
  const g = rec?.genre;
  if (Array.isArray(g)) {
    return g.map(slugifyGenre).filter(Boolean);
  }
  if (typeof g === 'string') {
    return g.split(/[,|/]+/g).map(slugifyGenre).filter(Boolean);
  }
  return [];
}

/**
 * Strip extension and responsive size suffix from an image path.
 * Mirrors HBS `stripExtAndSize`.
 * @param {string} p
 * @returns {string}
 */
export function stripExtAndSize(p) {
  if (!p) return '';
  let s = String(p);
  s = s.replace(/\.(?:avif|webp|png|jpe?g|svg)$/i, '');
  s = s.replace(/_(?:xxs|xs|s|m|l|xl|xxl)$/i, '');
  return s;
}

/**
 * Build the box-cover image base path. Falls back to convention.
 * Mirrors HBS `ensureBoxCoverBase`.
 * @param {{ boxCoverArt?: string, gameCover?: string, hero?: string }} rec
 * @param {string} slug
 * @returns {string}
 */
export function ensureBoxCoverBase(rec, slug) {
  const src = rec?.boxCoverArt || rec?.gameCover || '';
  const base = stripExtAndSize(src);
  if (base) {
    return base.startsWith('/') ? base : `/images/games/${slug}/${base}`;
  }
  return `/images/games/${slug}/box-art-cover`;
}

/**
 * Build the hero/dashboard image base path. Falls back to convention.
 * Mirrors HBS `ensureHeroBase` (heroImg → heroAltImg → boxCoverArt → fallback).
 * In TSX schema: hero stem field is `hero`; alt is `heroAlt`; box-art is `boxCoverArt`.
 * @param {{ hero?: string, heroAlt?: string, boxCoverArt?: string }} rec
 * @param {string} slug
 * @returns {string}
 */
export function ensureHeroBase(rec, slug) {
  const src = rec?.hero || rec?.heroAlt || rec?.boxCoverArt || '';
  const base = stripExtAndSize(src);
  if (base) {
    return base.startsWith('/') ? base : `/images/games/${slug}/${base}`;
  }
  return `/images/games/${slug}/hero-img`;
}

/**
 * Convert an Astro game entry into a packed tile object used by every
 * downstream consumer (grid card, dashboard, structured-data).
 * Mirrors HBS `packGame`.
 *
 * @param {{ id: string, data: Record<string, unknown> }} entry
 * @returns {{
 *   slug: string,
 *   name: string,
 *   url: string,
 *   genres: string[],
 *   boxCoverArt: string,
 *   logoBase: string,
 *   logoExt: string,
 *   dashKey: unknown,
 *   iDashboard: string | null,
 *   iFilteredDashboard: string | null,
 * }}
 */
export function packGame(entry) {
  const data = entry?.data ?? {};
  const slug = String(entry?.id ?? '').trim();
  const name = String(
    data.title ?? data.game ?? slug,
  ).trim();
  const genres = parseGenres(data);
  return {
    slug,
    name,
    url: `/games/${slug}/`,
    genres,
    boxCoverArt: ensureBoxCoverBase(data, slug),
    logoBase: ensureHeroBase(data, slug),
    logoExt: 'webp',
    dashKey: data.gameDashboard ?? data.typeDashboard ?? data.dashboard ?? null,
    iDashboard: typeof data.iDashboard === 'string' ? data.iDashboard : null,
    iFilteredDashboard: typeof data.iFilteredDashboard === 'string' ? data.iFilteredDashboard : null,
  };
}

/**
 * Tally games per genre. Empty-genre games are bucketed as "misc" (HBS parity).
 * @param {Array<{ genres?: string[] }>} games
 * @returns {Map<string, number>}
 */
export function buildGenreCounts(games) {
  const map = new Map();
  for (const g of games) {
    const arr = Array.isArray(g.genres) && g.genres.length > 0 ? g.genres : ['misc'];
    for (const key of arr) {
      map.set(key, (map.get(key) || 0) + 1);
    }
  }
  return map;
}

/**
 * TSX uses `publish: true` (defaults true) as the visibility gate (HBS used `fullArticle`).
 * @param {{ data?: { publish?: boolean } }} entry
 * @returns {boolean}
 */
export function isPublishedGame(entry) {
  const v = entry?.data?.publish;
  return v !== false;
}

/**
 * Pick the OG/hero image URL for the page. Prefers first dashboard tile, falls
 * back to first list item. Mirrors HBS `pickOgImage` (returns absolute URL when
 * siteOrigin given, otherwise relative).
 * @param {Array<{ logoBase: string, logoExt?: string }>|undefined} dashboard
 * @param {Array<{ boxCoverArt: string }>|undefined} list
 * @param {string} [siteOrigin='']
 * @returns {string}
 */
export function pickOgImage(dashboard, list, siteOrigin = '') {
  const dashFirst = Array.isArray(dashboard) && dashboard[0] ? dashboard[0] : null;
  if (dashFirst?.logoBase) {
    const rel = `${dashFirst.logoBase}_xl.${dashFirst.logoExt || 'webp'}`;
    return /^https?:\/\//i.test(rel) ? rel : `${siteOrigin}${rel}`;
  }
  const first = (Array.isArray(list) && list[0]) || null;
  if (!first?.boxCoverArt) return '';
  const rel = `${first.boxCoverArt}_xl.webp`;
  return /^https?:\/\//i.test(rel) ? rel : `${siteOrigin}${rel}`;
}
