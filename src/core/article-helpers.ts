// ─── Shared article utilities ────────────────────────────────────────────────
// Used by Dashboard, future article pages, feed scrollers, etc.
// WHY: Centralizes URL construction, hero image resolution, srcset generation,
// and date formatting so every consumer stays consistent.

import { existsSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { collectionImagePath } from './images';

export type ArticleCollection = 'reviews' | 'guides' | 'news' | 'brands' | 'games' | 'pages';

const PUBLIC_ROOT = path.resolve(process.cwd(), 'public');
const HERO_VARIANT_SUFFIX = '_s.webp';
const heroStemCache = new Map<string, string>();

function toPublicDerivativePath(heroPath: string): string {
  return path.join(PUBLIC_ROOT, `${heroPath.replace(/^\//, '')}${HERO_VARIANT_SUFFIX}`);
}

function resolveHeroStem(collection: string, entryId: string, heroStem: string): string {
  const cacheKey = `${collection}:${entryId}:${heroStem}`;
  const cachedStem = heroStemCache.get(cacheKey);
  if (cachedStem) return cachedStem;

  const imageBasePath = collectionImagePath(collection, entryId);
  const directHeroPath = `${imageBasePath}/${heroStem}`;
  if (existsSync(toPublicDerivativePath(directHeroPath))) {
    heroStemCache.set(cacheKey, heroStem);
    return heroStem;
  }

  const imageDir = path.join(PUBLIC_ROOT, imageBasePath.replace(/^\//, ''));
  if (!existsSync(imageDir)) {
    heroStemCache.set(cacheKey, heroStem);
    return heroStem;
  }

  const variantStem = readdirSync(imageDir)
    .filter((name) => name.startsWith(`${heroStem}---`) && name.endsWith(HERO_VARIANT_SUFFIX))
    .sort()[0]
    ?.slice(0, -HERO_VARIANT_SUFFIX.length);

  const resolvedStem = variantStem ?? heroStem;
  heroStemCache.set(cacheKey, resolvedStem);
  return resolvedStem;
}

/** Shared shape for tagged article entries used by Dashboard components. */
export interface DashboardEntry {
  id: string;
  data: {
    title: string;
    description?: string;
    hero?: string;
    category?: string;
    datePublished?: Date;
    dateUpdated?: Date;
    [key: string]: unknown;
  };
  _collection: ArticleCollection;
}

/** Build canonical article URL: /{collection}/{entryId} */
export function articleUrl(collection: ArticleCollection, entryId: string): string {
  return `/${collection}/${entryId}`;
}

/**
 * Resolve a hero image base path from collection + entryId + stem.
 * All hero frontmatter values are stem-only (e.g. "feature-image", "title").
 * Returns the full path WITHOUT size suffix or extension.
 */
export function resolveHero(collection: string, entryId: string, heroStem: string): string {
  const resolvedStem = resolveHeroStem(collection, entryId, heroStem);
  return `${collectionImagePath(collection, entryId)}/${resolvedStem}`;
}

/**
 * Generate a 7-size srcset string for article hero images.
 * Extracted from HomeSlideshow.astro — same size ladder used everywhere.
 * @param heroPath - Full base path (output of resolveHero), no suffix/extension.
 */
export function articleSrcSet(heroPath: string): string {
  const sizes = [
    { suffix: 'xxs', w: 100 },
    { suffix: 'xs', w: 200 },
    { suffix: 's', w: 400 },
    { suffix: 'm', w: 600 },
    { suffix: 'l', w: 800 },
    { suffix: 'xl', w: 1000 },
    { suffix: 'xxl', w: 2000 },
  ];
  return sizes.map(s => `${heroPath}_${s.suffix}.webp ${s.w}w`).join(', ');
}

/**
 * Format article date for display: "Updated | Jan 15, 2025" or "Published | Dec 9, 2024".
 * Port of HBS date display pattern.
 */
export function formatArticleDate(datePublished?: Date | null, dateUpdated?: Date | null): string {
  const date = dateUpdated ?? datePublished;
  if (!date) return '';

  const formatted = new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(date);

  const prefix = dateUpdated ? 'Updated' : 'Published';
  return `${prefix} | ${formatted}`;
}
