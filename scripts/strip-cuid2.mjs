#!/usr/bin/env node
// ── Strip CUID2 Identity ───────────────────────────────────────────────────────
// Replaces CUID2-based identity with slug-based identity across the codebase.
//
// Usage:
//   node scripts/strip-cuid2.mjs --dry-run   # preview changes
//   node scripts/strip-cuid2.mjs             # execute changes

import { readFileSync, writeFileSync, readdirSync, mkdirSync, renameSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';

// ── Pure functions (exported for testing) ──────────────────────────────────────

/**
 * Build a Map from product CUID2 `id` → `slug`.
 * @param {Array<{id?: string, slug?: string}>} products
 * @returns {Map<string, string>}
 */
export function buildCuid2ToSlugMap(products) {
  const map = new Map();
  for (const product of products) {
    if (!product.id) {
      throw new Error(`Product missing id field: ${JSON.stringify(product)}`);
    }
    if (!product.slug) {
      throw new Error(`Product missing slug field: ${JSON.stringify(product)}`);
    }
    if (map.has(product.id)) {
      throw new Error(`Duplicate CUID2 id: "${product.id}" (slugs: "${map.get(product.id)}" and "${product.slug}")`);
    }
    map.set(product.id, product.slug);
  }
  return map;
}

/**
 * Replace the CUID2 value on the `productId:` frontmatter line with the slug.
 * Operates on raw file text (not parsed YAML) to preserve formatting.
 * @param {string} fileContent - raw file content
 * @param {Map<string, string>} cuid2Map - CUID2 → slug
 * @returns {string} - rewritten file content
 */
export function rewriteProductId(fileContent, cuid2Map) {
  const productIdRegex = /^(productId:\s*)(.+)$/m;
  const match = fileContent.match(productIdRegex);

  if (!match) return fileContent;

  const cuid2Value = match[2].trim();
  const slug = cuid2Map.get(cuid2Value);

  if (slug === undefined) {
    throw new Error(`productId "${cuid2Value}" not found in map`);
  }

  return fileContent.replace(productIdRegex, `$1${slug}`);
}

/**
 * Remove `id`, `brandId`, and `legacyId` from every product object.
 * Returns new array (does not mutate input).
 * @param {Array<Object>} products
 * @returns {Array<Object>}
 */
export function stripProductFields(products) {
  return products.map(product => {
    const { id, brandId, legacyId, ...rest } = product;
    return rest;
  });
}

// ── Orchestrator ───────────────────────────────────────────────────────────────

const ROOT = resolve(import.meta.dirname, '..');
const PRODUCTS_DIR = join(ROOT, 'src', 'data', 'products');
const REVIEWS_DIR = join(ROOT, 'src', 'content', 'reviews');
const CROSSWALK_SRC = join(ROOT, 'scripts', '.id-crosswalk.json');
const CROSSWALK_DST = join(ROOT, 'scripts', 'archive', '.id-crosswalk.json');

const PRODUCT_FILES = ['mouse.json', 'keyboard.json', 'monitor.json'];
const REVIEW_CATEGORIES = ['mouse', 'keyboard', 'monitor'];

function main() {
  const dryRun = process.argv.includes('--dry-run');

  if (dryRun) console.log('=== DRY RUN — no files will be modified ===\n');

  // 1. Load all products and build CUID2 → slug map
  const allProducts = [];
  const productsByFile = {};

  for (const file of PRODUCT_FILES) {
    const path = join(PRODUCTS_DIR, file);
    const products = JSON.parse(readFileSync(path, 'utf-8'));
    productsByFile[file] = products;
    allProducts.push(...products);
  }

  const cuid2Map = buildCuid2ToSlugMap(allProducts);
  console.log(`Built CUID2 → slug map: ${cuid2Map.size} products`);

  // 2. Rewrite review productId fields
  let reviewsRewritten = 0;
  for (const category of REVIEW_CATEGORIES) {
    const categoryDir = join(REVIEWS_DIR, category);
    const files = readdirSync(categoryDir).filter(f => f.endsWith('.md'));

    for (const file of files) {
      const filePath = join(categoryDir, file);
      const content = readFileSync(filePath, 'utf-8');

      if (!content.includes('productId:')) continue;

      const rewritten = rewriteProductId(content, cuid2Map);

      if (rewritten !== content) {
        if (dryRun) {
          const oldMatch = content.match(/productId:\s*(.+)/);
          const newMatch = rewritten.match(/productId:\s*(.+)/);
          console.log(`  [review] ${category}/${file}: ${oldMatch[1].trim()} → ${newMatch[1].trim()}`);
        } else {
          writeFileSync(filePath, rewritten, 'utf-8');
        }
        reviewsRewritten++;
      }
    }
  }
  console.log(`Reviews rewritten: ${reviewsRewritten}`);

  // 3. Strip product JSON fields
  let productsStripped = 0;
  for (const file of PRODUCT_FILES) {
    const products = productsByFile[file];
    const stripped = stripProductFields(products);
    productsStripped += stripped.length;

    if (dryRun) {
      console.log(`  [product] ${file}: would strip id/brandId/legacyId from ${stripped.length} products`);
    } else {
      const path = join(PRODUCTS_DIR, file);
      writeFileSync(path, JSON.stringify(stripped, null, 2) + '\n', 'utf-8');
    }
  }
  console.log(`Products stripped: ${productsStripped}`);

  // 4. Move crosswalk
  if (existsSync(CROSSWALK_SRC)) {
    if (dryRun) {
      console.log(`  [crosswalk] would move .id-crosswalk.json → scripts/archive/`);
    } else {
      mkdirSync(join(ROOT, 'scripts', 'archive'), { recursive: true });
      renameSync(CROSSWALK_SRC, CROSSWALK_DST);
      console.log('Moved .id-crosswalk.json → scripts/archive/');
    }
  } else {
    console.log('  [crosswalk] .id-crosswalk.json not found (already moved?)');
  }

  console.log('\n=== Done ===');
}

// Run if invoked directly
const isMain = process.argv[1] && resolve(process.argv[1]) === resolve(import.meta.filename);
if (isMain) {
  main();
}
