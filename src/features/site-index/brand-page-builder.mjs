// ─── Brand page builder — pure logic for /brands/ static paths + bleed VM ───
// WHY: .mjs so node --test can import without Astro transpilation.
// Gateway: brand-page-builder.ts re-exports with TS types.

import { packBrand, buildBrandFilterCategories } from './brand-helpers.mjs';
import { selectBrandDashboard } from './select-brand-dashboard.mjs';
import { buildPagination } from './build-pagination.mjs';

/**
 * Capitalize first letter.
 * @param {string} s
 * @returns {string}
 */
function titleCase(s) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/**
 * Build static paths for /brands/ routes.
 * Brands use categories[] for multi-category membership, NOT entry.data.category.
 *
 * @param {{ brands: Array, categories: string[], perPage: number }} opts
 * @returns {Array<{ params: { slug: string | undefined }, props: object }>}
 */
export function buildBrandStaticPaths({ brands, categories, perPage }) {
  const packed = brands.map(b => ({ ...b, _packed: packBrand(b) }));
  const paths = [];

  // All-brands view
  const allTotal = Math.max(1, Math.ceil(brands.length / perPage));
  for (let page = 1; page <= allTotal; page++) {
    paths.push({
      params: { slug: page > 1 ? `page/${page}` : undefined },
      props: {
        brands,
        category: '',
        page,
        totalPages: allTotal,
      },
    });
  }

  // Per-category views — filter via categories.includes(cat)
  for (const cat of categories) {
    const catBrands = brands.filter(b => {
      const cats = b.data?.categories ?? b.categories;
      return Array.isArray(cats) && cats.includes(cat);
    });
    if (catBrands.length === 0) continue;

    const catTotal = Math.max(1, Math.ceil(catBrands.length / perPage));
    for (let page = 1; page <= catTotal; page++) {
      paths.push({
        params: { slug: page > 1 ? `${cat}/page/${page}` : cat },
        props: {
          brands: catBrands,
          category: cat,
          page,
          totalPages: catTotal,
        },
      });
    }
  }

  return paths;
}

/**
 * Build the bleed (hero section) view model for a brand index page.
 *
 * @param {{ brands: Array, category: string, page: number, categoryList: string[], headerDek: string, siteUrl: string, overrides?: string[] }} opts
 * @returns {{ type: string, typeLabel: string, heading: string, headerDek: string, breadcrumbs: Array, categoryClass?: string, page: number, brandDashboardItems: Array }}
 */
export function buildBrandBleedVm({
  brands,
  category,
  page,
  categoryList,
  headerDek,
  siteUrl,
  overrides,
}) {
  const categoryLabel = category ? titleCase(category) : '';
  const heading = category ? `${categoryLabel} Brands` : 'Brands';

  // Breadcrumbs
  const breadcrumbs = [{ label: 'Home', href: '/' }];
  if (category) {
    breadcrumbs.push({ label: 'Brands', href: '/brands/' });
    if (page > 1) {
      breadcrumbs.push({ label: categoryLabel, href: `/brands/${category}/` });
      breadcrumbs.push({ label: `Page ${page}` });
    } else {
      breadcrumbs.push({ label: categoryLabel });
    }
  } else {
    if (page > 1) {
      breadcrumbs.push({ label: 'Brands', href: '/brands/' });
      breadcrumbs.push({ label: `Page ${page}` });
    } else {
      breadcrumbs.push({ label: 'Brands' });
    }
  }

  // Pack brands for dashboard
  const packedBrands = brands.map(packBrand);

  // Dashboard items (page 1 only)
  const brandDashboardItems = page === 1
    ? selectBrandDashboard({
        brands: packedBrands,
        categorySlug: category,
        categories: categoryList,
        overrides,
      })
    : [];

  const categoryClass = category ? `${category}-color` : undefined;

  // Filter categories for sidebar
  const filterCategories = buildBrandFilterCategories(packedBrands, categoryList, category);

  return {
    type: 'brands',
    typeLabel: 'Brands',
    heading,
    headerDek,
    breadcrumbs,
    category,
    categoryLabel,
    categoryClass,
    page,
    brandDashboardItems,
    filterCategories,
  };
}

/**
 * Build the body (A-Z grid) view model for a brand index page.
 * Receives already-packed BrandTileItem[], sorts A-Z, paginates, builds heading.
 *
 * @param {{ brands: Array, page: number, perPage: number, category: string, filterCategories: Array }} opts
 * @returns {{ type: string, typeLabel: string, heading: string, pageItems: Array, allCount: number, pagination: object, filterCategories: Array, activeCategory?: string, categoryClass?: string }}
 */
export function buildBrandBodyVm({ brands, page, perPage, category, filterCategories }) {
  // A-Z sort (case-insensitive)
  const sorted = [...brands].sort((a, b) =>
    a.name.localeCompare(b.name, 'en', { sensitivity: 'base' })
  );

  const allCount = sorted.length;
  const totalPages = Math.max(1, Math.ceil(allCount / perPage));
  const start = (page - 1) * perPage;
  const pageItems = sorted.slice(start, start + perPage);

  const categoryLabel = category ? titleCase(category) : '';
  const heading = category ? `${categoryLabel} Brands` : 'All Brands';

  const baseUrl = category ? `/brands/${category}` : '/brands';
  const pagination = buildPagination({ baseUrl, current: page, total: totalPages });

  return {
    type: 'brands',
    typeLabel: 'Brands',
    heading,
    pageItems,
    allCount,
    pagination,
    filterCategories,
    activeCategory: category || undefined,
    categoryClass: category ? `${category}-color` : undefined,
  };
}
