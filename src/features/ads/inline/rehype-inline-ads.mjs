import { INLINE_ADS_CONFIG } from './config.mjs';
import { countWords } from './word-counter.mjs';
import { calculateInjectionPoints } from './cadence-engine.mjs';

const ANCHOR_TAGS = new Set([
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'p', 'ul', 'ol', 'blockquote', 'figure', 'table',
]);

/**
 * @param {{ history: string[] }} file
 * @returns {string | null}
 */
function detectCollection(file) {
  const currentPath = file.history[0] ?? '';
  const match = currentPath.match(/\/content\/([^/]+)\//);
  return match ? match[1] : null;
}

/**
 * @param {object} node
 * @returns {boolean}
 */
function isAnchor(node) {
  if (node.type === 'element' && node.tagName && ANCHOR_TAGS.has(node.tagName)) {
    return true;
  }

  if (node.type === 'mdxJsxFlowElement' && node.name !== 'InlineAd') {
    return true;
  }

  return false;
}

function makeInlineAdNode() {
  return {
    type: 'mdxJsxFlowElement',
    name: 'InlineAd',
    attributes: [],
    children: [],
  };
}

export function rehypeInlineAds() {
  return function transformer(tree, file) {
    const collection = detectCollection(file);
    if (!collection) return;

    const collectionConfig = INLINE_ADS_CONFIG.collections[collection];
    if (!collectionConfig || !collectionConfig.enabled) return;

    const frontmatter = file.data?.astro?.frontmatter ?? {};
    if (frontmatter.inlineAds === false) return;

    const children = tree.children ?? [];
    const anchorIndices = [];
    const manualAdAnchorPositions = [];

    let anchorPos = 0;
    for (let index = 0; index < children.length; index += 1) {
      const child = children[index];
      if (isAnchor(child)) {
        anchorIndices.push(index);
        anchorPos += 1;
      } else if (child.type === 'mdxJsxFlowElement' && child.name === 'InlineAd') {
        manualAdAnchorPositions.push(anchorPos);
      }
    }

    if (anchorPos === 0) return;

    const wordCount = countWords(tree);
    const cadenceInput = {
      anchorCount: anchorPos,
      wordCount,
      firstAfter: collectionConfig.desktop.firstAfter,
      every: collectionConfig.desktop.every,
      max: collectionConfig.desktop.max,
      wordsPerAd: collectionConfig.wordScaling.enabled
        ? collectionConfig.wordScaling.desktopWordsPerAd
        : 0,
      minFirstAdWords: collectionConfig.wordScaling.enabled
        ? collectionConfig.wordScaling.minFirstAdWords
        : 0,
      manualAdIndices: manualAdAnchorPositions,
    };

    const injectionPoints = calculateInjectionPoints(cadenceInput);
    if (injectionPoints.length === 0) return;

    const insertions = injectionPoints
      .map((anchorIndex) => anchorIndices[anchorIndex])
      .filter((childIndex) => childIndex !== undefined)
      .sort((left, right) => right - left);

    for (const childIndex of insertions) {
      children.splice(childIndex + 1, 0, makeInlineAdNode());
    }
  };
}
