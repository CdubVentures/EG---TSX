// ─── Brand dashboard 6-slot selector — pure logic ───────────────────────────
// WHY: .mjs so node --test can import without Astro transpilation.
// Gateway: select-brand-dashboard.ts re-exports with TS types.
//
// Algorithm (mirrors selectDashboard for articles):
// 1. Config overrides (highest priority — manual editorial picks)
// 2. iDashboard / iFilteredDashboard slot pins
// 3. Sort remaining by date descending (newest first)
// 4. Category-diverse fill (all-view: prefer unseen categories first)
// 5. Return up to 6

/**
 * Get the first matching category from the preferred order.
 * @param {{ categories: string[] }} brand
 * @param {string[]} categories
 * @returns {string}
 */
function primaryCat(brand, categories) {
  if (!Array.isArray(brand.categories) || brand.categories.length === 0) return '';
  for (const cat of categories) {
    if (brand.categories.includes(cat)) return cat;
  }
  return brand.categories[0];
}

/**
 * Select up to 6 brands for the dashboard.
 *
 * @param {{ brands: Array, categorySlug: string, categories: string[], overrides?: string[] }} opts
 * @returns {Array} up to 6 BrandTileItems
 */
export function selectBrandDashboard({ brands, categorySlug, categories, overrides }) {
  if (!brands || brands.length === 0) return [];

  const cat = (categorySlug || '').trim().toLowerCase();
  const inCat = (b) => !cat || (Array.isArray(b.categories) && b.categories.includes(cat));

  // Filter to eligible brands
  const eligible = brands.filter(inCat);
  if (eligible.length === 0) return [];

  const result = [];
  const usedSlugs = new Set();

  // Step 1: Config overrides (highest priority)
  if (overrides && overrides.length > 0) {
    for (const slug of overrides) {
      if (result.length >= 6) break;
      const match = eligible.find(b => b.slug === slug);
      if (match && !usedSlugs.has(match.slug)) {
        result.push(match);
        usedSlugs.add(match.slug);
      }
    }
    if (result.length >= 6) return result;
  }

  // Step 2: iDashboard / iFilteredDashboard pins
  // These target specific slots, so we use an indexed approach then merge
  const pinnedSlots = Array(6).fill(null);

  if (!cat) {
    for (const b of eligible) {
      if (!b.iDashboard || usedSlugs.has(b.slug)) continue;
      const m = /^all_([1-6])$/.exec(String(b.iDashboard).trim().toLowerCase());
      if (m) {
        const slot = +m[1] - 1;
        if (!pinnedSlots[slot]) {
          pinnedSlots[slot] = b;
        }
      }
    }
  } else {
    for (const b of eligible) {
      if (!b.iFilteredDashboard || usedSlugs.has(b.slug)) continue;
      const m = /^([a-z0-9_-]+)_([1-6])$/.exec(String(b.iFilteredDashboard).trim().toLowerCase());
      if (m && m[1] === cat) {
        const slot = +m[2] - 1;
        if (!pinnedSlots[slot]) {
          pinnedSlots[slot] = b;
        }
      }
    }
  }

  // Merge pinned into result — fill from slot 0 upward, skipping slots already taken by overrides
  for (const b of pinnedSlots) {
    if (!b || usedSlugs.has(b.slug)) continue;
    if (result.length >= 6) break;
    result.push(b);
    usedSlugs.add(b.slug);
  }

  if (result.length >= 6) return result;

  // Step 3: Sort remaining by date descending (newest first)
  const unpinned = eligible
    .filter(b => !usedSlugs.has(b.slug))
    .sort((a, b) => {
      const dateCmp = (b.sortDate || '').localeCompare(a.sortDate || '');
      return dateCmp !== 0 ? dateCmp : a.slug.localeCompare(b.slug);
    });

  // Step 4: Fill remaining slots with category diversity (all-view) or simple fill (category view)
  if (!cat) {
    const usedCats = new Set(result.map(b => primaryCat(b, categories)));

    // First pass: prefer brands from unseen categories
    for (const b of unpinned) {
      if (result.length >= 6) break;
      const pc = primaryCat(b, categories);
      if (!usedCats.has(pc)) {
        result.push(b);
        usedSlugs.add(b.slug);
        usedCats.add(pc);
      }
    }

    // Second pass: fill remaining from any category
    for (const b of unpinned) {
      if (result.length >= 6) break;
      if (usedSlugs.has(b.slug)) continue;
      result.push(b);
      usedSlugs.add(b.slug);
    }
  } else {
    // Category view: simple date-sorted fill
    for (const b of unpinned) {
      if (result.length >= 6) break;
      result.push(b);
      usedSlugs.add(b.slug);
    }
  }

  return result.slice(0, 6);
}
