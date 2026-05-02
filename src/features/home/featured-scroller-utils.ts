// ─── Featured Scroller Utilities ──────────────────────────────────────────────
// Pure functions for transforming article entries into FeaturedItem shape,
// grouping by category, and determining active category tabs.
// Used by FeaturedScroller.astro for both "Featured Reviews" and "Highlighted Guides".

import { articleUrl, resolveHero, articleSrcSet, formatArticleDate } from '@core/article-helpers';
import type { DashboardEntry } from '@core/article-helpers';
import { label as categoryLabel } from '@core/category-contract';

export interface FeaturedItem {
  id: string;
  _compositeKey: string;
  url: string;
  title: string;
  description: string;
  category: string;
  categoryLabel: string;
  heroPath: string;
  srcset: string;
  dateFormatted: string;
  egbadge?: string;
  heroStyle?: string;
  isPinned: boolean;
  overall?: number;
}

// WHY: Config-driven pins/badges from content.json override frontmatter values.
// content.json is the editorial SSOT — frontmatter is the fallback.
export interface PinBadgeConfig {
  pinnedSet?: Set<string>;
  badgesMap?: Record<string, string>;
}

/** Transform a tagged article entry into a FeaturedItem for the scroller. */
export function toFeaturedItem(entry: DashboardEntry, config?: PinBadgeConfig): FeaturedItem {
  const collection = entry._collection;
  const heroStem = entry.data.hero as string | undefined;
  const heroPath = heroStem ? resolveHero(collection, entry.id, heroStem) : '';
  const srcset = heroPath ? articleSrcSet(heroPath) : '';
  const category = (entry.data.category as string) ?? '';
  const key = `${collection}:${entry.id}`;

  return {
    id: entry.id,
    _compositeKey: key,
    url: articleUrl(collection, entry.id),
    title: entry.data.title,
    description: (entry.data.description as string) ?? '',
    category,
    categoryLabel: category ? categoryLabel(category) : '',
    heroPath,
    srcset,
    dateFormatted: formatArticleDate(
      entry.data.datePublished as Date | undefined,
      entry.data.dateUpdated as Date | undefined,
    ),
    heroStyle: (entry.data.heroStyle as string | undefined) ?? undefined,
    egbadge: config?.badgesMap?.[key] ?? (entry.data.egbadge as string | undefined),
    isPinned: config?.pinnedSet?.has(key) ?? ((entry.data.pinned as boolean | undefined) ?? false),
  };
}

/** Group FeaturedItems by their category field. Items without a category are excluded. */
export function groupByCategory(items: FeaturedItem[]): Record<string, FeaturedItem[]> {
  const groups: Record<string, FeaturedItem[]> = {};
  for (const item of items) {
    if (!item.category) continue;
    if (!groups[item.category]) groups[item.category] = [];
    groups[item.category]!.push(item);
  }
  return groups;
}

/**
 * Returns category IDs that have items, in the order defined by allCategoryIds.
 * Categories not in allCategoryIds are excluded even if they have items.
 */
export function getActiveCategories(
  itemsByCategory: Record<string, FeaturedItem[]>,
  allCategoryIds: string[],
): string[] {
  return allCategoryIds.filter(id => (itemsByCategory[id]?.length ?? 0) > 0);
}
