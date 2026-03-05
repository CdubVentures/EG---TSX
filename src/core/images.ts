// ─── Image URL Resolver ─────────────────────────────────────────────────────
// The ONLY place in the codebase that constructs image URLs.
// Components import these functions — they never concatenate paths manually.
// See: docs/DATA-IMAGE-CONTRACT.md

import { CONFIG } from './config';

export type ImageSize = 'blur' | 't' | 'xs' | 's' | 'm' | 'l' | 'xl' | 'xxl' | 'zoom';

// ─── Universal Resolver ─────────────────────────────────────────────────────
// ONE function for ALL image types. Takes a base path, stem, size, and
// optional extension (defaults to webp; brands use png).

/** Build any image URL: basePath + stem + size + extension */
export function contentImage(basePath: string, stem: string, size: ImageSize, ext: string = 'webp'): string {
  return `${CONFIG.cdn.baseUrl}${basePath}/${stem}_${size}.${ext}`;
}

// ─── Convention Helper ──────────────────────────────────────────────────────
// Derives the image base path from a collection name + entry ID.
// Convention: /images/{collection}/{entryId}
// Works for games, brands, guides, news, reviews — anything where
// the image folder matches the content filename.

/** Derive image base path from collection + Astro entry ID */
export function collectionImagePath(collection: string, entryId: string): string {
  return `/images/${collection}/${entryId}`;
}
