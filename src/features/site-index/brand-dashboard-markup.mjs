// ─── Brand dashboard markup renderer — pure logic for testing ────────────────
// WHY: .mjs so node --test can verify the HTML structure without Astro.
// The real component is BrandDashboard.astro; this mirrors its output for tests.

import { brandLogoSrcSet } from './brand-helpers.mjs';

/** HBS-matching sizes attribute for brand logo tiles */
const BRAND_SIZES = [
  '(min-width: 1401px) calc((924px - 32px) / 3)',
  '(min-width: 1151px) calc((100vw - 48px - 300px - 30px - 32px)/3)',
  '(min-width: 901px) calc((100vw - 48px - 200px - 32px)/3)',
  '(min-width: 561px) calc((100vw - 48px - 16px) / 2)',
  'calc(100vw - 48px)',
].join(', ');

/**
 * Render BrandDashboard HTML string (for testing).
 * Mirrors BrandDashboard.astro output structure.
 * @param {Array<{ slug: string, name: string, url: string, logoBase: string }>} items
 * @param {{ categoryClass?: string }} opts
 * @returns {string}
 */
export function renderBrandDashboardMarkup(items, { categoryClass } = {}) {
  if (!items || items.length === 0) return '';

  const catClass = categoryClass ? ` ${categoryClass}` : '';
  const rowsClass = items.length > 3 ? ' u-gridRowsEven' : '';
  const showClass = ' u-show3At1Col';

  const tiles = items.slice(0, 6).map(item => {
    const srcset = brandLogoSrcSet(item.logoBase);
    return `<a href="${item.url}" class="grid-dash__tile${catClass} u-minSizeZero" aria-label="${item.name}"><img loading="eager" fetchpriority="high" decoding="async" src="${item.logoBase}_s.png" srcset="${srcset}" sizes="${BRAND_SIZES}" alt="${item.name} logo" class="brands-dash__logo" /></a>`;
  }).join('');

  return `<section class="moreof-hf${catClass}" data-feed-kind="type-dashboard" data-layout="horizontal"><div class="moreof-hf__grid" data-ad-rail="right"><div class="brands-dash__stageGrid${rowsClass}${showClass}">${tiles}</div></div></section>`;
}
