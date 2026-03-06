/**
 * word-counter.ts — HAST text node word counter.
 *
 * Counts whitespace-separated words in content-bearing elements.
 * Skips code blocks, scripts, styles, and SVGs.
 * Pure function — no DOM, no Astro dependency.
 */

// ─── Types (minimal HAST subset for testability without hast dep) ────────

interface HastText {
  type: 'text';
  value: string;
}

interface HastElement {
  type: 'element';
  tagName: string;
  children?: HastNode[];
}

interface HastRoot {
  type: 'root';
  children: HastNode[];
}

type HastNode = HastText | HastElement | HastRoot | { type: string; children?: HastNode[] };

// ─── Skip set — content inside these is not counted ─────────────────────

const SKIP_TAGS = new Set(['pre', 'code', 'script', 'style', 'svg']);

// ─── Public API ─────────────────────────────────────────────────────────

/** Count words in text nodes of content-bearing HAST elements. */
export function countWords(tree: HastNode): number {
  let count = 0;
  walk(tree, false);
  return count;

  function walk(node: HastNode, skip: boolean): void {
    // Text node — count if not inside a skip zone
    if (node.type === 'text' && !skip) {
      const words = (node as HastText).value.trim().split(/\s+/);
      // WHY: ''.split(/\s+/) returns [''] — guard against empty string
      count += words.filter(w => w.length > 0).length;
      return;
    }

    // Element node — check if entering a skip zone
    if (node.type === 'element') {
      const el = node as HastElement;
      const nowSkip = skip || SKIP_TAGS.has(el.tagName);
      if (el.children) {
        for (const child of el.children) {
          walk(child, nowSkip);
        }
      }
      return;
    }

    // Root or other container — recurse into children
    const children = (node as { children?: HastNode[] }).children;
    if (children) {
      for (const child of children) {
        walk(child, skip);
      }
    }
  }
}
