// ─── getImageWithFallback — Boundary Tests ──────────────────────────────────
// Validates the fallback chain: try views in order, return first match or null.
//
// WHY: defaultImageView and listThumbKeyBase are now arrays (fallback chains).
// getImageWithFallback composes getImage() over the chain.

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { getImageWithFallback, getImage } from '../src/core/media.ts';

// ─── Factories ──────────────────────────────────────────────────────────────

function makeMedia({ images = [], colors = [], defaultColor = null, editions = [] } = {}) {
  return { defaultColor, colors, editions, images };
}

function makeImage(view, stem = view, extra = {}) {
  return { stem, view, ...extra };
}

// ═══════════════════════════════════════════════════════════════════════════
// getImageWithFallback()
// ═══════════════════════════════════════════════════════════════════════════

describe('getImageWithFallback()', () => {
  it('returns first view when it exists', () => {
    const media = makeMedia({
      images: [makeImage('top'), makeImage('left')],
    });
    const result = getImageWithFallback(media, ['top', 'left']);
    assert.equal(result.view, 'top');
  });

  it('falls back to second view when first is missing', () => {
    const media = makeMedia({
      images: [makeImage('left'), makeImage('sangle')],
    });
    const result = getImageWithFallback(media, ['top', 'left', 'sangle']);
    assert.equal(result.view, 'left');
  });

  it('falls back to third view when first two are missing', () => {
    const media = makeMedia({
      images: [makeImage('sangle')],
    });
    const result = getImageWithFallback(media, ['top', 'left', 'sangle']);
    assert.equal(result.view, 'sangle');
  });

  it('returns null when no views match', () => {
    const media = makeMedia({
      images: [makeImage('front')],
    });
    const result = getImageWithFallback(media, ['top', 'left', 'sangle']);
    assert.equal(result, null);
  });

  it('returns null for empty views array', () => {
    const media = makeMedia({
      images: [makeImage('top')],
    });
    const result = getImageWithFallback(media, []);
    assert.equal(result, null);
  });

  it('returns null for empty media images', () => {
    const media = makeMedia({ images: [] });
    const result = getImageWithFallback(media, ['top', 'left']);
    assert.equal(result, null);
  });

  it('single-element array behaves like old string API', () => {
    const media = makeMedia({
      images: [makeImage('top', 'my-top-stem')],
    });
    const fallback = getImageWithFallback(media, ['top']);
    const direct = getImage(media, 'top');
    assert.deepEqual(fallback, direct);
  });

  it('passes color parameter through correctly', () => {
    const media = makeMedia({
      colors: ['black', 'white'],
      defaultColor: 'black',
      images: [
        makeImage('top', 'top---black', { color: 'black' }),
        makeImage('top', 'top---white', { color: 'white' }),
        makeImage('left', 'left'),
      ],
    });
    const result = getImageWithFallback(media, ['top', 'left'], 'white');
    assert.equal(result.stem, 'top---white');
  });

  it('falls back to next view if color-specific image not available for first view', () => {
    const media = makeMedia({
      colors: ['black', 'white'],
      defaultColor: 'black',
      images: [
        makeImage('top', 'top---black', { color: 'black' }),
        makeImage('left', 'left'),
      ],
    });
    // getImage falls back to colorless or default — 'top' exists (black),
    // so getImage('top', 'white') will return the black one as fallback.
    // This is correct — getImage handles color fallback internally.
    const result = getImageWithFallback(media, ['top', 'left'], 'white');
    assert.ok(result !== null);
    assert.equal(result.view, 'top');
  });

  it('returns correct stem from matched view', () => {
    const media = makeMedia({
      images: [makeImage('sangle', 'my-product-sangle')],
    });
    const result = getImageWithFallback(media, ['right', 'top', 'sangle']);
    assert.equal(result.stem, 'my-product-sangle');
    assert.equal(result.view, 'sangle');
  });
});
