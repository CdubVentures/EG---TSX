// â”€â”€â”€ Pure filter + sort for article content collections â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// WHY: Extracted so node:test can verify the logic without Astro's getCollection.
// The gateway (content.ts) composes: getCollection + this filter.
//
// Filter rules (applied in order):
//   1. publish !== false  (exclude stubs)
//   2. draft !== true         (exclude drafts)
//   3. If entry has category â†’ must be in activeContentCategories
//   4. Sort by datePublished descending (nulls last)

/**
 * Filter and sort article entries by content visibility rules.
 * @param {Array<{id: string, data: object}>} entries - Astro collection entries
 * @param {string[]} activeContentCategories - Active content category IDs from CONFIG
 * @returns {Array<{id: string, data: object}>} Filtered and sorted entries
 */
export function isVisibleArticleEntry(entry, activeContentCategories) {
  const active = new Set(activeContentCategories);
  const d = entry.data;

  // Rule 1: exclude stubs
  if (d.publish === false) return false;

  // Rule 2: exclude drafts
  if (d.draft === true) return false;

  // Rule 3: if entry has a category, it must be in the active list
  if ('category' in d && d.category != null) {
    if (!active.has(d.category)) return false;
  }

  return true;
}

function hasNavbarAssignment(entry) {
  const navbar = entry.data.navbar;
  if (Array.isArray(navbar)) {
    return navbar.length > 0;
  }

  return Boolean(navbar);
}

export function filterNavbarEntries(entries, activeContentCategories) {
  return entries.filter((entry) =>
    isVisibleArticleEntry(entry, activeContentCategories) && hasNavbarAssignment(entry)
  );
}

export function filterArticles(entries, activeContentCategories) {
  const filtered = entries.filter((entry) => isVisibleArticleEntry(entry, activeContentCategories));

  // Rule 4: sort by datePublished descending, nulls last
  return filtered.sort((a, b) => {
    const aDate = a.data.datePublished;
    const bDate = b.data.datePublished;
    if (aDate == null && bDate == null) return 0;
    if (aDate == null) return 1;
    if (bDate == null) return -1;
    return bDate.getTime() - aDate.getTime();
  });
}
