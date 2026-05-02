import categoriesData from '../../config/data/categories.json' with { type: 'json' };

export interface CategoryToggle {
  production: boolean;
  vite: boolean;
}

export interface CategoryCollections {
  dataProducts: boolean;
  reviews: boolean;
  guides: boolean;
  news: boolean;
}

export interface CategoryDef {
  id: string;
  label: string;
  plural: string;
  color: string;
  product: CategoryToggle;
  content: CategoryToggle;
  collections: CategoryCollections;
}

interface SiteColors {
  primary: string;
  secondary: string;
}

interface CategoriesConfig {
  siteColors: SiteColors;
  categories: CategoryDef[];
}

export type CategoryCollection = keyof CategoryCollections;
export type Category = CategoryDef['id'];

const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;
const COLLECTION_KEYS = ['dataProducts', 'reviews', 'guides', 'news'] as const;

function assertObject(value: unknown, label: string): asserts value is Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`[category-contract] ${label} must be an object`);
  }
}

function assertToggle(value: unknown, label: string): asserts value is CategoryToggle {
  assertObject(value, label);

  for (const key of ['production', 'vite'] as const) {
    if (typeof value[key] !== 'boolean') {
      throw new Error(`[category-contract] ${label}.${key} must be boolean`);
    }
  }
}

function assertCollections(value: unknown, label: string): asserts value is CategoryCollections {
  assertObject(value, label);

  for (const key of COLLECTION_KEYS) {
    if (typeof value[key] !== 'boolean') {
      throw new Error(`[category-contract] ${label}.${key} must be boolean`);
    }
  }
}

function assertCategoryDef(value: unknown, index: number): asserts value is CategoryDef {
  assertObject(value, `categories[${index}]`);

  const id = value.id;
  const label = value.label;
  const plural = value.plural;
  const color = value.color;

  if (typeof id !== 'string' || id.length === 0) {
    throw new Error(`[category-contract] categories[${index}].id must be a non-empty string`);
  }

  if (typeof label !== 'string' || label.length === 0) {
    throw new Error(`[category-contract] ${id}.label must be a non-empty string`);
  }

  if (typeof plural !== 'string' || plural.length === 0) {
    throw new Error(`[category-contract] ${id}.plural must be a non-empty string`);
  }

  if (typeof color !== 'string' || !HEX_COLOR.test(color)) {
    throw new Error(`[category-contract] ${id}.color must be a 6-digit hex value`);
  }

  assertToggle(value.product, `${id}.product`);
  assertToggle(value.content, `${id}.content`);
  assertCollections(value.collections, `${id}.collections`);
}

function assertCategoryConfig(value: unknown): asserts value is CategoriesConfig {
  assertObject(value, 'categories.json');
  assertObject(value.siteColors, 'siteColors');

  if (typeof value.siteColors.primary !== 'string' || !HEX_COLOR.test(value.siteColors.primary)) {
    throw new Error('[category-contract] siteColors.primary must be a 6-digit hex value');
  }

  if (typeof value.siteColors.secondary !== 'string' || !HEX_COLOR.test(value.siteColors.secondary)) {
    throw new Error('[category-contract] siteColors.secondary must be a 6-digit hex value');
  }

  if (!Array.isArray(value.categories) || value.categories.length === 0) {
    throw new Error('[category-contract] categories must be a non-empty array');
  }

  const seen = new Set<string>();
  value.categories.forEach((category, index) => {
    assertCategoryDef(category, index);

    if (seen.has(category.id)) {
      throw new Error(`[category-contract] duplicate category id "${category.id}"`);
    }

    seen.add(category.id);
  });
}

function fallbackTitleCase(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function isActive(toggle: CategoryToggle, isDev: boolean): boolean {
  return toggle.production || (isDev && toggle.vite);
}

function toEnumValues(ids: readonly string[], label: string): [string, ...string[]] {
  if (ids.length === 0) {
    throw new Error(`[category-contract] ${label} must contain at least one category`);
  }

  return [...ids] as [string, ...string[]];
}

assertCategoryConfig(categoriesData);

const isDev = import.meta.env?.DEV === true;
const categoryDefs = categoriesData.categories.map((category) => ({
  ...category,
  product: { ...category.product },
  content: { ...category.content },
  collections: { ...category.collections },
}));
const categoryById = Object.fromEntries(
  categoryDefs.map((category) => [category.id, category])
) as Record<string, CategoryDef>;

function idsForCollection(collection: CategoryCollection): string[] {
  return categoryDefs
    .filter((category) => category.collections[collection])
    .map((category) => category.id);
}

export const siteColors = { ...categoriesData.siteColors } as const;
export const allCategoryDefs = categoryDefs;
export const allCategoryIds = categoryDefs.map((category) => category.id);
export const activeProductCategoryIds = categoryDefs
  .filter((category) => isActive(category.product, isDev))
  .map((category) => category.id);
export const activeContentCategoryIds = categoryDefs
  .filter((category) => isActive(category.content, isDev))
  .map((category) => category.id);
export const collectionCategoryIds = {
  dataProducts: idsForCollection('dataProducts'),
  reviews: idsForCollection('reviews'),
  guides: idsForCollection('guides'),
  news: idsForCollection('news'),
} as const;
export const collectionEnumValues = {
  dataProducts: toEnumValues(collectionCategoryIds.dataProducts, 'dataProducts'),
  reviews: toEnumValues(collectionCategoryIds.reviews, 'reviews'),
  guides: toEnumValues(collectionCategoryIds.guides, 'guides'),
  news: toEnumValues(collectionCategoryIds.news, 'news'),
} as const;

export function isProductActive(categoryId: string): boolean {
  const category = categoryById[categoryId];
  return category ? isActive(category.product, isDev) : false;
}

export function isContentActive(categoryId: string): boolean {
  const category = categoryById[categoryId];
  return category ? isActive(category.content, isDev) : false;
}

export function label(categoryId: string): string {
  return categoryById[categoryId]?.label ?? fallbackTitleCase(categoryId);
}

export function plural(categoryId: string): string {
  return categoryById[categoryId]?.plural ?? `${fallbackTitleCase(categoryId)}s`;
}

export function categoryColor(categoryId: string): string {
  return categoryById[categoryId]?.color ?? '#6c7086';
}
