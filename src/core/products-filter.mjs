// ─── Pure filter predicate for product category gating ───────────────────────
// WHY: Extracted so node:test can verify the logic without Astro's getCollection.
// The gateway (products.ts) composes: getCollection + this filter.

/**
 * Filter products to only those whose category is in the active list.
 * @param {Array<{data: {category: string}}>} products
 * @param {string[]} activeCategories
 * @returns {Array<{data: {category: string}}>}
 */
export function filterByActiveCategories(products, activeCategories) {
  const active = new Set(activeCategories);
  return products.filter(p => active.has(p.data.category));
}
