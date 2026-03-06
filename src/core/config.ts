// ─── Centralized behavioral knobs ───────────────────────────────────────────
// No magic numbers in components. All behavioral constants live here.
// Update here to change behavior site-wide.

import categoriesData from '../../config/data/categories.json';
import imageDefaultsData from '../../config/data/image-defaults.json';
import { resolveImageDefaults, resolveViewObjectFit } from './image-defaults-resolver.mjs';

// ─── Category SSOT ──────────────────────────────────────────────────────────
// WHY: categories.json is the single source of truth for all category lists.
// Each category has independent product + content sub-sections.
// Active = production:true OR (dev-only && vite:true), applied per sub-section.

interface SubSection {
  production: boolean;
  vite: boolean;
}

interface CategoryDef {
  id: string;
  label: string;
  plural: string;
  color: string;
  product: SubSection;
  content: SubSection;
}

const allCategoryDefs: CategoryDef[] = categoriesData.categories as CategoryDef[];
const isDev = import.meta.env.DEV;

function isActive(sub: SubSection): boolean {
  return sub.production || (isDev && sub.vite);
}

const productActiveIds = allCategoryDefs.filter(c => isActive(c.product)).map(c => c.id);
const contentActiveIds = allCategoryDefs.filter(c => isActive(c.content)).map(c => c.id);
const allIds = allCategoryDefs.map(c => c.id);

// Plural lookup (canonical — replaces 4 duplicate functions)
const pluralMap: Record<string, string> = Object.fromEntries(
  allCategoryDefs.map(c => [c.id, c.plural])
);

// Singular label lookup (canonical — replaces titleCase hacks for acronyms like GPU, AI)
const labelMap: Record<string, string> = Object.fromEntries(
  allCategoryDefs.map(c => [c.id, c.label])
);

// Color lookup
const colorMap: Record<string, string> = Object.fromEntries(
  allCategoryDefs.map(c => [c.id, c.color])
);

// Site gradient colors (primary/secondary) — SSOT for seasonal themes
export const siteColors = categoriesData.siteColors;

/** Returns true if the category's product sub-section is active in the current environment. */
export function isProductActive(cat: string): boolean {
  const def = allCategoryDefs.find(c => c.id === cat);
  return def ? isActive(def.product) : false;
}

/** Returns true if the category's content sub-section is active in the current environment. */
export function isContentActive(cat: string): boolean {
  const def = allCategoryDefs.find(c => c.id === cat);
  return def ? isActive(def.content) : false;
}

/** Canonical singular label — use instead of titleCase for category display names. */
export function label(cat: string): string {
  return labelMap[cat] ?? (cat.charAt(0).toUpperCase() + cat.slice(1));
}

/** Canonical plural function — use this everywhere instead of local copies. */
export function plural(cat: string): string {
  return pluralMap[cat] ?? (cat.charAt(0).toUpperCase() + cat.slice(1) + 's');
}

/** Returns the hex color for a category ID, or a fallback grey. */
export function categoryColor(cat: string): string {
  return colorMap[cat] ?? '#6c7086';
}

// ─── Image Defaults ─────────────────────────────────────────────────────────
// WHY: Per-category image config replaces hardcoded view names in components.
// JSON is SSOT; resolver merges category overrides with global defaults.

interface ViewMeta {
  objectFit: 'contain' | 'cover';
  label: string;
  labelShort: string;
}

export interface ImageDefaults {
  defaultImageView: string[];
  listThumbKeyBase: string[];
  coverImageView: string[];
  headerGame: string[];
  viewPriority: string[];
  imageDisplayOptions: Array<{ view: string; labelFull: string; labelShort: string }>;
  viewMeta: Record<string, ViewMeta>;
}

const _imgDefaults = imageDefaultsData.defaults;
const _imgCategories = imageDefaultsData.categories;

/** Resolved image defaults for a category (merges overrides with global defaults). */
export function imageDefaults(category: string): ImageDefaults {
  return resolveImageDefaults(_imgDefaults, _imgCategories, category) as ImageDefaults;
}

/** Get the objectFit for a specific view in a category. Falls back to 'contain'. */
export function viewObjectFit(category: string, view: string): 'contain' | 'cover' {
  return resolveViewObjectFit(_imgDefaults, _imgCategories, category, view) as 'contain' | 'cover';
}

export const CONFIG = {
  site: {
    name: 'Expert Gaming',
    url: import.meta.env.PUBLIC_SITE_URL ?? 'https://expertgaming.gg',
    defaultDescription: 'Hardware reviews, PC builder, and gaming guides.',
  },

  pagination: {
    articlesPerPage: 12,
    hubCardsPerRow: 4,
    commentsPerLoad: 20,
    brandsPerPage: 24,
  },

  timeouts: {
    searchDebounce_ms: 300,
    toastDuration_ms: 3000,
    sessionRefresh_ms: 3_600_000, // 1 hour
  },

  // Score tier thresholds — used by ScoreRing colour logic
  scores: {
    excellent: 85, // green
    good:      70, // yellow
    fair:      50, // orange
    // below fair → poor (red)
  },

  cdn: {
    baseUrl: import.meta.env.CDN_BASE_URL ?? '',
  },

  // Product categories — filtered by environment (product sub-section flags)
  // WHY: replaces hardcoded arrays in GlobalNav, vault, NavMobile, etc.
  categories: productActiveIds as string[],

  // Content categories — filtered by environment (content sub-section flags)
  // WHY: reviews, guides, news filtering use content flags independently of product flags.
  contentCategories: contentActiveIds as string[],

  // All category IDs regardless of flags — for schema validation / data loading
  allCategories: allIds as string[],

  // Game genres
  genres: [
    'fps', 'battle-royale', 'moba', 'rts', 'mmo', 'rpg',
    'sports', 'racing', 'fighting', 'strategy',
  ] as const,
} as const;

// WHY: empty CDN_BASE_URL in production means all image URLs resolve as relative paths
if (import.meta.env.PROD && !CONFIG.cdn.baseUrl) {
  console.warn('[EG] CDN_BASE_URL is not set — images will use relative paths');
}

// WHY allCategories: Zod schemas and data files need to validate ALL category IDs,
// not just the currently active ones. A mousepad product JSON must validate even
// when mousepad is production:false.
export type Category = (typeof categoriesData.categories)[number]['id'];
export type Genre = typeof CONFIG.genres[number];
