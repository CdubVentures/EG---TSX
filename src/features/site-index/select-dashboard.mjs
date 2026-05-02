// ─── 3-slot dashboard selector — pure logic for site-index hero ──────────────
// WHY: Extracted as .mjs so node --test can import without Astro transpilation.
// Gateway: select-dashboard.ts re-exports with TS types.

/**
 * Newest of datePublished as epoch ms (0 if null/missing).
 * @param {{ datePublished?: Date }} item
 * @returns {number}
 */
function itemDate(item) {
  return item.datePublished?.getTime?.() ?? 0;
}

/**
 * Prefer image-backed items for the dashboard when possible.
 * @param {{ heroPath?: string, srcset?: string }} item
 * @returns {boolean}
 */
function hasHeroMedia(item) {
  return Boolean(item.heroPath || item.srcset);
}

/**
 * Select up to `count` items for the 3-slot index dashboard.
 *
 * Algorithm:
 * 1. If overrides exist, use them (manual editorial picks from config)
 * 2. Otherwise: pinned first (pin-set iteration order), then unpinned by date
 * 3. Category diversity (all-view only): avoid same category in all slots
 * 4. Return up to count items, no duplicates
 *
 * @param {{ items: Array, pinnedSet?: Set<string>, categorySlug?: string, count?: number, overrides?: string[] }} opts
 * @returns {Array}
 */
export function selectDashboard({ items, pinnedSet, categorySlug, count = 3, overrides }) {
  if (!items || items.length === 0) return [];

  const result = [];
  const usedIds = new Set();

  // WHY: Manual overrides from indexHeroes config take priority
  if (overrides && overrides.length > 0) {
    for (const overrideKey of overrides) {
      if (result.length >= count) break;
      // Match by composite key (collection:id) or plain id
      const match = items.find(it =>
        it._compositeKey === overrideKey || it.id === overrideKey
      );
      if (match && !usedIds.has(match.id)) {
        result.push(match);
        usedIds.add(match.id);
      }
    }
    // If overrides gave us enough, return early
    if (result.length >= count) return result;
  }

  // Fall through: fill remaining slots with algorithm (pinned → date → diversity)
  const useDiversity = !categorySlug;
  const pinSet = pinnedSet ?? new Set();

  // Separate pinned items (preserve Set iteration order)
  const pinned = [];
  for (const pinId of pinSet) {
    const match = items.find(it => it.id === pinId || it._compositeKey === pinId);
    if (match && !usedIds.has(match.id)) pinned.push(match);
  }
  const pinnedIds = new Set(pinned.map(p => p.id));

  // Sort unpinned by date descending
  const unpinned = items
    .filter(it => !pinnedIds.has(it.id) && !usedIds.has(it.id))
    .sort((a, b) => {
      const heroDelta = Number(hasHeroMedia(b)) - Number(hasHeroMedia(a));
      if (heroDelta !== 0) return heroDelta;
      return itemDate(b) - itemDate(a);
    });

  // Fill pinned first
  for (const item of pinned) {
    if (result.length >= count) break;
    result.push(item);
    usedIds.add(item.id);
  }

  // Fill remaining from unpinned with optional category diversity
  if (useDiversity) {
    const usedCategories = new Set(result.map(r => r.category));

    // First pass: prefer items from unseen categories
    for (const item of unpinned) {
      if (result.length >= count) break;
      if (usedIds.has(item.id)) continue;
      if (!usedCategories.has(item.category)) {
        result.push(item);
        usedIds.add(item.id);
        usedCategories.add(item.category);
      }
    }

    // Second pass: fill remaining slots from any category
    for (const item of unpinned) {
      if (result.length >= count) break;
      if (usedIds.has(item.id)) continue;
      result.push(item);
      usedIds.add(item.id);
    }
  } else {
    // No diversity — just fill by date
    for (const item of unpinned) {
      if (result.length >= count) break;
      if (usedIds.has(item.id)) continue;
      result.push(item);
      usedIds.add(item.id);
    }
  }

  return result;
}
