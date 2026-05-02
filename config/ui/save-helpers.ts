/**
 * save-helpers.ts — Pure functions for global save orchestration.
 *
 * Extracted from app.tsx so save logic is testable without React.
 */

/** Canonical panel save order — matches Tk _on_save() iteration order. */
export const PANEL_ORDER: readonly string[] = [
  'Categories',
  'Content',
  'Index Heroes',
  'Hub Tools',
  'Navbar',
  'Slideshow',
  'Image Defaults',
  'Cache / CDN',
  'Ads',
] as const;

/**
 * Given a map of panel key → dirty boolean, returns the keys
 * of all dirty panels in canonical PANEL_ORDER.
 */
export function buildSaveQueue(dirtyMap: Record<string, boolean>): string[] {
  return PANEL_ORDER.filter((key) => dirtyMap[key] === true);
}

/** Returns true when at least one panel has unsaved changes. */
export function hasDirtyPanels(dirtyPanels: string[]): boolean {
  return dirtyPanels.length > 0;
}
