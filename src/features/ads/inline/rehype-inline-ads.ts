/**
 * rehype-inline-ads.ts — rehype plugin for auto-injecting inline ads.
 *
 * Walks the HAST tree's top-level children, identifies content anchors,
 * counts words, runs cadence engine, and inserts InlineAd MDX nodes.
 *
 * Does NOT descend into or inject inside any node — only operates
 * on top-level block siblings.
 */

import { INLINE_ADS_CONFIG } from './config';
import { countWords } from './word-counter';
import { calculateInjectionPoints } from './cadence-engine';
import type { CadenceInput } from './cadence-engine';

// ─── Types (minimal HAST subset) ────────────────────────────────────────

interface HastNode {
  type: string;
  tagName?: string;
  name?: string;
  properties?: Record<string, unknown>;
  attributes?: unknown[];
  children?: HastNode[];
  value?: string;
}

interface VFile {
  history: string[];
  data?: {
    astro?: {
      frontmatter?: Record<string, unknown>;
    };
  };
}

// ─── Constants ──────────────────────────────────────────────────────────

/** Top-level elements that count as content anchors for cadence. */
const ANCHOR_TAGS = new Set([
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'p', 'ul', 'ol', 'blockquote', 'figure', 'table',
]);

// ─── Helpers ────────────────────────────────────────────────────────────

/** Detect collection from file path (e.g., /content/reviews/... → "reviews"). */
function detectCollection(file: VFile): string | null {
  const path = file.history[0] ?? '';
  // WHY: Astro content paths follow /content/{collection}/{slug}/index.mdx
  const match = path.match(/\/content\/([^/]+)\//);
  return match ? match[1] : null;
}

/** Check if a top-level node is a content anchor. */
function isAnchor(node: HastNode): boolean {
  if (node.type === 'element' && node.tagName && ANCHOR_TAGS.has(node.tagName)) {
    return true;
  }
  // MDX components count as 1 anchor each (but not InlineAd itself)
  if (node.type === 'mdxJsxFlowElement' && node.name !== 'InlineAd') {
    return true;
  }
  return false;
}

/** Build an InlineAd MDX node for HAST insertion. */
function makeInlineAdNode(): HastNode {
  return {
    type: 'mdxJsxFlowElement',
    name: 'InlineAd',
    attributes: [],
    children: [],
  };
}

// ─── Plugin ─────────────────────────────────────────────────────────────

/** rehype plugin factory. Returns the transformer function. */
export function rehypeInlineAds() {
  return function transformer(tree: HastNode, file: VFile): void {
    // 1. Detect collection
    const collection = detectCollection(file);
    if (!collection) return;

    // 2. Check collection config
    const collectionConfig = INLINE_ADS_CONFIG.collections[collection];
    if (!collectionConfig || !collectionConfig.enabled) return;

    // 3. Check frontmatter override
    const frontmatter = file.data?.astro?.frontmatter ?? {};
    if (frontmatter.inlineAds === false) return;

    // 4. Identify anchors and manual InlineAd positions in top-level children
    const children = tree.children ?? [];
    const anchorIndices: number[] = [];
    const manualAdAnchorPositions: number[] = [];

    // WHY: We track anchor position (not child index) because the cadence
    // engine operates on anchor counts, not raw child indices.
    let anchorPos = 0;
    for (let i = 0; i < children.length; i++) {
      const child = children[i];
      if (isAnchor(child)) {
        anchorIndices.push(i);
        anchorPos++;
      } else if (child.type === 'mdxJsxFlowElement' && child.name === 'InlineAd') {
        // Manual ad — record which anchor position it follows
        manualAdAnchorPositions.push(anchorPos);
      }
    }

    const anchorCount = anchorPos;
    if (anchorCount === 0) return;

    // 5. Count words
    const wordCount = countWords(tree);

    // 6. Calculate injection points (using desktop cadence for now)
    // WHY: desktop cadence determines injection; device gating is handled
    // by InlineAd component's CSS media queries.
    const config = collectionConfig as {
      enabled: true;
      desktop: { firstAfter: number; every: number; max: number };
      wordScaling: { enabled: boolean; desktopWordsPerAd: number; minFirstAdWords: number };
    };

    const cadenceInput: CadenceInput = {
      anchorCount,
      wordCount,
      firstAfter: config.desktop.firstAfter,
      every: config.desktop.every,
      max: config.desktop.max,
      wordsPerAd: config.wordScaling.enabled ? config.wordScaling.desktopWordsPerAd : 0,
      minFirstAdWords: config.wordScaling.enabled ? config.wordScaling.minFirstAdWords : 0,
      manualAdIndices: manualAdAnchorPositions,
    };

    const injectionPoints = calculateInjectionPoints(cadenceInput);
    if (injectionPoints.length === 0) return;

    // 7. Map anchor indices back to child indices for insertion
    // WHY: insert in reverse order to preserve indices.
    const insertions: number[] = injectionPoints
      .map(anchorIdx => anchorIndices[anchorIdx])
      .filter((childIdx): childIdx is number => childIdx !== undefined)
      .sort((a, b) => b - a); // reverse for safe splice

    for (const childIdx of insertions) {
      // Insert AFTER the anchor at childIdx
      children.splice(childIdx + 1, 0, makeInlineAdNode());
    }
  };
}
