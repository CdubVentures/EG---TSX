// ─── Pure filter/sort logic for hub tools ─────────────────────────────────────
// WHY: Extracted so node:test can verify the logic without Astro's module system.
// The gateway (hub-tools.ts) composes: JSON import + this filter.
// Same pattern as products-filter.mjs.

/** Desktop sort order: tool type → then category within each type. */
export const TOOL_PRIORITY = ['hub', 'database', 'shapes', 'versus', 'radar'];

/**
 * Filter tools to only active categories and enabled tools.
 * @param {Array<{category: string, enabled: boolean}>} tools
 * @param {string[]} activeCategories
 * @returns {Array<{category: string, enabled: boolean}>}
 */
export function filterHubTools(tools, activeCategories) {
  const active = new Set(activeCategories);
  return tools.filter(t => active.has(t.category) && t.enabled);
}

/**
 * Sort tools for desktop layout: tool type priority first, then category order.
 * Does not mutate input.
 * @param {Array<{tool: string, category: string}>} tools
 * @param {string[]} [categoryOrder] - category IDs in display order
 * @returns {Array<{tool: string, category: string}>}
 */
export function sortDesktopTools(tools, categoryOrder = []) {
  const catIdx = new Map(categoryOrder.map((id, i) => [id, i]));
  return [...tools].sort((a, b) => {
    const aPri = TOOL_PRIORITY.indexOf(a.tool);
    const bPri = TOOL_PRIORITY.indexOf(b.tool);
    const aToolIdx = aPri === -1 ? 999 : aPri;
    const bToolIdx = bPri === -1 ? 999 : bPri;
    if (aToolIdx !== bToolIdx) return aToolIdx - bToolIdx;
    const aCat = catIdx.get(a.category) ?? 999;
    const bCat = catIdx.get(b.category) ?? 999;
    return aCat - bCat;
  });
}

/**
 * Group tools by category for mobile layout.
 * Each group's tools are sorted by tool priority.
 * @param {Array<{tool: string, category: string}>} tools
 * @param {string[]} [categoryOrder] - category IDs in display order
 * @returns {Array<{category: string, tools: Array}>}
 */
export function groupMobileTools(tools, categoryOrder = []) {
  const groups = new Map();
  for (const t of tools) {
    if (!groups.has(t.category)) groups.set(t.category, []);
    groups.get(t.category).push(t);
  }

  // Sort each group's tools by priority
  for (const arr of groups.values()) {
    arr.sort((a, b) => {
      const ai = TOOL_PRIORITY.indexOf(a.tool);
      const bi = TOOL_PRIORITY.indexOf(b.tool);
      return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
    });
  }

  // Order groups by categoryOrder, then remaining alphabetically
  const catIdx = new Map(categoryOrder.map((id, i) => [id, i]));
  const sortedKeys = [...groups.keys()].sort((a, b) => {
    const ai = catIdx.get(a) ?? 999;
    const bi = catIdx.get(b) ?? 999;
    if (ai !== bi) return ai - bi;
    return a.localeCompare(b);
  });

  return sortedKeys.map(cat => ({ category: cat, tools: groups.get(cat) }));
}
