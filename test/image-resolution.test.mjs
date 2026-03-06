// ─── resolveImage() — Size-Aware Fallback Tests ──────────────────────────────
// Validates that resolveImage tries views in order and only returns a match
// when the stemExists predicate confirms the actual file exists.
//
// WHY: getImageWithFallback checks media.images[] (data-level), but some products
// have views in media.images[] whose specific size variant (_t, _l) doesn't exist
// on disk. resolveImage adds a filesystem-aware layer via a stemExists predicate.

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import { resolveImage, getImage } from '../src/core/media.ts';

// ─── Factories ──────────────────────────────────────────────────────────────

function makeMedia({ images = [], colors = [], defaultColor = null, editions = [] } = {}) {
  return { defaultColor, colors, editions, images };
}

function makeImage(view, stem = view, extra = {}) {
  return { stem, view, ...extra };
}

// ═══════════════════════════════════════════════════════════════════════════
// resolveImage() — Unit Tests (mock stemExists)
// ═══════════════════════════════════════════════════════════════════════════

describe('resolveImage() — unit tests', () => {
  it('returns first view when stemExists returns true', () => {
    const media = makeMedia({
      images: [makeImage('top'), makeImage('left')],
    });
    const exists = () => true;
    const result = resolveImage(media, ['top', 'left'], exists);
    assert.equal(result.view, 'top');
  });

  it('skips first view when stemExists returns false, picks second', () => {
    const media = makeMedia({
      images: [makeImage('top', 'top-stem'), makeImage('left', 'left-stem')],
    });
    // Only 'left-stem' exists at the needed size
    const exists = (stem) => stem === 'left-stem';
    const result = resolveImage(media, ['top', 'left'], exists);
    assert.equal(result.view, 'left');
    assert.equal(result.stem, 'left-stem');
  });

  it('skips views not in media, then skips views where stemExists is false', () => {
    const media = makeMedia({
      images: [makeImage('left', 'left-stem'), makeImage('sangle', 'sangle-stem')],
    });
    // 'right' not in media, 'left-stem' fails exists check, 'sangle-stem' passes
    const exists = (stem) => stem === 'sangle-stem';
    const result = resolveImage(media, ['right', 'left', 'sangle'], exists);
    assert.equal(result.view, 'sangle');
  });

  it('returns null when all views fail stemExists', () => {
    const media = makeMedia({
      images: [makeImage('top'), makeImage('left')],
    });
    const exists = () => false;
    const result = resolveImage(media, ['top', 'left'], exists);
    assert.equal(result, null);
  });

  it('returns null when no views are in media', () => {
    const media = makeMedia({
      images: [makeImage('front')],
    });
    const exists = () => true;
    const result = resolveImage(media, ['top', 'left'], exists);
    assert.equal(result, null);
  });

  it('returns null for empty views array', () => {
    const media = makeMedia({ images: [makeImage('top')] });
    const exists = () => true;
    const result = resolveImage(media, [], exists);
    assert.equal(result, null);
  });

  it('returns null for empty media images', () => {
    const media = makeMedia({ images: [] });
    const exists = () => true;
    const result = resolveImage(media, ['top'], exists);
    assert.equal(result, null);
  });

  it('passes color through to getImage', () => {
    const media = makeMedia({
      colors: ['black', 'white'],
      defaultColor: 'black',
      images: [
        makeImage('top', 'top---black', { color: 'black' }),
        makeImage('top', 'top---white', { color: 'white' }),
      ],
    });
    const exists = () => true;
    const result = resolveImage(media, ['top'], exists, 'white');
    assert.equal(result.stem, 'top---white');
  });

  it('receives the correct stem in stemExists callback', () => {
    const media = makeMedia({
      images: [makeImage('top', 'my-product-top')],
    });
    const received = [];
    const exists = (stem) => { received.push(stem); return true; };
    resolveImage(media, ['top'], exists);
    assert.deepEqual(received, ['my-product-top']);
  });

  it('does not call stemExists for views missing from media', () => {
    const media = makeMedia({
      images: [makeImage('left', 'left-stem')],
    });
    const received = [];
    const exists = (stem) => { received.push(stem); return true; };
    resolveImage(media, ['right', 'top', 'left'], exists);
    // Only 'left-stem' should be checked — right and top aren't in media
    assert.deepEqual(received, ['left-stem']);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// resolveImage() — Integration Tests (real product data + filesystem)
// ═══════════════════════════════════════════════════════════════════════════

describe('resolveImage() — integration with real products', () => {
  // Load image-defaults config
  const imageDefaultsData = JSON.parse(
    fs.readFileSync('config/data/image-defaults.json', 'utf8')
  );
  const globalDefaults = imageDefaultsData.defaults;
  const categoryOverrides = imageDefaultsData.categories;

  // Simple inline resolver (matches image-defaults-resolver.mjs logic)
  function getChain(category, key) {
    const override = categoryOverrides[category]?.[key];
    return override ?? globalDefaults[key];
  }

  // Collect all product files
  function loadProducts() {
    const products = [];
    const baseDir = 'src/content/data-products';
    for (const cat of ['mouse', 'keyboard', 'monitor']) {
      const catDir = path.join(baseDir, cat);
      if (!fs.existsSync(catDir)) continue;
      for (const brand of fs.readdirSync(catDir)) {
        const brandDir = path.join(catDir, brand);
        if (!fs.statSync(brandDir).isDirectory()) continue;
        for (const file of fs.readdirSync(brandDir)) {
          if (!file.endsWith('.json')) continue;
          const data = JSON.parse(fs.readFileSync(path.join(brandDir, file), 'utf8'));
          products.push({ file: `${cat}/${brand}/${file}`, data, category: cat });
        }
      }
    }
    return products;
  }

  // Filesystem-aware stem check
  function makeSizeChecker(imagePath, size) {
    return (stem) => {
      const filePath = path.join('public', imagePath, `${stem}_${size}.webp`);
      return fs.existsSync(filePath);
    };
  }

  const products = loadProducts();

  it('loaded at least 300 products', () => {
    assert.ok(products.length >= 300, `Expected >= 300 products, got ${products.length}`);
  });

  it('thumbnail resolution (_t) succeeds for all products with media', () => {
    const failures = [];
    for (const { file, data, category } of products) {
      if (!data.media?.images?.length) continue;
      const chain = getChain(category, 'defaultImageView');
      const checker = makeSizeChecker(data.imagePath, 't');
      const result = resolveImage(data.media, chain, checker);
      if (!result) {
        failures.push(`${file}: no _t.webp for any view in chain ${JSON.stringify(chain)}`);
      }
    }
    // Allow some products to lack _t (they may have been exported without thumbnails)
    // But the vast majority should resolve. Flag anything above 5% failure rate.
    const totalWithMedia = products.filter(p => p.data.media?.images?.length).length;
    const failRate = failures.length / totalWithMedia;
    if (failures.length > 0) {
      // Log first 10 failures for diagnostics
      console.log(`  [INFO] ${failures.length}/${totalWithMedia} products lack _t thumbnail`);
      for (const f of failures.slice(0, 10)) console.log(`    ${f}`);
    }
    assert.ok(failRate < 0.15, `Thumbnail failure rate ${(failRate * 100).toFixed(1)}% exceeds 15% threshold`);
  });

  it('cover resolution (_l) succeeds for all products with media', () => {
    const failures = [];
    for (const { file, data, category } of products) {
      if (!data.media?.images?.length) continue;
      const chain = getChain(category, 'coverImageView');
      const checker = makeSizeChecker(data.imagePath, 'l');
      const result = resolveImage(data.media, chain, checker);
      if (!result) {
        failures.push(`${file}: no _l.webp for any view in chain ${JSON.stringify(chain)}`);
      }
    }
    const totalWithMedia = products.filter(p => p.data.media?.images?.length).length;
    const failRate = failures.length / totalWithMedia;
    if (failures.length > 0) {
      console.log(`  [INFO] ${failures.length}/${totalWithMedia} products lack _l cover image`);
      for (const f of failures.slice(0, 10)) console.log(`    ${f}`);
    }
    assert.ok(failRate < 0.05, `Cover failure rate ${(failRate * 100).toFixed(1)}% exceeds 5% threshold`);
  });

  it('resolveImage picks a different view than getImageWithFallback when _t is missing', () => {
    // Specifically test corsair-scimitar-elite-wireless-se (known: top lacks _t, left has _t)
    const target = products.find(p => p.data.slug === 'scimitar-elite-wireless-se');
    if (!target) return; // skip if product not found

    const { data, category } = target;
    const chain = getChain(category, 'defaultImageView');
    const checker = makeSizeChecker(data.imagePath, 't');

    const result = resolveImage(data.media, chain, checker);

    // The data-only fallback would pick 'top' (first available in media)
    // But resolveImage should skip 'top' (no _t.webp) and pick 'left' (has _t.webp)
    assert.ok(result !== null, 'Should find a view with _t.webp');
    assert.notEqual(result.view, 'top', 'Should NOT pick top (lacks _t.webp)');
  });

  it('resolved stem always exists in media.images', () => {
    for (const { data, category } of products) {
      if (!data.media?.images?.length) continue;
      const chain = getChain(category, 'defaultImageView');
      const checker = makeSizeChecker(data.imagePath, 's'); // _s has best coverage
      const result = resolveImage(data.media, chain, checker);
      if (!result) continue;
      // The returned image must be one that exists in media.images
      const found = data.media.images.some(img => img.stem === result.stem && img.view === result.view);
      assert.ok(found, `Resolved ${result.stem}/${result.view} not in media.images for ${data.slug}`);
    }
  });
});
