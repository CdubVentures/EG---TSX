#!/usr/bin/env node
/**
 * build-media.mjs — Product media schema migration & automation
 *
 * TWO modes:
 *   1. Initial migration: Parse flat image fields + scan filesystem → build `media` object, remove old flat fields
 *   2. Ongoing (--scan-only): Re-scan filesystem → update `media.images` array (after adding new images)
 *
 * Usage:
 *   node scripts/build-media.mjs                          # full migration on all products
 *   node scripts/build-media.mjs --dry-run                # preview without writing
 *   node scripts/build-media.mjs --product <slug>         # run on single product
 *   node scripts/build-media.mjs --scan-only              # only update images from filesystem
 *   node scripts/build-media.mjs --scan-only --dry-run    # preview scan-only
 */

import { readFileSync, writeFileSync, readdirSync, existsSync } from 'fs';
import { resolve, join, extname, basename } from 'path';
import { parseArgs } from 'util';

// ─── CLI args ────────────────────────────────────────────────────────────────

const { values: flags } = parseArgs({
  options: {
    'dry-run':   { type: 'boolean', default: false },
    'product':   { type: 'string' },
    'scan-only': { type: 'boolean', default: false },
  },
  strict: false,
});

const DRY_RUN   = flags['dry-run'];
const SCAN_ONLY = flags['scan-only'];
const SINGLE    = flags['product'];

const ROOT   = resolve(import.meta.dirname, '..');
const DATA   = resolve(ROOT, 'src/content/data-products');
const PUBLIC = resolve(ROOT, 'public');

// ─── Known size suffixes (from image processing pipeline) ────────────────────

const SIZE_SUFFIXES = new Set([
  'blur', 't_blur', 't', 'xs', 'xxs', 's', 'm', 'l', 'xl', 'xxl', 'zoom',
]);

// ─── Flat image fields to remove (collected from full scan of all 366 products) ──

const FLAT_IMAGE_FIELDS_BASE = new Set([
  'imgTop', 'imgBot', 'imgLside', 'imgRside', 'imgSAngle', 'imgAngle', 'imgFront', 'imgRear',
  'featureImgCover', 'featureImgContain',
  'shapeSide', 'shapeTop',
  'thumbnail_image', 'adImageUrl',
]);

// Also: img1-img12, imgTop1-imgTop12, imgAngle1, imgAngle2
for (let i = 1; i <= 12; i++) {
  FLAT_IMAGE_FIELDS_BASE.add(`img${i}`);
  FLAT_IMAGE_FIELDS_BASE.add(`imgTop${i}`);
}
FLAT_IMAGE_FIELDS_BASE.add('imgAngle1');
FLAT_IMAGE_FIELDS_BASE.add('imgAngle2');

/** Check if a JSON key is a flat image field to remove */
function isFlatImageField(key) {
  if (FLAT_IMAGE_FIELDS_BASE.has(key)) return true;
  if (key.includes('__c_')) return true;
  return false;
}

// ─── View priority for ordering ──────────────────────────────────────────────

const VIEW_PRIORITY = [
  'feature-image', 'top', 'left', 'right', 'sangle', 'angle', 'front', 'rear', 'bot', 'img',
];

function viewPriority(view) {
  const idx = VIEW_PRIORITY.indexOf(view);
  return idx >= 0 ? idx : VIEW_PRIORITY.length; // unknown views go last
}

// ─── Stem parsing ────────────────────────────────────────────────────────────

/**
 * Strip size suffix from a filename to get the stem.
 * e.g. "top_m.webp" → "top", "left---pink_xl.webp" → "left---pink"
 *      "top___cyberpunk-2077-edition---black+red_t_blur.webp" → "top___cyberpunk-2077-edition---black+red"
 */
function stripSizeSuffix(filename) {
  const ext = extname(filename); // .webp or .svg
  const name = basename(filename, ext);

  if (ext === '.svg') return { stem: name, ext: 'svg' };

  // Try compound suffix first (_t_blur), then single suffixes
  // Match: _{suffix} at end of name
  for (const suffix of ['t_blur', ...SIZE_SUFFIXES]) {
    if (suffix === 't_blur' && name.endsWith('_t_blur')) {
      return { stem: name.slice(0, -7), ext: 'webp' }; // -7 = _t_blur
    }
    if (name.endsWith('_' + suffix)) {
      return { stem: name.slice(0, -(suffix.length + 1)), ext: 'webp' };
    }
  }

  // Bare file without size suffix (e.g., "top.webp", "left.webp")
  return { stem: name, ext: ext.slice(1) };
}

/**
 * Parse a stem into { view, color?, edition?, seq? }
 *
 * Naming convention:
 *   "top"                                          → view=top
 *   "top---white"                                  → view=top, color=white
 *   "top___cyberpunk-2077-edition---black+red"     → view=top, edition=cyberpunk-2077-edition, color=black+red
 *   "img1"                                         → view=img, seq=1
 *   "sangle"                                       → view=sangle
 */
function parseStem(stem) {
  let view, color, edition, seq;

  let remainder = stem;

  // Check for edition separator ___
  const edIdx = remainder.indexOf('___');
  if (edIdx >= 0) {
    const beforeEd = remainder.slice(0, edIdx);
    const afterEd = remainder.slice(edIdx + 3);

    remainder = beforeEd;

    // After ___, check for color separator ---
    const colorIdx = afterEd.indexOf('---');
    if (colorIdx >= 0) {
      edition = afterEd.slice(0, colorIdx);
      color = afterEd.slice(colorIdx + 3);
    } else {
      edition = afterEd;
    }
  } else {
    // No edition — check for color separator ---
    const colorIdx = remainder.indexOf('---');
    if (colorIdx >= 0) {
      color = remainder.slice(colorIdx + 3);
      remainder = remainder.slice(0, colorIdx);
    }
  }

  // Parse view + optional sequence number from remainder
  // e.g., "img1" → view="img", seq=1; "top" → view="top"
  const seqMatch = remainder.match(/^(.+?)(\d+)$/);
  if (seqMatch) {
    view = seqMatch[1];
    seq = parseInt(seqMatch[2], 10);
  } else {
    view = remainder;
  }

  const result = { stem, view };
  if (color !== undefined) result.color = color;
  if (edition !== undefined) result.edition = edition;
  if (seq !== undefined) result.seq = seq;
  return result;
}

// ─── Filesystem scanner ─────────────────────────────────────────────────────

/**
 * Scan an image folder and return deduplicated, parsed image entries.
 * Only includes webp stems that have at least one sized variant (e.g., _m.webp).
 * Bare .webp files without size suffixes are skipped (not processed through image pipeline).
 */
function scanImageFolder(folderPath) {
  if (!existsSync(folderPath)) return [];

  const files = readdirSync(folderPath);
  const displayStems = new Set();  // stems with at least one display size (_m, _s, _l, etc.)
  const svgStems = new Set();

  // Display sizes = sizes that components actually use (not just blur)
  const DISPLAY_SUFFIXES = new Set(['t', 'xs', 'xxs', 's', 'm', 'l', 'xl', 'xxl', 'zoom']);

  for (const file of files) {
    const ext = extname(file);
    if (ext !== '.webp' && ext !== '.svg') continue;
    if (file === 'Thumbs.db') continue;

    const { stem, ext: parsedExt } = stripSizeSuffix(file);
    if (parsedExt === 'svg') {
      svgStems.add(stem);
    } else {
      // Only include if this file has a display-size suffix (not bare, not blur-only)
      const nameWithoutExt = basename(file, '.webp');
      if (nameWithoutExt !== stem) {
        // Extract the size suffix that was stripped
        const suffix = nameWithoutExt.slice(stem.length + 1); // +1 for underscore
        if (DISPLAY_SUFFIXES.has(suffix)) {
          displayStems.add(stem);
        }
      }
    }
  }

  const stems = displayStems;

  const images = [];

  // Add webp photo images
  for (const stem of stems) {
    images.push(parseStem(stem));
  }

  // Add SVG shape images with shape- prefix on view
  for (const stem of svgStems) {
    images.push({ stem, view: `shape-${stem}` });
  }

  return images;
}

// ─── Image ordering ─────────────────────────────────────────────────────────

/**
 * Sort images by view priority, then seq, then color (default first).
 */
function sortImages(images, defaultColor) {
  return [...images].sort((a, b) => {
    // 1. View priority
    const vp = viewPriority(a.view) - viewPriority(b.view);
    if (vp !== 0) return vp;

    // 2. Sequence number (undefined = 0)
    const sa = a.seq ?? 0;
    const sb = b.seq ?? 0;
    if (sa !== sb) return sa - sb;

    // 3. Default color first (no color = default, then defaultColor, then others)
    const ca = colorRank(a.color, defaultColor);
    const cb = colorRank(b.color, defaultColor);
    return ca - cb;
  });
}

function colorRank(color, defaultColor) {
  if (color === undefined) return 0;          // no color = default image
  if (color === defaultColor) return 1;       // explicit default color
  return 2;                                   // other colors
}

// ─── Build media object ─────────────────────────────────────────────────────

function buildMedia(product, folderPath) {
  const images = scanImageFolder(folderPath);
  const productColors = product.colors ?? [];

  // Derive defaultColor
  const defaultColor = productColors.length > 0 ? productColors[0] : null;

  // Collect unique colors from images
  const imageColors = new Set();
  for (const img of images) {
    if (img.color) imageColors.add(img.color);
  }

  // Build colors list: start with product colors, add any filesystem-only colors
  const colorsSet = new Set(productColors);
  for (const c of imageColors) {
    if (!colorsSet.has(c)) {
      console.warn(`  WARN: Filesystem color "${c}" not in product.colors for ${product.slug}`);
    }
    colorsSet.add(c);
  }
  const colors = [...colorsSet];

  // Collect unique editions from images
  const editions = [...new Set(images.filter(i => i.edition).map(i => i.edition))];

  // Sort images
  const sortedImages = sortImages(images, defaultColor);

  return {
    defaultColor,
    colors,
    editions,
    images: sortedImages,
  };
}

// ─── Main ────────────────────────────────────────────────────────────────────

function getAllProductFiles() {
  const files = [];
  for (const cat of readdirSync(DATA)) {
    const catPath = join(DATA, cat);
    for (const brand of readdirSync(catPath)) {
      const brandPath = join(catPath, brand);
      for (const file of readdirSync(brandPath)) {
        if (!file.endsWith('.json')) continue;
        files.push(join(brandPath, file));
      }
    }
  }
  return files;
}

function processProduct(filePath) {
  const product = JSON.parse(readFileSync(filePath, 'utf-8'));

  // Filter by slug if --product specified
  if (SINGLE && product.slug !== SINGLE) return null;

  const imgFolder = resolve(PUBLIC, product.imagePath.slice(1)); // remove leading /
  const media = buildMedia(product, imgFolder);

  if (SCAN_ONLY) {
    // Only update media.images, keep everything else
    product.media = product.media || {};
    product.media.defaultColor = media.defaultColor;
    product.media.colors = media.colors;
    product.media.editions = media.editions;
    product.media.images = media.images;
    return { product, media, filePath };
  }

  // Full migration: add media, remove flat fields
  product.media = media;

  // Remove flat image fields
  const removedFields = [];
  for (const key of Object.keys(product)) {
    if (isFlatImageField(key)) {
      removedFields.push(key);
      delete product[key];
    }
  }

  return { product, media, filePath, removedFields };
}

function main() {
  console.log(`\n=== build-media.mjs ===`);
  console.log(`Mode: ${SCAN_ONLY ? 'scan-only' : 'full migration'}${DRY_RUN ? ' (DRY RUN)' : ''}`);
  if (SINGLE) console.log(`Product filter: ${SINGLE}`);
  console.log('');

  const files = getAllProductFiles();
  let processed = 0;
  let skipped = 0;
  let warnings = 0;

  for (const filePath of files) {
    const result = processProduct(filePath);
    if (!result) { skipped++; continue; }

    const { product, media, removedFields } = result;
    processed++;

    const relPath = filePath.replace(ROOT + '\\', '').replace(ROOT + '/', '');
    console.log(`[${processed}] ${product.slug}`);
    console.log(`     images: ${media.images.length}, colors: ${media.colors.length}, editions: ${media.editions.length}`);
    if (removedFields && removedFields.length > 0) {
      console.log(`     removed: ${removedFields.length} flat fields`);
    }

    if (!DRY_RUN) {
      writeFileSync(filePath, JSON.stringify(product, null, 2) + '\n', 'utf-8');
    }
  }

  console.log(`\n--- Summary ---`);
  console.log(`Processed: ${processed}`);
  console.log(`Skipped:   ${skipped}`);
  if (DRY_RUN) console.log(`(dry run — no files written)`);
  console.log('');
}

main();
