// Type declarations for hub-tools-filter.mjs

export const TOOL_PRIORITY: readonly string[];

export function filterHubTools<T extends { category: string; enabled: boolean }>(
  tools: T[],
  activeCategories: string[],
): T[];

export function sortDesktopTools<T extends { tool: string; category: string }>(
  tools: T[],
  categoryOrder?: string[],
): T[];

export function groupMobileTools<T extends { tool: string; category: string }>(
  tools: T[],
  categoryOrder?: string[],
): { category: string; tools: T[] }[];
