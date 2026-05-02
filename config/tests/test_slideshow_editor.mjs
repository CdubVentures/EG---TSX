import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  addToQueue,
  removeFromQueue,
  reorderQueue,
  moveInQueue,
  setMaxSlides,
  clearQueue,
  autoFill,
  parseReleaseDate,
} from '../ui/slideshow-editor.mjs';

// ── Factories ───────────────────────────────────────────────────────────

function makePanel(overrides = {}) {
  return {
    products: [],
    slides: [],
    maxSlides: 10,
    categoryColors: {},
    categoryLabels: {},
    statusRight: '',
    version: 0,
    ...overrides,
  };
}

function makeProduct(overrides = {}) {
  return {
    entryId: 'test-product',
    slug: 'product',
    brand: 'Test',
    model: 'Product',
    category: 'mouse',
    overall: 9.0,
    releaseDate: '03/2025',
    imagePath: '/images/test',
    imageCount: 5,
    hasDeal: false,
    ...overrides,
  };
}

// ── addToQueue ──────────────────────────────────────────────────────────

describe('addToQueue', () => {
  it('appends entryId to end of queue', () => {
    const panel = makePanel({ slides: ['a'], maxSlides: 5 });
    const result = addToQueue(panel, 'b');
    assert.deepStrictEqual(result.slides, ['a', 'b']);
  });

  it('inserts entryId at specified position', () => {
    const panel = makePanel({ slides: ['a', 'c'], maxSlides: 5 });
    const result = addToQueue(panel, 'b', 1);
    assert.deepStrictEqual(result.slides, ['a', 'b', 'c']);
  });

  it('rejects duplicate entryId (returns unchanged)', () => {
    const panel = makePanel({ slides: ['a', 'b'], maxSlides: 5 });
    const result = addToQueue(panel, 'a');
    assert.deepStrictEqual(result.slides, ['a', 'b']);
  });

  it('rejects when queue is at capacity', () => {
    const panel = makePanel({ slides: ['a', 'b'], maxSlides: 2 });
    const result = addToQueue(panel, 'c');
    assert.deepStrictEqual(result.slides, ['a', 'b']);
  });
});

// ── removeFromQueue ─────────────────────────────────────────────────────

describe('removeFromQueue', () => {
  it('removes existing entryId', () => {
    const panel = makePanel({ slides: ['a', 'b', 'c'] });
    const result = removeFromQueue(panel, 'b');
    assert.deepStrictEqual(result.slides, ['a', 'c']);
  });

  it('no-op for nonexistent entryId', () => {
    const panel = makePanel({ slides: ['a', 'b'] });
    const result = removeFromQueue(panel, 'x');
    assert.deepStrictEqual(result.slides, ['a', 'b']);
  });
});

// ── reorderQueue ────────────────────────────────────────────────────────

describe('reorderQueue', () => {
  it('moves item from one position to another', () => {
    const panel = makePanel({ slides: ['a', 'b', 'c'] });
    const result = reorderQueue(panel, 0, 2);
    assert.deepStrictEqual(result.slides, ['b', 'c', 'a']);
  });

  it('no-op for same index', () => {
    const panel = makePanel({ slides: ['a', 'b', 'c'] });
    const result = reorderQueue(panel, 1, 1);
    assert.deepStrictEqual(result.slides, ['a', 'b', 'c']);
  });
});

// ── moveInQueue ─────────────────────────────────────────────────────────

describe('moveInQueue', () => {
  it('swaps item up (direction -1)', () => {
    const panel = makePanel({ slides: ['a', 'b', 'c'] });
    const result = moveInQueue(panel, 1, -1);
    assert.deepStrictEqual(result.slides, ['b', 'a', 'c']);
  });

  it('swaps item down (direction +1)', () => {
    const panel = makePanel({ slides: ['a', 'b', 'c'] });
    const result = moveInQueue(panel, 1, 1);
    assert.deepStrictEqual(result.slides, ['a', 'c', 'b']);
  });

  it('no-op at top boundary (index 0, direction -1)', () => {
    const panel = makePanel({ slides: ['a', 'b', 'c'] });
    const result = moveInQueue(panel, 0, -1);
    assert.deepStrictEqual(result.slides, ['a', 'b', 'c']);
  });

  it('no-op at bottom boundary', () => {
    const panel = makePanel({ slides: ['a', 'b', 'c'] });
    const result = moveInQueue(panel, 2, 1);
    assert.deepStrictEqual(result.slides, ['a', 'b', 'c']);
  });
});

// ── setMaxSlides ────────────────────────────────────────────────────────

describe('setMaxSlides', () => {
  it('sets max within valid range', () => {
    const panel = makePanel({ maxSlides: 10 });
    const result = setMaxSlides(panel, 15);
    assert.equal(result.maxSlides, 15);
  });

  it('clamps to minimum 1', () => {
    const panel = makePanel({ maxSlides: 10 });
    const result = setMaxSlides(panel, 0);
    assert.equal(result.maxSlides, 1);
  });

  it('clamps to maximum 20', () => {
    const panel = makePanel({ maxSlides: 10 });
    const result = setMaxSlides(panel, 25);
    assert.equal(result.maxSlides, 20);
  });

  it('truncates queue when reducing below current length', () => {
    const panel = makePanel({ slides: ['a', 'b', 'c', 'd'], maxSlides: 10 });
    const result = setMaxSlides(panel, 2);
    assert.deepStrictEqual(result.slides, ['a', 'b']);
    assert.equal(result.maxSlides, 2);
  });
});

// ── clearQueue ──────────────────────────────────────────────────────────

describe('clearQueue', () => {
  it('empties the slides array', () => {
    const panel = makePanel({ slides: ['a', 'b', 'c'] });
    const result = clearQueue(panel);
    assert.deepStrictEqual(result.slides, []);
  });
});

// ── autoFill ────────────────────────────────────────────────────────────

describe('autoFill', () => {
  it('fills empty slots with eligible products', () => {
    const products = [
      makeProduct({ entryId: 'p1', overall: 9.0, releaseDate: '01/2025' }),
      makeProduct({ entryId: 'p2', overall: 8.5, releaseDate: '03/2025' }),
    ];
    const panel = makePanel({ products, slides: [], maxSlides: 5 });
    const result = autoFill(panel);
    assert.equal(result.slides.length, 2);
  });

  it('prioritizes products with deals', () => {
    const products = [
      makeProduct({ entryId: 'no-deal', overall: 9.5, releaseDate: '06/2025', hasDeal: false }),
      makeProduct({ entryId: 'has-deal', overall: 8.0, releaseDate: '01/2020', hasDeal: true }),
    ];
    const panel = makePanel({ products, slides: [], maxSlides: 5 });
    const result = autoFill(panel);
    assert.equal(result.slides[0], 'has-deal');
  });

  it('respects score threshold (>= 8.0)', () => {
    const products = [
      makeProduct({ entryId: 'low', overall: 7.9 }),
      makeProduct({ entryId: 'high', overall: 8.0 }),
    ];
    const panel = makePanel({ products, slides: [], maxSlides: 5 });
    const result = autoFill(panel);
    assert.deepStrictEqual(result.slides, ['high']);
  });

  it('enforces max 3 per category', () => {
    const products = [
      makeProduct({ entryId: 'p1', overall: 9.5, category: 'mouse' }),
      makeProduct({ entryId: 'p2', overall: 9.4, category: 'mouse' }),
      makeProduct({ entryId: 'p3', overall: 9.3, category: 'mouse' }),
      makeProduct({ entryId: 'p4', overall: 9.2, category: 'mouse' }),
    ];
    const panel = makePanel({ products, slides: [], maxSlides: 10 });
    const result = autoFill(panel);
    assert.equal(result.slides.length, 3);
    assert.ok(!result.slides.includes('p4'));
  });

  it('skips products already in queue', () => {
    const products = [
      makeProduct({ entryId: 'p1', overall: 9.0 }),
      makeProduct({ entryId: 'p2', overall: 8.5 }),
    ];
    const panel = makePanel({ products, slides: ['p1'], maxSlides: 5 });
    const result = autoFill(panel);
    assert.deepStrictEqual(result.slides, ['p1', 'p2']);
  });

  it('does not exceed maxSlides', () => {
    const products = [
      makeProduct({ entryId: 'p1', overall: 9.0 }),
      makeProduct({ entryId: 'p2', overall: 8.5 }),
      makeProduct({ entryId: 'p3', overall: 8.0 }),
    ];
    const panel = makePanel({ products, slides: ['existing'], maxSlides: 2 });
    const result = autoFill(panel);
    assert.equal(result.slides.length, 2);
  });

  it('sorts by release date desc within same deal status', () => {
    const products = [
      makeProduct({ entryId: 'old', overall: 9.0, releaseDate: '01/2020', hasDeal: false }),
      makeProduct({ entryId: 'new', overall: 9.0, releaseDate: '06/2025', hasDeal: false }),
    ];
    const panel = makePanel({ products, slides: [], maxSlides: 5 });
    const result = autoFill(panel);
    assert.equal(result.slides[0], 'new');
    assert.equal(result.slides[1], 'old');
  });

  it('returns unchanged panel when queue is already full', () => {
    const products = [makeProduct({ entryId: 'p1', overall: 9.0 })];
    const panel = makePanel({ products, slides: ['a', 'b'], maxSlides: 2 });
    const result = autoFill(panel);
    assert.deepStrictEqual(result.slides, ['a', 'b']);
  });
});

// ── parseReleaseDate ────────────────────────────────────────────────────

describe('parseReleaseDate', () => {
  it('parses MM/YYYY format', () => {
    assert.deepStrictEqual(parseReleaseDate('03/2025'), [2025, 3]);
  });

  it('parses year-only string', () => {
    assert.deepStrictEqual(parseReleaseDate('2025'), [2025, 0]);
  });

  it('returns [0, 0] for empty string', () => {
    assert.deepStrictEqual(parseReleaseDate(''), [0, 0]);
  });

  it('returns [0, 0] for null/undefined', () => {
    assert.deepStrictEqual(parseReleaseDate(null), [0, 0]);
    assert.deepStrictEqual(parseReleaseDate(undefined), [0, 0]);
  });
});
