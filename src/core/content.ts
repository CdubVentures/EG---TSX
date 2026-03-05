// ─── Content gateway — single point of access for article collections ────────
// WHY: Every component that needs articles calls getArticles() instead of
// raw getCollection(). This ensures content category flags from
// categories.json (production/vite toggles) are always respected,
// and drafts/stubs are excluded consistently.
//
// Disable a content category in category-manager.py → articles vanish site-wide.
//
// Exception: GlobalNav may use raw getCollection() for navbar-specific filtering
// (navbar field assignment), since that is a separate concern from content visibility.

import { getCollection } from 'astro:content';
import { CONFIG } from '@core/config';
import { filterArticles } from './content-filter.mjs';

type ArticleCollection = 'reviews' | 'guides' | 'news' | 'brands' | 'games';

/**
 * Returns filtered, sorted entries for any article collection.
 * Applies: fullArticle, draft, content category flags, datePublished sort.
 */
export async function getArticles(collection: ArticleCollection) {
  const entries = await getCollection(collection);
  return filterArticles(entries, CONFIG.contentCategories);
}

/** Typed convenience — reviews only. */
export async function getReviews() {
  return getArticles('reviews');
}

/** Typed convenience — guides only. */
export async function getGuides() {
  return getArticles('guides');
}

/** Typed convenience — news only. */
export async function getNews() {
  return getArticles('news');
}

/** Typed convenience — brands only. */
export async function getBrands() {
  return getArticles('brands');
}

/** Typed convenience — games only. */
export async function getGames() {
  return getArticles('games');
}
