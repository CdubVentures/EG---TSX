#!/usr/bin/env node
/**
 * Migration Script: EG-HBS â†’ EG-TSX
 *
 * Reads source markdown files and product JSONs from EG-HBS,
 * generates CUID2 IDs, and writes validated content files to EG-TSX.
 *
 * Idempotent via crosswalk file â€” re-running preserves existing IDs.
 *
 * Run:  node scripts/migrate-content.mjs
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createId } from '@paralleldrive/cuid2';
import matter from 'gray-matter';

// â”€â”€â”€ Paths â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TSX_ROOT = path.resolve(__dirname, '..');
const HBS_ROOT = path.resolve(TSX_ROOT, '..', 'EG - HBS');
const CROSSWALK_PATH = path.join(__dirname, '.id-crosswalk.json');

const SRC = (...parts) => path.join(HBS_ROOT, ...parts);
const OUT = (...parts) => path.join(TSX_ROOT, ...parts);

// â”€â”€â”€ Stats â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const stats = {
  products: { total: 0, byCategory: {} },
  brands: { total: 0 },
  games: { total: 0 },
  reviews: { total: 0, skipped: 0, byCategory: {} },
  guides: { total: 0 },
  news: { total: 0 },
  pages: { total: 0 },
  warnings: [],
  errors: [],
};

function warn(msg) { stats.warnings.push(msg); console.warn(`  âš  ${msg}`); }
function error(msg) { stats.errors.push(msg); console.error(`  âœ— ${msg}`); }

// â”€â”€â”€ Crosswalk (idempotency) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function loadCrosswalk() {
  if (fs.existsSync(CROSSWALK_PATH)) {
    return JSON.parse(fs.readFileSync(CROSSWALK_PATH, 'utf-8'));
  }
  return {};
}

function saveCrosswalk(cw) {
  fs.writeFileSync(CROSSWALK_PATH, JSON.stringify(cw, null, 2), 'utf-8');
}

/** Get existing ID from crosswalk or generate a new CUID2 */
function getOrCreateId(cw, namespace, key) {
  const fullKey = `${namespace}:${key}`;
  if (!cw[fullKey]) cw[fullKey] = createId();
  return cw[fullKey];
}

// â”€â”€â”€ Slug helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function toSlug(input) {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** Extract [id = N] from review filename â†’ integer or null */
function extractReviewLegacyId(filename) {
  const m = filename.match(/\[id\s*=\s*(\d+)\]/);
  return m ? parseInt(m[1], 10) : null;
}

/** Extract (N) from game filename â†’ integer or null */
function extractGameLegacyId(filename) {
  const m = filename.match(/\((\d+)\)/);
  return m ? parseInt(m[1], 10) : null;
}

// â”€â”€â”€ Helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function ensureDir(p) { fs.mkdirSync(p, { recursive: true }); }

/** Recursively find files matching a pattern */
function findFiles(dir, pattern = /\.md$/i) {
  const results = [];
  if (!fs.existsSync(dir)) return results;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...findFiles(full, pattern));
    } else if (pattern.test(entry.name)) {
      results.push(full);
    }
  }
  return results;
}

/** Write a content file with YAML frontmatter + body */
function writeContentFile(filePath, frontmatterObj, body) {
  ensureDir(path.dirname(filePath));
  const output = matter.stringify(body || '', frontmatterObj);
  fs.writeFileSync(filePath, output, 'utf-8');
}

/** Coerce YAML empty strings / null to undefined (dropped from output) */
function clean(val) {
  if (val === '' || val === null || val === undefined) return undefined;
  if (typeof val === 'string' && val.trim() === '') return undefined;
  return val;
}

/** Parse various date formats to YYYY-MM-DD string or undefined */
function parseDate(val) {
  if (!val) return undefined;
  if (val instanceof Date && !isNaN(val.getTime())) return val.toISOString().split('T')[0];
  const s = String(val).trim();
  if (!s) return undefined;
  const d = new Date(s);
  if (!isNaN(d.getTime())) return d.toISOString().split('T')[0];
  return undefined;
}

/** Coerce all tag array items to strings (YAML parses bare numbers like 2025) */
function cleanTags(tags) {
  if (!Array.isArray(tags)) return [];
  return tags.map(t => String(t));
}

/** Ensure description meets min length (20 chars) for Zod validation */
function ensureDescription(desc, fallback) {
  const d = clean(desc) || fallback;
  if (!d || d.length < 20) {
    return `${d || fallback || 'Content page'}. Explore expert reviews, guides, and comparisons.`;
  }
  return d;
}

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// 1. PRODUCT MIGRATION (JSON â†’ JSON with CUID2)
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

function migrateProducts(cw) {
  console.log('\nâ”€â”€ Products â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€');

  /** brand slug (lowercase) â†’ CUID2 */
  const brandMap = {};
  /** "mouse:1" â†’ CUID2 */
  const productMap = {};

  const CATEGORIES = ['mouse', 'keyboard', 'monitor'];

  for (const cat of CATEGORIES) {
    const srcPath = SRC('data', `${cat}_data.json`);
    if (!fs.existsSync(srcPath)) {
      warn(`Product data not found: ${srcPath}`);
      continue;
    }

    const products = JSON.parse(fs.readFileSync(srcPath, 'utf-8'));
    const output = [];

    for (const product of products) {
      const legacyId = product.id;
      const id = getOrCreateId(cw, `product-${cat}`, String(legacyId));
      const slug = toSlug(`${product.brand}-${product.model}`);

      // Build brand map (brand slug â†’ CUID2)
      const brandKey = toSlug(product.brand);
      if (!brandMap[brandKey]) {
        brandMap[brandKey] = getOrCreateId(cw, 'brand', brandKey);
      }

      // Build product map (category:legacyId â†’ CUID2)
      productMap[`${cat}:${legacyId}`] = id;

      // Preserve all fields; add id, legacyId, slug, brandId at top
      const entry = {
        id,
        legacyId,
        slug,
        brandId: brandMap[brandKey],
        ...product,
      };
      // Remove the legacy `id` that was spread from ...product
      // (it's now in `legacyId`)
      delete entry.id;
      entry.id = id;

      output.push(entry);
      stats.products.total++;
    }

    stats.products.byCategory[cat] = output.length;

    const outPath = OUT('src', 'data', 'products', `${cat}.json`);
    ensureDir(path.dirname(outPath));
    fs.writeFileSync(outPath, JSON.stringify(output, null, 2), 'utf-8');
    console.log(`  ${cat}: ${output.length} products â†’ ${path.relative(TSX_ROOT, outPath)}`);
  }

  return { brandMap, productMap };
}

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// 2. BRAND MIGRATION (MD â†’ MD)
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

function migrateBrands(cw, brandMap) {
  console.log('\nâ”€â”€ Brands â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€');

  const srcDir = SRC('.markdowns', 'brands');
  const files = findFiles(srcDir);

  for (const file of files) {
    const raw = fs.readFileSync(file, 'utf-8');
    const { data, content } = matter(raw);
    const brandName = data.brand || path.basename(file, '.md');
    const brandKey = toSlug(brandName);
    const id = brandMap[brandKey] || getOrCreateId(cw, 'brand', brandKey);
    const slug = brandKey;

    // Ensure brandMap has this brand
    brandMap[brandKey] = id;

    const fm = {
      id,
      slug,
      brand: brandName,
      displayName: clean(data.displayName) || brandName,
      title: data.title || `${brandName} Gaming Gear`,
      subtitle: clean(data.subtitle),
      description: ensureDescription(data.description, `${brandName} gaming peripherals and accessories`),
      profile: clean(data.profile),
      tags: cleanTags(data.tags),
      datePublished: parseDate(data.datePublished),
      dateUpdated: parseDate(data.dateUpdated),
      overall: typeof data.overall === 'number' ? data.overall : undefined,
      hero: clean(data.heroImg),
      heroCredit: clean(data.heroCredit),
      brand_website: clean(data.brand_website) || '',
      brand_facebook: clean(data.brand_facebook) || '',
      brand_x: clean(data.brand_x) || '',
      brand_instagram: clean(data.brand_instagram) || '',
      brand_youtube: clean(data.brand_youtube) || '',
      brand_tiktok: clean(data.brand_tiktok) || '',
      navbar: Array.isArray(data.navbar) ? data.navbar : [],
      iDashboard: clean(data.iDashboard),
      iFilteredDashboard: clean(data.iFilteredDashboard),
      product_1: clean(data.product_1),
      product_2: clean(data.product_2),
      product_3: clean(data.product_3),
      product_4: clean(data.product_4),
      product_5: clean(data.product_5),
      product_6: clean(data.product_6),
      toc: data.toc === true,
      publish: data.publish !== false,
    };

    // Remove undefined values so YAML stays clean
    Object.keys(fm).forEach(k => fm[k] === undefined && delete fm[k]);

    const outPath = OUT('src', 'content', 'brands', `${slug}.md`);
    writeContentFile(outPath, fm, content);
    stats.brands.total++;
  }

  console.log(`  ${stats.brands.total} brands migrated`);
}

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// 3. GAME MIGRATION (MD â†’ MD)
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

function migrateGames(cw) {
  console.log('\nâ”€â”€ Games â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€');

  const srcDir = SRC('.markdowns', 'games');
  const files = findFiles(srcDir);

  for (const file of files) {
    const raw = fs.readFileSync(file, 'utf-8');
    const { data, content } = matter(raw);
    const filename = path.basename(file);
    const gameName = data.game || filename.replace(/\s*\(\d+\)\.md$/i, '');
    const slug = toSlug(gameName);
    const id = getOrCreateId(cw, 'game', slug);

    const fm = {
      id,
      slug,
      game: gameName,
      guide: clean(data.guide),
      title: data.title || gameName,
      subtitle: clean(data.subtitle),
      description: ensureDescription(data.description, `${gameName} â€” gaming guide and recommended gear`),
      profile: clean(data.profile),
      tags: cleanTags(data.tags),
      genre: clean(data.genre),
      releaseDate: clean(data.releaseDate),
      lastPatchDate: clean(data.lastPatchDate),
      patchTitle: clean(data.patchTitle),
      overall: typeof data.overall === 'number' ? data.overall : undefined,
      hero: clean(data.heroImg),
      heroAlt: clean(data.heroAltImg),
      heroCredit: clean(data.heroCredit),
      boxCoverArt: clean(data.boxCoverArt),
      game_website: clean(data.game_website) || '',
      game_facebook: clean(data.game_facebook) || '',
      game_x: clean(data.game_x) || '',
      game_instagram: clean(data.game_instagram) || '',
      game_youtube: clean(data.game_youtube) || '',
      iDashboard: clean(data.iDashboard),
      author: clean(data.author),
      publish: data.publish !== false,
      toc: data.toc === true,
    };

    Object.keys(fm).forEach(k => fm[k] === undefined && delete fm[k]);

    const outPath = OUT('src', 'content', 'games', `${slug}.md`);
    writeContentFile(outPath, fm, content);
    stats.games.total++;
  }

  console.log(`  ${stats.games.total} games migrated`);
}

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// 4. REVIEW MIGRATION (MD â†’ MD with product/brand linking)
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

function migrateReviews(cw, brandMap, productMap) {
  console.log('\nâ”€â”€ Reviews â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€');

  const srcDir = SRC('.markdowns', 'reviews');
  const files = findFiles(srcDir);
  const slugsSeen = new Set();

  for (const file of files) {
    const relPath = path.relative(srcDir, file);
    const subDir = relPath.split(path.sep)[0]; // mouse, keyboard, game, gpu, test

    // Skip test files
    if (subDir === 'test') {
      stats.reviews.skipped++;
      continue;
    }

    const raw = fs.readFileSync(file, 'utf-8');
    const { data, content } = matter(raw);
    const filename = path.basename(file);
    const category = data.category || subDir;
    const legacyId = extractReviewLegacyId(filename);

    // Derive slug â€” deduplicate if needed
    let slug;
    if (data.brand && data.model) {
      slug = toSlug(`${data.brand}-${data.model}-review`);
    } else {
      slug = toSlug(data.title || filename.replace(/\.md$/i, ''));
    }
    // Handle slug collisions (e.g. two reviews with same brand+model)
    if (slugsSeen.has(slug)) {
      slug = `${slug}-${category}`;
    }
    slugsSeen.add(slug);

    const id = getOrCreateId(cw, 'review', `${category}/${slug}`);

    // Link to product (if [id = N] exists and category is a product category)
    let productId;
    if (legacyId !== null && productMap[`${category}:${legacyId}`]) {
      productId = productMap[`${category}:${legacyId}`];
    } else if (legacyId !== null) {
      warn(`Review "${filename}" has [id=${legacyId}] but no product found for ${category}:${legacyId}`);
    }

    // Link to brand
    let brandId;
    if (data.brand) {
      const brandKey = toSlug(data.brand);
      if (brandMap[brandKey]) {
        brandId = brandMap[brandKey];
      }
    }

    const fm = {
      id,
      slug,
      category,
      brand: clean(data.brand),
      model: clean(data.model),
      author: data.author || 'EG Team',
      publish: data.publish !== false,
      draft: data.draft === true,
      title: data.title || `${data.brand || ''} ${data.model || ''} Review`.trim(),
      subtitle: clean(data.subtitle),
      description: ensureDescription(
        data.description,
        `Review of the ${data.brand || ''} ${data.model || ''}`.trim(),
      ),
      tags: cleanTags(data.tags),
      datePublished: parseDate(data.datePublished),
      dateUpdated: parseDate(data.dateUpdated),
      hero: clean(data.heroImg),
      heroAspect: clean(data.heroAspect),
      heroCredit: clean(data.heroCredit),
      productId,
      brandId,
      toc: data.toc === true,
    };

    Object.keys(fm).forEach(k => fm[k] === undefined && delete fm[k]);

    stats.reviews.byCategory[category] = (stats.reviews.byCategory[category] || 0) + 1;

    const outPath = OUT('src', 'content', 'reviews', category, `${slug}.md`);
    writeContentFile(outPath, fm, content);
    stats.reviews.total++;
  }

  console.log(`  ${stats.reviews.total} reviews migrated (${stats.reviews.skipped} test files skipped)`);
  for (const [cat, count] of Object.entries(stats.reviews.byCategory)) {
    console.log(`    ${cat}: ${count}`);
  }
}

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// 5. GUIDE MIGRATION (MD â†’ MD)
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

function migrateGuides(cw) {
  console.log('\nâ”€â”€ Guides â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€');

  const srcDir = SRC('.markdowns', 'guides');
  const files = findFiles(srcDir);

  for (const file of files) {
    const raw = fs.readFileSync(file, 'utf-8');
    const { data, content } = matter(raw);
    const filename = path.basename(file, '.md');
    const relPath = path.relative(srcDir, file);
    const subDir = relPath.split(path.sep)[0]; // mouse, keyboard, monitor, hardware
    const category = data.category || subDir;

    const guideTitle = data.guide || filename;
    const slug = toSlug(`${category}-${guideTitle}`);
    const id = getOrCreateId(cw, 'guide', slug);

    const fm = {
      id,
      slug,
      category,
      guide: clean(data.guide) || guideTitle,
      title: data.title || guideTitle,
      subtitle: clean(data.subtitle),
      summary: clean(data.summary),
      description: ensureDescription(data.description, `Guide: ${guideTitle} for ${category}`),
      tags: cleanTags(data.tags),
      datePublished: parseDate(data.datePublished),
      dateUpdated: parseDate(data.dateUpdated),
      hero: clean(data.heroImg),
      heroCredit: clean(data.heroCredit),
      author: clean(data.author),
      publish: data.publish !== false,
      toc: data.toc === true,
      draft: data.draft === true,
    };

    Object.keys(fm).forEach(k => fm[k] === undefined && delete fm[k]);

    const outPath = OUT('src', 'content', 'guides', category, `${slug}.md`);
    writeContentFile(outPath, fm, content);
    stats.guides.total++;
  }

  console.log(`  ${stats.guides.total} guides migrated`);
}

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// 6. NEWS MIGRATION (MD â†’ MD)
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

function migrateNews(cw) {
  console.log('\nâ”€â”€ News â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€');

  const srcDir = SRC('.markdowns', 'news');
  const files = findFiles(srcDir);

  for (const file of files) {
    const raw = fs.readFileSync(file, 'utf-8');
    const { data, content } = matter(raw);
    const filename = path.basename(file, '.md');
    const slug = toSlug(filename);
    const id = getOrCreateId(cw, 'news', slug);

    // datePublished is required â€” fall back to file mtime
    let datePublished = parseDate(data.datePublished);
    if (!datePublished) {
      const mtime = fs.statSync(file).mtime;
      datePublished = mtime.toISOString().split('T')[0];
      warn(`News "${filename}" missing datePublished, using file mtime: ${datePublished}`);
    }

    const fm = {
      id,
      slug,
      title: data.title || filename,
      description: ensureDescription(data.description, `News: ${data.title || filename}`),
      tags: cleanTags(data.tags),
      datePublished,
      dateUpdated: parseDate(data.dateUpdated),
      author: data.author || 'EG Team',
      hero: clean(data.heroImg),
      heroCredit: clean(data.heroCredit),
      category: clean(data.category),
      draft: data.draft === true,
      publish: data.publish !== false,
    };

    Object.keys(fm).forEach(k => fm[k] === undefined && delete fm[k]);

    // News subfolder from source directory structure (mouse/, ai/, game/, etc.)
    const newsRelPath = path.relative(srcDir, file);
    const newsSubDir = newsRelPath.includes(path.sep) ? newsRelPath.split(path.sep)[0] : '';
    const outPath = newsSubDir
      ? OUT('src', 'content', 'news', newsSubDir, `${slug}.md`)
      : OUT('src', 'content', 'news', `${slug}.md`);
    writeContentFile(outPath, fm, content);
    stats.news.total++;
  }

  console.log(`  ${stats.news.total} news articles migrated`);
}

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// 7. PAGE MIGRATION (MD â†’ MD)
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

function migratePages(cw) {
  console.log('\nâ”€â”€ Pages â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€');

  const srcDir = SRC('.markdowns', 'pages');
  const files = findFiles(srcDir);

  for (const file of files) {
    const raw = fs.readFileSync(file, 'utf-8');
    const { data, content } = matter(raw);
    const filename = path.basename(file, '.md');
    const pageName = data.page || filename;
    const slug = toSlug(pageName);
    const id = getOrCreateId(cw, 'page', slug);

    const fm = {
      id,
      slug,
      title: data.title || pageName,
      description: ensureDescription(data.description, `${pageName} page`),
      noIndex: data.noIndex === true,
    };

    Object.keys(fm).forEach(k => fm[k] === undefined && delete fm[k]);

    const outPath = OUT('src', 'content', 'pages', `${slug}.md`);
    writeContentFile(outPath, fm, content);
    stats.pages.total++;
  }

  console.log(`  ${stats.pages.total} pages migrated`);
}

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// MAIN
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

function main() {
  console.log('â•”â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•—');
  console.log('â•‘        EG-HBS â†’ EG-TSX Content Migration           â•‘');
  console.log('â•šâ•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•');
  console.log(`\nSource: ${HBS_ROOT}`);
  console.log(`Target: ${TSX_ROOT}`);

  // Verify source exists
  if (!fs.existsSync(HBS_ROOT)) {
    console.error(`\nâœ— Source directory not found: ${HBS_ROOT}`);
    process.exit(1);
  }

  const cw = loadCrosswalk();
  const existingIds = Object.keys(cw).length;
  console.log(`\nCrosswalk: ${existingIds} existing IDs loaded`);

  // Phase 1: Products (needed for review linking)
  const { brandMap, productMap } = migrateProducts(cw);

  // Phase 2: Content collections
  migrateBrands(cw, brandMap);
  migrateGames(cw);
  migrateReviews(cw, brandMap, productMap);
  migrateGuides(cw);
  migrateNews(cw);
  migratePages(cw);

  // Save crosswalk for idempotency
  saveCrosswalk(cw);
  const newIds = Object.keys(cw).length - existingIds;

  // â”€â”€â”€ Report â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  console.log('\nâ•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•');
  console.log('MIGRATION REPORT');
  console.log('â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•');
  console.log(`Products: ${stats.products.total}`);
  for (const [cat, count] of Object.entries(stats.products.byCategory)) {
    console.log(`  ${cat}: ${count}`);
  }
  console.log(`Brands:   ${stats.brands.total}`);
  console.log(`Games:    ${stats.games.total}`);
  console.log(`Reviews:  ${stats.reviews.total} (${stats.reviews.skipped} test skipped)`);
  for (const [cat, count] of Object.entries(stats.reviews.byCategory)) {
    console.log(`  ${cat}: ${count}`);
  }
  console.log(`Guides:   ${stats.guides.total}`);
  console.log(`News:     ${stats.news.total}`);
  console.log(`Pages:    ${stats.pages.total}`);
  console.log(`\nCrosswalk: ${newIds} new IDs generated, ${Object.keys(cw).length} total`);

  if (stats.warnings.length) {
    console.log(`\nâš  ${stats.warnings.length} warnings (see above)`);
  }
  if (stats.errors.length) {
    console.log(`\nâœ— ${stats.errors.length} errors:`);
    stats.errors.forEach(e => console.log(`  ${e}`));
  }

  console.log('\nDone. Run `npx astro check` to validate output.');
}

main();
