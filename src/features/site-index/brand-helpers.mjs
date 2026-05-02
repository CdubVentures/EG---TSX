// ─── Brand helpers — pure logic for site-index brand pages ──────────────────
// WHY: .mjs so node --test can import without Astro transpilation.
// Gateway: brand-helpers.ts re-exports with TS types.

/**
 * Transform a brand collection entry into a BrandTileItem.
 * @param {{ id: string, data: { brand: string, displayName?: string, categories?: string[], navbar?: string[], iDashboard?: string, iFilteredDashboard?: string, logoStyle?: string } }} entry
 * @returns {{ slug: string, name: string, url: string, logoBase: string, logoStyle?: string, categories: string[], navbar: string[], iDashboard?: string, iFilteredDashboard?: string }}
 */
export function packBrand(entry) {
  const d = entry.data;
  // WHY: max(datePublished, dateUpdated) — same as article sort_date logic
  const pub = d.datePublished ? String(d.datePublished instanceof Date ? d.datePublished.toISOString().slice(0, 10) : d.datePublished) : '';
  const upd = d.dateUpdated ? String(d.dateUpdated instanceof Date ? d.dateUpdated.toISOString().slice(0, 10) : d.dateUpdated) : '';
  const sortDate = pub > upd ? pub : upd || pub;
  return {
    slug: entry.id,
    name: d.displayName || d.brand,
    url: `/brands/${entry.id}/`,
    logoBase: `/images/brands/${entry.id}/brand-logo-horizontal-index`,
    logoBaseLight: `/images/brands/${entry.id}/brand-logo-horizontal-primary`,
    logoStyle: d.logoStyle || undefined,
    categories: Array.isArray(d.categories) ? d.categories : [],
    navbar: Array.isArray(d.navbar) ? d.navbar : [],
    iDashboard: d.iDashboard || undefined,
    iFilteredDashboard: d.iFilteredDashboard || undefined,
    sortDate: sortDate || undefined,
  };
}

/**
 * Build a 7-size PNG srcset for brand logos.
 * WHY not articleSrcSet(): brands use PNG with smaller widths (100/150/200/250/300/400/500w),
 * not WebP with article widths (100/200/400/600/800/1000/2000w).
 * @param {string} logoBase - e.g. "/images/brands/razer/brand-logo-horizontal-index"
 * @returns {string} srcset string
 */
export function brandLogoSrcSet(logoBase) {
  const sizes = [
    { suffix: 'xxs', w: 100 },
    { suffix: 'xs',  w: 150 },
    { suffix: 's',   w: 200 },
    { suffix: 'm',   w: 250 },
    { suffix: 'l',   w: 300 },
    { suffix: 'xl',  w: 400 },
    { suffix: 'xxl', w: 500 },
  ];
  return sizes.map(s => `${logoBase}_${s.suffix}.png ${s.w}w`).join(', ');
}

/**
 * Count how many brands span each category via categories[].
 * A brand with categories: ['mouse','keyboard'] adds 1 to both counts.
 * @param {Array<{ categories: string[] }>} brands
 * @param {string[]} categoryList
 * @returns {Map<string, number>}
 */
export function buildBrandCategoryCounts(brands, categoryList) {
  const map = new Map();
  for (const key of categoryList) map.set(key, 0);
  for (const b of brands) {
    if (!Array.isArray(b.categories)) continue;
    for (const k of b.categories) {
      if (map.has(k)) map.set(k, map.get(k) + 1);
    }
  }
  return map;
}

/**
 * Build FilterCategory[] for brand index sidebar/chips.
 * @param {Array<{ categories: string[] }>} brands
 * @param {string[]} categoryList
 * @param {string} activeCategory
 * @returns {Array<{ key: string, label: string, url: string, count: number, active: boolean }>}
 */
export function buildBrandFilterCategories(brands, categoryList, activeCategory) {
  const counts = buildBrandCategoryCounts(brands, categoryList);
  const result = [];
  for (const key of categoryList) {
    const count = counts.get(key) || 0;
    if (count === 0) continue;
    result.push({
      key,
      label: key.charAt(0).toUpperCase() + key.slice(1),
      url: `/brands/${key}/`,
      count,
      active: key === activeCategory,
    });
  }
  return result;
}
