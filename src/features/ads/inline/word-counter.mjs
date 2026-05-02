/**
 * word-counter.mjs - HAST text node word counter.
 *
 * Pure logic module for config-safe and node-safe imports.
 */

const SKIP_TAGS = new Set(['pre', 'code', 'script', 'style', 'svg']);

/**
 * Count words in text nodes of content-bearing HAST elements.
 *
 * @param {object} tree
 * @returns {number}
 */
export function countWords(tree) {
  let count = 0;
  walk(tree, false);
  return count;

  /**
   * @param {object} node
   * @param {boolean} skip
   */
  function walk(node, skip) {
    if (node.type === 'text' && !skip) {
      const words = String(node.value ?? '').trim().split(/\s+/);
      count += words.filter((word) => word.length > 0).length;
      return;
    }

    if (node.type === 'element') {
      const nowSkip = skip || SKIP_TAGS.has(node.tagName);
      for (const child of node.children ?? []) {
        walk(child, nowSkip);
      }
      return;
    }

    for (const child of node.children ?? []) {
      walk(child, skip);
    }
  }
}
