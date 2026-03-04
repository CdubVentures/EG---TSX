/**
 * data-image-resolution.test.mjs
 *
 * Integration tests proving the Dual Source of Truth contract:
 * ONE object provides BOTH data fields AND image paths that resolve to real files on disk.
 *
 * Tests all three content types that combine data + images:
 *   1. Products  — individual JSON files → media.images + imagePath → files on disk
 *   2. Games     — content collection → slug → /images/games/{slug}/ → files on disk
 *   3. Brands    — content collection → slug → /images/brands/{slug}/ → files on disk
 *   4. Reviews   — frontmatter productId → matches a real product slug in JSON
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { resolve, basename, relative, join } from 'node:path';
import matter from 'gray-matter';

const ROOT = resolve(import.meta.dirname, '..');
const PUBLIC = resolve(ROOT, 'public');

// --- Helpers ---

function loadFrontmatter(absPath) {
  const raw = readFileSync(absPath, 'utf-8');
  return matter(raw).data;
}

function listContentFiles(relDir) {
  const dir = resolve(ROOT, relDir);
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { recursive: true })
    .filter(f => f.endsWith('.md') || f.endsWith('.mdx'))
    .map(f => resolve(dir, f));
}

/**
 * Derive the slug (entry ID) from a content file path.
 * Handles both flat files (slug.md) and slug-folders (slug/index.md).
 */
function slugFromContentPath(filePath, collectionBase) {
  const rel = relative(resolve(ROOT, collectionBase), filePath).replace(/\\/g, '/');
  return rel.replace(/\.(md|mdx)$/, '').replace(/\/index$/, '');
}

// --- Load product data from individual JSON files ---

function loadAllProducts() {
  const products = [];
  const dataDir = resolve(ROOT, 'src/content/data-products');
  for (const cat of readdirSync(dataDir)) {
    const catPath = join(dataDir, cat);
    for (const brand of readdirSync(catPath)) {
      const brandPath = join(catPath, brand);
      for (const file of readdirSync(brandPath)) {
        if (!file.endsWith('.json')) continue;
        products.push(JSON.parse(readFileSync(join(brandPath, file), 'utf-8')));
      }
    }
  }
  return products;
}

const allProducts = loadAllProducts();

// ==========================================================================
//  PRODUCT DATA + IMAGE RESOLUTION
// ==========================================================================

describe('Product dual source of truth', () => {
  it('every product has identity fields', () => {
    for (const p of allProducts) {
      assert.ok(p.slug, `Product missing slug: ${JSON.stringify(p).slice(0, 100)}`);
      assert.ok(p.brand, `Product ${p.slug} missing brand`);
      assert.ok(p.model !== undefined, `Product ${p.slug} missing model`);
      assert.ok(p.category, `Product ${p.slug} missing category`);
    }
  });

  it('every product has an imagePath field', () => {
    for (const p of allProducts) {
      assert.ok(p.imagePath, `Product ${p.slug} missing imagePath`);
      assert.ok(
        p.imagePath.startsWith('/images/'),
        `Product ${p.slug} imagePath doesn't start with /images/: ${p.imagePath}`
      );
    }
  });

  it('every product has a media object', () => {
    for (const p of allProducts) {
      assert.ok(p.media, `Product ${p.slug} missing media`);
      assert.ok(Array.isArray(p.media.images), `Product ${p.slug} media.images not an array`);
      assert.ok(Array.isArray(p.media.colors), `Product ${p.slug} media.colors not an array`);
      assert.ok(Array.isArray(p.media.editions), `Product ${p.slug} media.editions not an array`);
    }
  });

  it('media.defaultColor matches colors[0] or is null', () => {
    for (const p of allProducts) {
      const colors = p.colors ?? [];
      if (colors.length > 0) {
        assert.equal(
          p.media.defaultColor, colors[0],
          `Product ${p.slug}: defaultColor should match colors[0]`
        );
      } else {
        assert.equal(
          p.media.defaultColor, null,
          `Product ${p.slug}: defaultColor should be null when no colors`
        );
      }
    }
  });

  it('every media.images entry has stem and view', () => {
    for (const p of allProducts) {
      for (const img of p.media.images) {
        assert.ok(img.stem, `Product ${p.slug}: image missing stem`);
        assert.ok(img.view, `Product ${p.slug}: image missing view`);
      }
    }
  });

  it('every media image stem resolves to a real file on disk (_m size for webp)', () => {
    const missing = [];
    let tested = 0;
    for (const p of allProducts) {
      for (const img of p.media.images) {
        // SVG shapes don't have sized variants
        if (img.view.startsWith('shape-')) {
          const svgPath = resolve(PUBLIC, p.imagePath.slice(1), `${img.stem}.svg`);
          if (!existsSync(svgPath)) {
            missing.push(`${p.slug}: ${img.stem}.svg`);
          }
        } else {
          const webpPath = resolve(PUBLIC, p.imagePath.slice(1), `${img.stem}_m.webp`);
          if (!existsSync(webpPath)) {
            missing.push(`${p.slug}: ${img.stem}_m.webp`);
          }
        }
        tested++;
      }
    }
    assert.equal(
      missing.length, 0,
      `${missing.length} media image stems don't resolve to files on disk:\n  ${missing.slice(0, 20).join('\n  ')}`
    );
    assert.ok(tested > 0, 'No images tested');
  });

  it('flat image fields have been removed', () => {
    const legacyFields = ['imgTop', 'imgBot', 'imgLside', 'imgRside', 'featureImgCover', 'shapeSide', 'shapeTop', 'thumbnail_image'];
    for (const p of allProducts) {
      for (const field of legacyFields) {
        assert.ok(!(field in p), `Product ${p.slug} still has legacy field: ${field}`);
      }
      const c_fields = Object.keys(p).filter(k => k.includes('__c_'));
      assert.equal(c_fields.length, 0, `Product ${p.slug} still has __c_ fields: ${c_fields.join(', ')}`);
    }
  });

  it('product object carries both data AND media (spot check)', () => {
    const product = allProducts.find(p => p.slug === 'logitech-g-pro-x-superlight-2');
    assert.ok(product, 'logitech-g-pro-x-superlight-2 not found');

    // DATA fields
    assert.equal(product.brand, 'Logitech G');
    assert.equal(typeof product.weight, 'number');
    assert.equal(typeof product.overall, 'number');
    assert.ok(product.url);

    // MEDIA fields
    assert.ok(product.media);
    assert.equal(product.media.defaultColor, 'black');
    assert.deepEqual(product.media.colors, ['black', 'white', 'pink', 'light-blue']);
    assert.ok(product.media.images.length > 0);

    // Top view exists
    const topImg = product.media.images.find(i => i.view === 'top' && !i.color);
    assert.ok(topImg, 'should have default top view');

    // Color variant exists
    const whiteTop = product.media.images.find(i => i.view === 'top' && i.color === 'white');
    assert.ok(whiteTop, 'should have white top view');

    // Image resolves to real file
    const filePath = resolve(PUBLIC, product.imagePath.slice(1), `${topImg.stem}_m.webp`);
    assert.ok(existsSync(filePath), `Image file doesn't exist: ${filePath}`);
  });

  it('all 366 products are accounted for', () => {
    assert.equal(allProducts.length, 366, 'total count');
  });
});

// ==========================================================================
//  GAME DATA + IMAGE RESOLUTION (same pattern the navbar uses)
// ==========================================================================

describe('Game dual source of truth', () => {
  const gameFiles = listContentFiles('src/content/games');
  const gameSlugs = gameFiles.map(f => slugFromContentPath(f, 'src/content/games'));

  it('every game content file has a matching image folder', () => {
    const missing = [];
    for (const slug of gameSlugs) {
      const folderPath = resolve(PUBLIC, 'images', 'games', slug);
      if (!existsSync(folderPath)) {
        missing.push(slug);
      }
    }
    assert.equal(
      missing.length, 0,
      `${missing.length} games have no image folder:\n  ${missing.join('\n  ')}`
    );
  });

  it('every game with navbar:true has box-art-cover_s.webp (the navbar image)', () => {
    const missing = [];
    for (const filePath of gameFiles) {
      const fm = loadFrontmatter(filePath);
      if (!fm.navbar) continue;
      const slug = slugFromContentPath(filePath, 'src/content/games');
      const imgPath = resolve(PUBLIC, 'images', 'games', slug, 'box-art-cover_s.webp');
      if (!existsSync(imgPath)) {
        missing.push(slug);
      }
    }
    assert.equal(
      missing.length, 0,
      `${missing.length} navbar games missing box-art-cover_s.webp:\n  ${missing.join('\n  ')}`
    );
  });

  it('game data+image pattern: slug provides both title AND image folder', () => {
    for (const filePath of gameFiles) {
      const fm = loadFrontmatter(filePath);
      if (!fm.navbar) continue;
      const slug = slugFromContentPath(filePath, 'src/content/games');
      assert.ok(fm.title, `Game ${slug} missing title`);
      const folderPath = resolve(PUBLIC, 'images', 'games', slug);
      assert.ok(existsSync(folderPath), `Game ${slug} missing image folder`);
    }
  });
});

// ==========================================================================
//  BRAND DATA + IMAGE RESOLUTION (same pattern the navbar uses)
// ==========================================================================

describe('Brand dual source of truth', () => {
  const brandFiles = listContentFiles('src/content/brands');
  const brandSlugs = brandFiles.map(f => slugFromContentPath(f, 'src/content/brands'));

  it('every brand content file has a matching image folder', () => {
    const missing = [];
    for (const slug of brandSlugs) {
      const folderPath = resolve(PUBLIC, 'images', 'brands', slug);
      if (!existsSync(folderPath)) {
        missing.push(slug);
      }
    }
    assert.equal(
      missing.length, 0,
      `${missing.length} brands have no image folder:\n  ${missing.join('\n  ')}`
    );
  });

  it('every brand with navbar categories has brand-logo-horizontal-mono-black_xs.png (the navbar image)', () => {
    const missing = [];
    for (const filePath of brandFiles) {
      const fm = loadFrontmatter(filePath);
      if (!fm.navbar || fm.navbar.length === 0) continue;
      const slug = slugFromContentPath(filePath, 'src/content/brands');
      const imgPath = resolve(PUBLIC, 'images', 'brands', slug, 'brand-logo-horizontal-mono-black_xs.png');
      if (!existsSync(imgPath)) {
        missing.push(slug);
      }
    }
    assert.equal(
      missing.length, 0,
      `${missing.length} navbar brands missing brand-logo-horizontal-mono-black_xs.png:\n  ${missing.join('\n  ')}`
    );
  });

  it('brand data+image pattern: slug provides both brand name AND image folder', () => {
    for (const filePath of brandFiles) {
      const fm = loadFrontmatter(filePath);
      if (!fm.navbar || fm.navbar.length === 0) continue;
      const slug = slugFromContentPath(filePath, 'src/content/brands');
      assert.ok(fm.brand, `Brand ${slug} missing brand name`);
      const folderPath = resolve(PUBLIC, 'images', 'brands', slug);
      assert.ok(existsSync(folderPath), `Brand ${slug} missing image folder`);
    }
  });
});

// ==========================================================================
//  REVIEW → PRODUCT LINKAGE (productId resolves to real product)
// ==========================================================================

describe('Review → Product linkage', () => {
  const reviewFiles = listContentFiles('src/content/reviews');
  const productSlugs = new Set(allProducts.map(p => p.slug));

  it('every review with a productId matches a real product slug', () => {
    const broken = [];
    for (const filePath of reviewFiles) {
      const fm = loadFrontmatter(filePath);
      if (!fm.productId) continue;
      if (!productSlugs.has(fm.productId)) {
        broken.push(`${basename(filePath)}: productId="${fm.productId}" not found`);
      }
    }
    assert.equal(
      broken.length, 0,
      `${broken.length} reviews have broken productId links:\n  ${broken.join('\n  ')}`
    );
  });

  it('review productId lookup gives access to both data AND images', () => {
    for (const filePath of reviewFiles) {
      const fm = loadFrontmatter(filePath);
      if (!fm.productId) continue;

      const product = allProducts.find(p => p.slug === fm.productId);
      assert.ok(product, `Product not found for ${fm.productId}`);
      assert.ok(product.brand, `Product ${product.slug} missing brand`);
      assert.ok(product.imagePath, `Product ${product.slug} missing imagePath`);
      assert.ok(product.media, `Product ${product.slug} missing media`);

      const folderPath = resolve(PUBLIC, product.imagePath.slice(1));
      assert.ok(existsSync(folderPath), `Product image folder doesn't exist: ${folderPath}`);
      break; // one is enough
    }
  });

  it('every review productId has a product with an existing image folder', () => {
    const broken = [];
    for (const filePath of reviewFiles) {
      const fm = loadFrontmatter(filePath);
      if (!fm.productId) continue;
      const product = allProducts.find(p => p.slug === fm.productId);
      if (!product) continue;
      const folderPath = resolve(PUBLIC, product.imagePath.slice(1));
      if (!existsSync(folderPath)) {
        broken.push(`${basename(filePath)}: product ${product.slug} → ${product.imagePath} (folder missing)`);
      }
    }
    assert.equal(
      broken.length, 0,
      `${broken.length} reviews link to products with missing image folders:\n  ${broken.join('\n  ')}`
    );
  });
});

// ==========================================================================
//  CROSS-CUTTING: The resolver pattern works for all content types
// ==========================================================================

describe('Resolver pattern: imagePath + stem + size → file exists', () => {
  it('product media stems resolve: imagePath/stem_size.webp', () => {
    let tested = 0;
    for (const p of allProducts) {
      for (const img of p.media.images) {
        if (img.view.startsWith('shape-')) continue; // SVGs tested separately
        const url = `${p.imagePath}/${img.stem}_m.webp`;
        const diskPath = resolve(PUBLIC, url.slice(1));
        assert.ok(
          existsSync(diskPath),
          `Resolver would produce ${url} but file missing at ${diskPath}`
        );
        tested++;
        if (tested >= 50) break;
      }
      if (tested >= 50) break;
    }
    assert.ok(tested > 0, 'No products tested');
  });

  it('game image pattern works: /images/games/{slug}/box-art-cover_s.webp resolves', () => {
    let tested = 0;
    for (const filePath of listContentFiles('src/content/games')) {
      const fm = loadFrontmatter(filePath);
      if (!fm.navbar) continue;
      const slug = slugFromContentPath(filePath, 'src/content/games');
      const url = `/images/games/${slug}/box-art-cover_s.webp`;
      const diskPath = resolve(PUBLIC, url.slice(1));
      assert.ok(existsSync(diskPath), `Game image missing: ${url}`);
      tested++;
    }
    assert.ok(tested > 0, 'No games tested');
  });

  it('brand image pattern works: /images/brands/{slug}/brand-logo-horizontal-mono-black_xs.png resolves', () => {
    let tested = 0;
    for (const filePath of listContentFiles('src/content/brands')) {
      const fm = loadFrontmatter(filePath);
      if (!fm.navbar || fm.navbar.length === 0) continue;
      const slug = slugFromContentPath(filePath, 'src/content/brands');
      const url = `/images/brands/${slug}/brand-logo-horizontal-mono-black_xs.png`;
      const diskPath = resolve(PUBLIC, url.slice(1));
      assert.ok(existsSync(diskPath), `Brand image missing: ${url}`);
      tested++;
    }
    assert.ok(tested > 0, 'No brands tested');
  });
});

