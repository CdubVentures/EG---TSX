// ─── Centralized behavioral knobs ───────────────────────────────────────────
// No magic numbers in components. All behavioral constants live here.
// Update here to change behavior site-wide.

import imageDefaultsData from '../../config/data/image-defaults.json' with { type: 'json' };
import {
  activeContentCategoryIds,
  activeProductCategoryIds,
  allCategoryIds,
  categoryColor,
  isContentActive,
  isProductActive,
  label,
  plural,
  siteColors,
} from './category-contract.ts';
// Logical dependency retained for config-contract audits: from './category-contract'
import { resolveImageDefaults, resolveViewObjectFit } from './image-defaults-resolver.mjs';

type RuntimeEnvValue = string | boolean | undefined;
type RuntimeEnv = Record<string, RuntimeEnvValue>;

const ASTRO_ENV = ((import.meta as ImportMeta & { env?: RuntimeEnv }).env ?? {}) as RuntimeEnv;

function readEnvValue(name: string): string | undefined {
  const astroValue = ASTRO_ENV[name];
  if (typeof astroValue === 'string') return astroValue;
  if (typeof astroValue === 'boolean') return astroValue ? 'true' : 'false';
  if (typeof process !== 'undefined') return process.env[name];
  return undefined;
}

function isProdRuntime(): boolean {
  const astroProd = ASTRO_ENV.PROD;
  if (typeof astroProd === 'boolean') return astroProd;
  if (typeof astroProd === 'string') return astroProd === 'true';
  return typeof process !== 'undefined' && process.env.NODE_ENV === 'production';
}

function isDevRuntime(): boolean {
  const astroDev = ASTRO_ENV.DEV;
  if (typeof astroDev === 'boolean') return astroDev;
  if (typeof astroDev === 'string') return astroDev === 'true';
  return typeof process !== 'undefined' && process.env.NODE_ENV === 'development';
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
    name: 'EG Gear',
    url: readEnvValue('PUBLIC_SITE_URL') ?? 'https://eggear.com',
    defaultDescription: 'Deep specs, expert reviews, practical guides, and better builds for gaming mice, keyboards, and monitors.',
  },

  pagination: {
    articlesPerPage: 12,
    indexPerPage: 20,
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
    // WHY: local dev should always serve from public/ so missing CDN uploads
    // never hide images during Vite/Astro development.
    baseUrl: isDevRuntime() ? '' : (readEnvValue('CDN_BASE_URL') ?? ''),
  },

  // Product categories — filtered by environment (product sub-section flags)
  // WHY: replaces hardcoded arrays in GlobalNav, vault, NavMobile, etc.
  categories: activeProductCategoryIds,

  // Content categories — filtered by environment (content sub-section flags)
  // WHY: reviews, guides, news filtering use content flags independently of product flags.
  contentCategories: activeContentCategoryIds,

  // All category IDs regardless of flags — for schema validation / data loading
  allCategories: allCategoryIds,

  // Game genres
  genres: [
    'fps', 'battle-royale', 'moba', 'rts', 'mmo', 'rpg',
    'sports', 'racing', 'fighting', 'strategy',
  ] as const,
} as const;

// WHY: empty CDN_BASE_URL in production means all image URLs resolve as relative paths
if (isProdRuntime() && !CONFIG.cdn.baseUrl) {
  console.warn('[EG] CDN_BASE_URL is not set — images will use relative paths');
}

// WHY allCategories: Zod schemas and data files need to validate ALL category IDs,
// not just the currently active ones. A mousepad product JSON must validate even
// when mousepad is production:false.
export type { Category } from './category-contract.ts';
export type Genre = typeof CONFIG.genres[number];
export {
  categoryColor,
  isContentActive,
  isProductActive,
  label,
  plural,
  siteColors,
};
