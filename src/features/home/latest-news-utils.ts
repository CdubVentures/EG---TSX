// ─── Latest News Utilities ──────────────────────────────────────────────────
// Pure slicing functions for the LatestNews component.
// Top grid shows first 4 items (2×2). Bottom feed shows items [4..19] (max 16).
// Inline ad inserts after the 8th feed item (feed index 7).

import type { FeaturedItem } from './featured-scroller-utils';

const TOP_GRID_LIMIT = 4;
const BOTTOM_FEED_MAX = 16;
const AD_INSERT_THRESHOLD = 8;

/** First 4 items for the top 2×2 grid. Returns fewer if input has < 4. */
export function newsTopGridItems(items: FeaturedItem[]): FeaturedItem[] {
  return items.slice(0, TOP_GRID_LIMIT);
}

/** Items [4..19] for the bottom horizontal feed. Max 16 items. */
export function newsBottomFeedItems(items: FeaturedItem[]): FeaturedItem[] {
  return items.slice(TOP_GRID_LIMIT, TOP_GRID_LIMIT + BOTTOM_FEED_MAX);
}

/** Feed index for inline ad insertion. Returns 7 if feed has ≥ 8 items, -1 otherwise. */
export function newsAdInsertIndex(feedLength: number): number {
  return feedLength >= AD_INSERT_THRESHOLD ? AD_INSERT_THRESHOLD - 1 : -1;
}
