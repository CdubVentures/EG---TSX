// ─── Image URL Resolver ─────────────────────────────────────────────────────
// The ONLY place in the codebase that constructs image URLs.
// Components import these functions — they never concatenate paths manually.
// See: docs/06-references/data-image-contract.md

import { CONFIG, imageDefaults } from './config';
import { buildContentImageUrl, normalizeContentImagePath } from './image-path';

export type ImageSize = 'blur' | 't_blur' | 't' | 'xxs' | 'xs' | 's' | 'm' | 'l' | 'xl' | 'xxl' | 'zoom';

// ─── Universal Resolver ─────────────────────────────────────────────────────
// ONE function for ALL image types. Takes a base path, stem, size, and
// optional extension (defaults to webp; brands use png).

/** Build any image URL: basePath + stem + size + extension */
export function contentImage(basePath: string, stem: string, size: ImageSize, ext: string = 'webp'): string {
  return buildContentImageUrl({
    baseUrl: CONFIG.cdn.baseUrl,
    imagePath: basePath,
    stem,
    size,
    ext,
  });
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

// ─── Image Fallback Chain (for React onError handlers) ──────────────────────
// Walks through the category's defaultImageView fallback chain on each error.
// When all fallbacks are exhausted, the global broken-image handler (MainLayout)
// takes over and shows the EG logo placeholder.

/**
 * Call from a React img onError handler. Tries the next view in the
 * category's defaultImageView fallback chain. When exhausted, the global
 * capture-phase handler (MainLayout) will show the EG logo SVG.
 *
 * @param img - The errored HTMLImageElement
 * @param imagePath - Product imagePath (e.g. "/images/mouse/razer/viper-v3-pro")
 * @param category - Product category (e.g. "mouse")
 * @param sizeSuffix - Size suffix including underscore (e.g. "_t" or "_xs")
 * @param originalStem - The stem that was originally attempted (to skip it in the chain)
 */
export function tryImageFallback(
  img: HTMLImageElement,
  imagePath: string,
  category: string,
  sizeSuffix: string,
  originalStem: string,
): void {
  const chain = imageDefaults(category).defaultImageView;
  const tried = new Set((img.dataset.triedViews ?? originalStem).split(','));
  const normalizedImagePath = normalizeContentImagePath(imagePath);

  for (const view of chain) {
    if (!tried.has(view)) {
      tried.add(view);
      img.dataset.triedViews = [...tried].join(',');
      // WHY: global capture-phase handler sets data-fallback + backgroundImage on each error.
      // Reset both so the handler can fire again if this fallback also fails,
      // and so a successful load doesn't show the SVG behind the real image.
      delete img.dataset.fallback;
      img.style.backgroundImage = '';
      img.src = `${normalizedImagePath}/${view}${sizeSuffix}.webp`;
      return;
    }
  }

  // Chain exhausted — don't change src. The global handler already set
  // the EG logo SVG during the capture phase of this same error event.
}
