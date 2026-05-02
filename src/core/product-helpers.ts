/**
 * Product URL helpers.
 * Constructs snapshot page URLs from product data.
 */

import { productUrlFromImagePath } from './seo/url-contract';

/**
 * Construct the snapshot URL for a product.
 * Format: /hubs/{category}/{brandSlug}/{modelSlug}
 *
 * WHY imagePath: The image path folder structure
 * `images/products/{category}/{brand}/{model}` already contains the correct
 * brand slug and model slug as separate path segments — no string
 * manipulation needed.
 */
export function productUrl(product: {
  slug: string;
  category: string;
  imagePath: string;
}): string {
  return productUrlFromImagePath({
    category: product.category,
    imagePath: product.imagePath,
    fallbackSlug: product.slug,
  });
}
