/**
 * media.test.mjs
 *
 * Contract-first tests for src/core/media.ts helper functions.
 * These pure functions consume the structured `media` object from product JSON.
 *
 * Boundary contract:
 *   Input:  ProductMedia { defaultColor, colors, editions, images: ProductImage[] }
 *   Output: Filtered/queried subsets of images, color lists, boolean checks
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

// Will fail until src/core/media.ts is implemented
import {
  getCarouselImages,
  getImage,
  getImageForColor,
  getAvailableColors,
  hasColorVariants,
} from '../src/core/media.ts';

// ─── Test Fixtures ──────────────────────────────────────────────────────────

/** Product with multiple colors (like Pro X Superlight 2) */
function multiColorMedia() {
  return {
    defaultColor: 'black',
    colors: ['black', 'white', 'pink'],
    editions: [],
    images: [
      { stem: 'feature-image', view: 'feature-image' },
      { stem: 'top', view: 'top' },
      { stem: 'top---white', view: 'top', color: 'white' },
      { stem: 'top---pink', view: 'top', color: 'pink' },
      { stem: 'left', view: 'left' },
      { stem: 'left---white', view: 'left', color: 'white' },
      { stem: 'left---pink', view: 'left', color: 'pink' },
      { stem: 'sangle', view: 'sangle' },
      { stem: 'bot', view: 'bot' },
      { stem: 'side', view: 'side' },
    ],
  };
}

/** Product with no colors (like Viper V3 Pro) */
function noColorMedia() {
  return {
    defaultColor: null,
    colors: [],
    editions: [],
    images: [
      { stem: 'feature-image', view: 'feature-image' },
      { stem: 'top', view: 'top' },
      { stem: 'left', view: 'left' },
      { stem: 'sangle', view: 'sangle' },
      { stem: 'side', view: 'side' },
      { stem: 'top', view: 'top' },  // SVG shape
    ],
  };
}

/** Product where ALL images have explicit color tags (no colorless fallback) */
function allTaggedMedia() {
  return {
    defaultColor: 'black',
    colors: ['black', 'white'],
    editions: [],
    images: [
      { stem: 'top---black', view: 'top', color: 'black' },
      { stem: 'top---white', view: 'top', color: 'white' },
      { stem: 'left---black', view: 'left', color: 'black' },
      { stem: 'left---white', view: 'left', color: 'white' },
      { stem: 'side', view: 'side' },
    ],
  };
}

/** Product with editions (like M75 Wireless Cyberpunk edition) */
function editionMedia() {
  return {
    defaultColor: 'black',
    colors: ['black', 'black+red'],
    editions: ['cyberpunk-2077-edition'],
    images: [
      { stem: 'top', view: 'top' },
      { stem: 'top___cyberpunk-2077-edition---black+red', view: 'top', color: 'black+red', edition: 'cyberpunk-2077-edition' },
      { stem: 'left', view: 'left' },
      { stem: 'left___cyberpunk-2077-edition---black+red', view: 'left', color: 'black+red', edition: 'cyberpunk-2077-edition' },
      { stem: 'side', view: 'side' },
    ],
  };
}

/** Product with sequential gallery images */
function galleryMedia() {
  return {
    defaultColor: null,
    colors: [],
    editions: [],
    images: [
      { stem: 'feature-image', view: 'feature-image' },
      { stem: 'top', view: 'top' },
      { stem: 'left', view: 'left' },
      { stem: 'img', view: 'img', seq: 1 },
      { stem: 'img', view: 'img', seq: 2 },
      { stem: 'img', view: 'img', seq: 3 },
      { stem: 'side', view: 'side' },
    ],
  };
}

/** Empty media (no images at all) */
function emptyMedia() {
  return {
    defaultColor: null,
    colors: [],
    editions: [],
    images: [],
  };
}

// ==========================================================================
//  getCarouselImages(media, color?)
// ==========================================================================

describe('getCarouselImages', () => {
  it('returns all non-shape images when no color filter', () => {
    const result = getCarouselImages(multiColorMedia());
    // Should exclude shape views (side, top used as shape)
    // but include all photo views
    assert.ok(result.length > 0, 'should return images');
    const views = result.map(i => i.view);
    assert.ok(!views.includes('side'), 'should exclude side (SVG shape)');
  });

  it('returns default-color images when no color specified on multi-color product', () => {
    const result = getCarouselImages(multiColorMedia());
    // Should get the default (no-color / black) images, not white/pink
    const colorImages = result.filter(i => i.color && i.color !== 'black');
    assert.equal(colorImages.length, 0, 'should not include non-default color images');
  });

  it('returns images for specific color when color filter applied', () => {
    const result = getCarouselImages(multiColorMedia(), 'white');
    // Should include white color images AND colorless images (feature-image, bot, sangle)
    const whiteImages = result.filter(i => i.color === 'white');
    assert.ok(whiteImages.length > 0, 'should include white images');
    // Should NOT include pink images
    const pinkImages = result.filter(i => i.color === 'pink');
    assert.equal(pinkImages.length, 0, 'should not include pink images');
  });

  it('returns all images for no-color product', () => {
    const result = getCarouselImages(noColorMedia());
    assert.ok(result.length > 0, 'should return images');
  });

  it('returns empty array for empty media', () => {
    const result = getCarouselImages(emptyMedia());
    assert.deepEqual(result, []);
  });

  it('includes gallery images (seq) in carousel', () => {
    const result = getCarouselImages(galleryMedia());
    const seqImages = result.filter(i => i.seq !== undefined);
    assert.ok(seqImages.length > 0, 'should include sequenced images');
  });
});

// ==========================================================================
//  getImage(media, view, color?)
// ==========================================================================

describe('getImage', () => {
  it('returns image for matching view', () => {
    const result = getImage(multiColorMedia(), 'top');
    assert.ok(result, 'should find top view');
    assert.equal(result.view, 'top');
  });

  it('returns default (colorless) image when no color specified', () => {
    const result = getImage(multiColorMedia(), 'top');
    assert.ok(result, 'should find image');
    assert.equal(result.color, undefined, 'should return colorless/default image');
  });

  it('returns color-specific image when color specified', () => {
    const result = getImage(multiColorMedia(), 'top', 'white');
    assert.ok(result, 'should find white top');
    assert.equal(result.color, 'white');
    assert.equal(result.view, 'top');
  });

  it('falls back to default when requested color not available for view', () => {
    // 'sangle' only exists without color in the fixture
    const result = getImage(multiColorMedia(), 'sangle', 'white');
    assert.ok(result, 'should fall back to default sangle');
    assert.equal(result.view, 'sangle');
    assert.equal(result.color, undefined, 'should be default (no color)');
  });

  it('returns null for non-existent view', () => {
    const result = getImage(multiColorMedia(), 'rear');
    assert.equal(result, null);
  });

  it('returns null for empty media', () => {
    const result = getImage(emptyMedia(), 'top');
    assert.equal(result, null);
  });

  it('returns default-color image when all images are color-tagged', () => {
    const result = getImage(allTaggedMedia(), 'top');
    assert.ok(result, 'should find top view');
    assert.equal(result.color, 'black', 'should return defaultColor image');
    assert.equal(result.stem, 'top---black');
  });

  it('returns first match for view with multiple sequences', () => {
    const result = getImage(galleryMedia(), 'img');
    assert.ok(result, 'should find img');
    assert.equal(result.view, 'img');
  });
});

// ==========================================================================
//  getImageForColor(media, color, view)
// ==========================================================================

describe('getImageForColor', () => {
  it('returns exact color+view match', () => {
    const result = getImageForColor(multiColorMedia(), 'pink', 'top');
    assert.ok(result, 'should find pink top');
    assert.equal(result.color, 'pink');
    assert.equal(result.view, 'top');
  });

  it('falls back to default color when exact color not available for view', () => {
    // 'bot' only exists without color
    const result = getImageForColor(multiColorMedia(), 'pink', 'bot');
    assert.ok(result, 'should fall back to default');
    assert.equal(result.view, 'bot');
    assert.equal(result.color, undefined);
  });

  it('returns null for non-existent view', () => {
    const result = getImageForColor(multiColorMedia(), 'pink', 'rear');
    assert.equal(result, null);
  });

  it('returns null for empty media', () => {
    const result = getImageForColor(emptyMedia(), 'black', 'top');
    assert.equal(result, null);
  });

  it('works with edition+color images', () => {
    const result = getImageForColor(editionMedia(), 'black+red', 'top');
    assert.ok(result, 'should find black+red top');
    assert.equal(result.color, 'black+red');
  });
});

// ==========================================================================
//  getAvailableColors(media)
// ==========================================================================

describe('getAvailableColors', () => {
  it('returns colors array for multi-color product', () => {
    const result = getAvailableColors(multiColorMedia());
    assert.deepEqual(result, ['black', 'white', 'pink']);
  });

  it('returns empty array for no-color product', () => {
    const result = getAvailableColors(noColorMedia());
    assert.deepEqual(result, []);
  });

  it('returns empty array for empty media', () => {
    const result = getAvailableColors(emptyMedia());
    assert.deepEqual(result, []);
  });

  it('returns colors including edition colors', () => {
    const result = getAvailableColors(editionMedia());
    assert.deepEqual(result, ['black', 'black+red']);
  });
});

// ==========================================================================
//  hasColorVariants(media)
// ==========================================================================

describe('hasColorVariants', () => {
  it('returns true for multi-color product', () => {
    assert.equal(hasColorVariants(multiColorMedia()), true);
  });

  it('returns false for no-color product', () => {
    assert.equal(hasColorVariants(noColorMedia()), false);
  });

  it('returns false for empty media', () => {
    assert.equal(hasColorVariants(emptyMedia()), false);
  });

  it('returns true for product with 2 colors (default + variant)', () => {
    const media = {
      defaultColor: 'black',
      colors: ['black', 'white'],
      editions: [],
      images: [
        { stem: 'top', view: 'top' },
        { stem: 'top---white', view: 'top', color: 'white' },
      ],
    };
    assert.equal(hasColorVariants(media), true);
  });

  it('returns false for product with only 1 color in colors array', () => {
    const media = {
      defaultColor: 'black',
      colors: ['black'],
      editions: [],
      images: [{ stem: 'top', view: 'top' }],
    };
    assert.equal(hasColorVariants(media), false);
  });
});
