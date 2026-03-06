import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';

// ─── Helper: build minimal HAST nodes ───────────────────────────────────
function text(value) {
  return { type: 'text', value };
}

function el(tagName, children = []) {
  return { type: 'element', tagName, properties: {}, children };
}

function root(children) {
  return { type: 'root', children };
}

// ─── countWords — table-driven ──────────────────────────────────────────
describe('countWords()', () => {
  const cases = [
    {
      name: 'empty tree',
      tree: root([]),
      expected: 0,
    },
    {
      name: 'simple paragraph',
      tree: root([el('p', [text('hello world')])]),
      expected: 2,
    },
    {
      name: 'heading + paragraph',
      tree: root([
        el('h2', [text('Build Quality')]),
        el('p', [text('The mouse is great.')]),
      ]),
      expected: 6,
    },
    {
      name: 'code block excluded',
      tree: root([el('pre', [el('code', [text('const x = 1;')])])]),
      expected: 0,
    },
    {
      name: 'nested inline elements counted',
      tree: root([
        el('p', [text('The '), el('strong', [text('bold')]), text(' mouse')]),
      ]),
      expected: 3,
    },
    {
      name: 'mixed: paragraphs counted, pre skipped',
      tree: root([
        el('p', [text('Hello')]),
        el('pre', [text('skip')]),
        el('p', [text('world')]),
      ]),
      expected: 2,
    },
    {
      name: 'list items counted',
      tree: root([
        el('ul', [
          el('li', [text('Item one')]),
          el('li', [text('Item two')]),
        ]),
      ]),
      expected: 4,
    },
    {
      name: 'multiple spaces collapsed',
      tree: root([el('p', [text('  hello   world  ')])]),
      expected: 2,
    },
    {
      name: 'table cells counted',
      tree: root([
        el('table', [
          el('tr', [
            el('td', [text('Cell one')]),
            el('th', [text('Header two')]),
          ]),
        ]),
      ]),
      expected: 4,
    },
    {
      name: 'blockquote counted',
      tree: root([
        el('blockquote', [el('p', [text('quoted text here')])]),
      ]),
      expected: 3,
    },
    {
      name: 'figcaption counted',
      tree: root([
        el('figure', [
          el('img', []),
          el('figcaption', [text('A caption')]),
        ]),
      ]),
      expected: 2,
    },
    {
      name: 'script and style excluded',
      tree: root([
        el('script', [text('var x = 1;')]),
        el('style', [text('.foo { color: red; }')]),
        el('p', [text('visible text')]),
      ]),
      expected: 2,
    },
    {
      name: 'svg excluded',
      tree: root([
        el('svg', [el('text', [text('SVG label')])]),
        el('p', [text('paragraph')]),
      ]),
      expected: 1,
    },
    {
      name: 'deeply nested link inside paragraph',
      tree: root([
        el('p', [
          text('Click '),
          el('a', [el('em', [text('this link')])]),
          text(' now'),
        ]),
      ]),
      expected: 4,
    },
  ];

  for (const { name, tree, expected } of cases) {
    it(name, async () => {
      const { countWords } = await import('../word-counter.ts');
      assert.equal(countWords(tree), expected);
    });
  }
});

// ─── Module exports ─────────────────────────────────────────────────────
describe('word-counter module exports', () => {
  it('exports countWords function', async () => {
    const mod = await import('../word-counter.ts');
    assert.equal(typeof mod.countWords, 'function');
  });
});
