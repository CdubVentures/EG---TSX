// ─── Product gateway — single point of access for product data ───────────────
// WHY: Every component that needs products calls getProducts() instead of
// raw getCollection('dataProducts'). This ensures category flags from
// categories.json (production/vite toggles) are always respected.
//
// Disable a category in category-manager.py → products vanish site-wide.

import { getCollection } from 'astro:content';
import { CONFIG } from '@core/config';
import { filterByActiveCategories } from './products-filter.mjs';

/**
 * Returns all products whose category is currently active.
 * Active = production:true, or (dev mode && vite:true) in categories.json.
 */
export async function getProducts() {
  const all = await getCollection('dataProducts');
  return filterByActiveCategories(all, CONFIG.categories);
}
