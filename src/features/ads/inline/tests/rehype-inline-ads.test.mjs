import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';

// ─── Helpers: build HAST trees for testing ──────────────────────────────

function text(value) {
  return { type: 'text', value };
}

function el(tagName, children = []) {
  return { type: 'element', tagName, properties: {}, children };
}

function root(children) {
  return { type: 'root', children };
}

function mdxElement(name, children = []) {
  return { type: 'mdxJsxFlowElement', name, attributes: [], children };
}

/**
 * Create a fake VFile with frontmatter data.
 * Astro stores collection info in file.data.astro.frontmatter
 * and the file path in file.history.
 */
function makeVFile(opts = {}) {
  const { collection = 'reviews', inlineAds } = opts;
  return {
    history: [`/content/${collection}/test-article/index.mdx`],
    data: {
      astro: {
        frontmatter: {
          ...(inlineAds !== undefined ? { inlineAds } : {}),
        },
      },
    },
  };
}

/** Count nodes of a specific type/name in the tree's top-level children. */
function countInlineAds(tree) {
  return tree.children.filter(
    n => n.type === 'mdxJsxFlowElement' && n.name === 'InlineAd'
  ).length;
}

// ─── rehypeInlineAds ────────────────────────────────────────────────────

describe('rehypeInlineAds()', () => {
  it('injects ads into a review article with enough content', async () => {
    const { rehypeInlineAds } = await import('../rehype-inline-ads.ts');

    // 12 paragraphs of ~40 words each = ~480 words
    const paragraphs = Array.from({ length: 12 }, (_, i) =>
      el('p', [text(`This is paragraph ${i + 1} with enough words to count. `.repeat(4))])
    );
    const tree = root(paragraphs);
    const file = makeVFile({ collection: 'reviews' });

    const plugin = rehypeInlineAds();
    plugin(tree, file);

    const adCount = countInlineAds(tree);
    assert.ok(adCount > 0, `Expected ads to be injected, got ${adCount}`);
  });

  it('does not inject when collection is disabled', async () => {
    const { rehypeInlineAds } = await import('../rehype-inline-ads.ts');

    const paragraphs = Array.from({ length: 12 }, (_, i) =>
      el('p', [text(`Paragraph ${i + 1} with some words. `.repeat(4))])
    );
    const tree = root(paragraphs);
    const file = makeVFile({ collection: 'games' });

    const plugin = rehypeInlineAds();
    plugin(tree, file);

    assert.equal(countInlineAds(tree), 0);
  });

  it('does not inject when frontmatter inlineAds: false', async () => {
    const { rehypeInlineAds } = await import('../rehype-inline-ads.ts');

    const paragraphs = Array.from({ length: 12 }, (_, i) =>
      el('p', [text(`Paragraph ${i + 1} with some words. `.repeat(4))])
    );
    const tree = root(paragraphs);
    const file = makeVFile({ collection: 'reviews', inlineAds: false });

    const plugin = rehypeInlineAds();
    plugin(tree, file);

    assert.equal(countInlineAds(tree), 0);
  });

  it('does not inject into empty article', async () => {
    const { rehypeInlineAds } = await import('../rehype-inline-ads.ts');

    const tree = root([]);
    const file = makeVFile({ collection: 'reviews' });

    const plugin = rehypeInlineAds();
    plugin(tree, file);

    assert.equal(countInlineAds(tree), 0);
  });

  it('does not inject into short article (below minFirstAdWords)', async () => {
    const { rehypeInlineAds } = await import('../rehype-inline-ads.ts');

    // 3 short paragraphs ~30 words total
    const tree = root([
      el('p', [text('Short intro paragraph.')]),
      el('p', [text('Another brief paragraph.')]),
      el('p', [text('Final short paragraph.')]),
    ]);
    const file = makeVFile({ collection: 'reviews' });

    const plugin = rehypeInlineAds();
    plugin(tree, file);

    assert.equal(countInlineAds(tree), 0);
  });

  it('respects manual InlineAd placement', async () => {
    const { rehypeInlineAds } = await import('../rehype-inline-ads.ts');

    // 15 paragraphs with manual ad at index 5 (after 5 paragraphs)
    const children = [];
    for (let i = 0; i < 15; i++) {
      children.push(el('p', [text(`Paragraph ${i + 1} with enough text to count words. `.repeat(5))]));
      if (i === 4) {
        children.push(mdxElement('InlineAd'));
      }
    }
    const tree = root(children);
    const file = makeVFile({ collection: 'reviews' });

    const manualBefore = countInlineAds(tree);
    const plugin = rehypeInlineAds();
    plugin(tree, file);

    const totalAds = countInlineAds(tree);
    // Should have at least the manual one, plus some auto-injected
    assert.ok(totalAds >= manualBefore, `Expected at least ${manualBefore} ads, got ${totalAds}`);
  });

  it('does not inject inside skip zones', async () => {
    const { rehypeInlineAds } = await import('../rehype-inline-ads.ts');

    // Mix of paragraphs and skip zones
    const children = [];
    for (let i = 0; i < 15; i++) {
      if (i === 5) {
        children.push(el('pre', [el('code', [text('const x = 1;')])]));
      } else if (i === 8) {
        children.push(el('table', [el('tr', [el('td', [text('cell')])])]));
      } else {
        children.push(el('p', [text(`Paragraph ${i + 1} with enough text for word counting. `.repeat(4))]));
      }
    }
    const tree = root(children);
    const file = makeVFile({ collection: 'reviews' });

    const plugin = rehypeInlineAds();
    plugin(tree, file);

    // Verify no InlineAd was inserted adjacent-inside a skip zone
    // (they should only appear between top-level blocks)
    for (const child of tree.children) {
      if (child.type === 'element' && (child.tagName === 'pre' || child.tagName === 'table')) {
        const hasAd = child.children?.some(
          c => c.type === 'mdxJsxFlowElement' && c.name === 'InlineAd'
        );
        assert.ok(!hasAd, `InlineAd found inside ${child.tagName}`);
      }
    }
  });

  it('headings count as anchors', async () => {
    const { rehypeInlineAds } = await import('../rehype-inline-ads.ts');

    // Mix of headings and paragraphs, enough for ads
    const children = [];
    for (let i = 0; i < 10; i++) {
      if (i % 3 === 0) {
        children.push(el('h2', [text(`Section ${i}`)]));
      } else {
        children.push(el('p', [text(`Content paragraph ${i} with more words to reach threshold. `.repeat(5))]));
      }
    }
    const tree = root(children);
    const file = makeVFile({ collection: 'guides' });

    const plugin = rehypeInlineAds();
    plugin(tree, file);

    const adCount = countInlineAds(tree);
    assert.ok(adCount > 0, 'Expected ads even with heading-heavy content');
  });
});

// ─── Module exports ─────────────────────────────────────────────────────
describe('rehype-inline-ads module exports', () => {
  it('exports rehypeInlineAds function', async () => {
    const mod = await import('../rehype-inline-ads.ts');
    assert.equal(typeof mod.rehypeInlineAds, 'function');
  });
});
