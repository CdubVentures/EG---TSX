// ─── Hub Tools Gateway — single point of access for hub tool data ─────────────
// WHY: Components call getHubTools() instead of reading hub-tools.json directly.
// This ensures category flags from categories.json (production/vite toggles)
// are always respected — same pattern as getProducts() in products.ts.
//
// Disable a category in category-manager.py → its tools vanish site-wide.

import hubToolsRaw from '../../config/hub-tools.json';
import { CONFIG, categoryColor } from './config';
import {
  filterHubTools,
  sortDesktopTools,
  groupMobileTools,
} from './hub-tools-filter.mjs';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface HubTool {
  tool: string;
  title: string;
  description: string;
  subtitle: string;
  url: string;
  svg: string;
  enabled: boolean;
  navbar: boolean;
  heroImg: string;
  category: string;
  categoryColor: string;
}

export interface HubToolGroup {
  category: string;
  tools: HubTool[];
}

// ─── Parse raw JSON into flat tool list with category field ──────────────────

const SPECIAL_KEYS = new Set(['_tooltips', '_index']);

function parseRawTools(): HubTool[] {
  const tools: HubTool[] = [];
  for (const [key, value] of Object.entries(hubToolsRaw)) {
    if (SPECIAL_KEYS.has(key)) continue;
    if (!Array.isArray(value)) continue;
    for (const entry of value) {
      tools.push({
        ...entry,
        category: key,
        categoryColor: categoryColor(key),
      } as HubTool);
    }
  }
  return tools;
}

const allTools = parseRawTools();

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Desktop tool list: filtered to active categories, sorted by tool priority
 * then category order. Only enabled tools.
 */
export function getDesktopTools(): HubTool[] {
  const filtered = filterHubTools(allTools, CONFIG.categories);
  return sortDesktopTools(filtered, CONFIG.categories) as HubTool[];
}

/**
 * Mobile tool list: filtered to active categories, grouped by category,
 * each group sorted by tool priority. Only enabled tools.
 */
export function getMobileTools(): HubToolGroup[] {
  const filtered = filterHubTools(allTools, CONFIG.categories);
  return groupMobileTools(filtered, CONFIG.categories) as HubToolGroup[];
}

/**
 * Tools for a specific category (e.g., for hub page sidebar).
 * Only enabled tools, sorted by tool priority.
 */
export function getToolsForCategory(catId: string): HubTool[] {
  const catTools = allTools.filter(t => t.category === catId && t.enabled);
  return sortDesktopTools(catTools) as HubTool[];
}

/** Shared tooltip text for a tool type (e.g., 'hub', 'database'). */
export function getToolTooltip(toolType: string): string {
  const tooltips = (hubToolsRaw as Record<string, unknown>)._tooltips as Record<string, string> | undefined;
  return tooltips?.[toolType] ?? '';
}
