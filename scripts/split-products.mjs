/**
 * split-products.mjs — One-time migration script
 *
 * Reads monolith JSON files (mouse.json, keyboard.json, monitor.json)
 * and writes individual product JSON files to:
 *   src/content/data-products/{category}/{brand-slug}/{product-slug}.json
 *
 * Adds:  baseModel, variant
 * Removes: base_model (replaced by baseModel)
 *
 * File name derived from imagePath (the stable identifier).
 * slug field updated to match imagePath convention.
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';

// ── Paths ──────────────────────────────────────────────────────────────────
const ROOT = process.cwd();
const DATA_DIR = join(ROOT, 'src', 'data', 'products');
const OUT_DIR = join(ROOT, 'src', 'content', 'data-products');
const CATEGORIES = ['mouse', 'keyboard', 'monitor'];

// ── Manual overrides for products where auto-derivation fails ──────────────
// Key = current slug field value (the only guaranteed unique key per product)
const OVERRIDES = {
  // ── Acer: numeric base_model → Cestus is the family ──
  'acer-cestus-310':  { baseModel: 'Cestus', variant: '310' },
  'acer-cestus-330':  { baseModel: 'Cestus', variant: '330' },
  'acer-cestus-335':  { baseModel: 'Cestus', variant: '335' },
  'acer-cestus-350':  { baseModel: 'Cestus', variant: '350' },

  // ── Alienware: numeric base_model → standalone model codes, no variant ──
  'alienware-aw610m':       { baseModel: 'AW610M', variant: '' },
  'alienware-aw620m':       { baseModel: 'AW620M', variant: '' },
  'alienware-aw720m':       { baseModel: 'AW720M', variant: '' },
  'alienware-aw320m':       { baseModel: 'AW320M', variant: '' },

  // ── Corsair: typo in base_model (M66 → M65) ──
  'corsair-m65-rgb-elite':  { baseModel: 'M65', variant: 'RGB Elite' },

  // ── Endgame Gear: "w"/"we" suffix is part of model name ──
  'endgame-gear-xm2w-4k-wireless':  { baseModel: 'XM2w', variant: '4k Wireless' },
  'endgame-gear-op1w-4k-wireless':  { baseModel: 'OP1w', variant: '4k Wireless' },
  'endgame-gear-op1we-wireless':    { baseModel: 'OP1we', variant: 'Wireless' },
  'endgame-gear-xm2we-wireless':    { baseModel: 'XM2we', variant: 'Wireless' },

  // ── Finalmouse: " - " dash separator in model ──
  'finalmouse-ulx-prophecy-clix':   { baseModel: 'ULX Prophecy', variant: 'Clix' },
  'finalmouse-ulx-prophecy-scream': { baseModel: 'ULX Prophecy', variant: 'Scream' },
  'finalmouse-ulx-prophecy-tarik':  { baseModel: 'ULX Prophecy', variant: 'Tarik' },
  'finalmouse-ulx-prophecy-tfue':   { baseModel: 'ULX Prophecy', variant: 'Tfue' },

  // ── G-Wolves: dash in model name (Hati-S, Hati-M) ──
  'g-wolves-hati-s-ace-wireless':        { baseModel: 'Hati-S', variant: 'ACE Wireless' },
  'g-wolves-hati-s-open-source-wireless':{ baseModel: 'Hati-S', variant: 'OPEN Source Wireless' },
  'g-wolves-hati-s-hts-ace-wired':       { baseModel: 'Hati-S HTS', variant: 'ACE Wired' },
  // G-Wolves: base_model "HatiHTM" has no space vs model "Hati HTM"
  'g-wolves-hati-htm-ace-wired':    { baseModel: 'Hati HTM', variant: 'ACE Wired' },
  'g-wolves-hati-htm-classic-wired':{ baseModel: 'Hati HTM', variant: 'Classic Wired' },
  // G-Wolves: base_model "SKS" vs model "SK-S"
  'g-wolves-skoll-mini-sk-s-wired': { baseModel: 'Skoll Mini', variant: 'SK-S Wired' },

  // ── Glorious: "O2"/"D2" space mismatch vs "O 2"/"D 2" ──
  'glorious-model-o-2-wireless':                        { baseModel: 'Model O 2', variant: 'Wireless' },
  'glorious-model-o-2-wired':                           { baseModel: 'Model O 2', variant: 'Wired' },
  'glorious-model-o-2-mini-wireless':                   { baseModel: 'Model O 2 Mini', variant: 'Wireless' },
  'glorious-model-o-2-mini-wired':                      { baseModel: 'Model O 2 Mini', variant: 'Wired' },
  'glorious-model-o-2-pro-series-wireless-8khz-edition':{ baseModel: 'Model O 2 PRO', variant: 'Series Wireless 8KHz Edition' },
  'glorious-model-o-2-pro-series':                      { baseModel: 'Model O 2 PRO', variant: 'Series' },
  'glorious-model-d-2-pro-series-wireless':             { baseModel: 'Model D 2 PRO', variant: 'Series Wireless' },
  'glorious-model-d-2-pro-series-wireless-8khz-edition':{ baseModel: 'Model D 2 PRO', variant: 'Series Wireless 8Khz Edition' },
  'glorious-model-d-2-wireless':                        { baseModel: 'Model D 2', variant: 'Wireless' },
  'glorious-model-d-2-wired':                           { baseModel: 'Model D 2', variant: 'Wired' },
  // Glorious: typo in base_model ("I 3" → should be "I 2")
  'glorious-model-i-2-wired':                           { baseModel: 'Model I 2', variant: 'Wired' },

  // ── Logitech G: "Superlight" elided from base_model ──
  'logitech-g-pro-x-superlight-2-dex': { baseModel: 'Pro X Superlight 2', variant: 'Dex' },

  // ── Mad Catz: base_model points to wrong product (next model up) ──
  'mad-catz-m-o-j-o-m1':        { baseModel: 'M.O.J.O.', variant: 'M1' },
  'mad-catz-m-o-j-o-m2':        { baseModel: 'M.O.J.O.', variant: 'M2' },
  'mad-catz-r-a-t-pro-x3':      { baseModel: 'R.A.T. PRO', variant: 'X3' },
  'mad-catz-r-a-t-pro-s3':      { baseModel: 'R.A.T. PRO', variant: 'S3' },

  // ── Pulsar: various base_model issues ──
  // Trailing space in base_model "X2A eS "
  // (handled by trim in auto-derive, but explicit for clarity)
  'pulsar-x2a-es':                     { baseModel: 'X2A', variant: 'eS' },
  'pulsar-founders-edition-x2a-es':    { baseModel: 'X2A', variant: '[Founders Edition] eS' },
  // Wrong base: "X2 v2 Mini" when product is "X2 v2"
  'pulsar-founders-edition-x2-v2':     { baseModel: 'X2', variant: '[Founders Edition] v2' },
  // Case mismatch "V1" vs "v1"
  'pulsar-x2-v1':                      { baseModel: 'X2', variant: 'v1' },

  // ── Redragon: typo (base_model "M616" for M693 product) ──
  'redragon-trident-m693':  { baseModel: 'Trident', variant: 'M693' },

  // ── Redragon: EISA prefix not in base ──
  'redragon-eisa-k1ng-m916-pro-1khz': { baseModel: 'K1NG M916', variant: 'Pro (1khz)' },
};

// ── Auto-derivation logic ──────────────────────────────────────────────────

/**
 * Derive baseModel + variant from model string and base_model hint.
 *
 * Algorithm:
 * 1. If base_model is empty/null or same as model → no variant
 * 2. Find base_model in model (case-insensitive)
 * 3. Everything BEFORE + the match = baseModel (includes prefix like "ROG", "Pulsefire")
 * 4. Everything AFTER = variant
 * 5. If not found → baseModel = model, variant = ""
 */
function deriveVariant(model, rawBase) {
  const baseStr = String(rawBase ?? '').trim();

  // No base_model, or same as model → no variant
  if (!baseStr || model === baseStr) {
    return { baseModel: model, variant: '' };
  }

  // Skip numeric base_model — these should be in OVERRIDES
  if (typeof rawBase === 'number' || /^\d+$/.test(baseStr)) {
    return { baseModel: model, variant: '' };
  }

  const modelLower = model.toLowerCase();
  const baseLower = baseStr.toLowerCase();

  // Case-insensitive indexOf
  const idx = modelLower.indexOf(baseLower);

  if (idx === -1) {
    // base_model not found in model at all — can't derive
    return { baseModel: model, variant: '' };
  }

  // baseModel = everything up to and including the match
  const endIdx = idx + baseLower.length;
  const actualBase = model.slice(0, endIdx).trim();

  // variant = everything after, with leading dashes/spaces stripped
  const variant = model.slice(endIdx).replace(/^[\s\-–—]+/, '').trim();

  return { baseModel: actualBase, variant };
}

// ── Main ───────────────────────────────────────────────────────────────────

const stats = { total: 0, overridden: 0, autoDerive: 0, noVariant: 0, errors: [] };
const allProducts = []; // For summary log

for (const category of CATEGORIES) {
  const filePath = join(DATA_DIR, `${category}.json`);
  if (!existsSync(filePath)) {
    console.log(`⚠ ${category}.json not found, skipping`);
    continue;
  }

  const products = JSON.parse(readFileSync(filePath, 'utf-8'));
  console.log(`\n── ${category}: ${products.length} products ──`);

  for (const product of products) {
    stats.total++;

    // 1. Parse imagePath to get brand-slug and product-slug
    const imgParts = product.imagePath.split('/').filter(Boolean);
    // imagePath: /images/{category}/{brand-slug}/{product-slug}
    if (imgParts.length < 4) {
      const msg = `Bad imagePath: ${product.imagePath} (${product.slug})`;
      stats.errors.push(msg);
      console.error(`  ERROR: ${msg}`);
      continue;
    }
    const brandSlug = imgParts[2];
    const productSlug = imgParts[3];

    // 2. Derive baseModel + variant
    let baseModel, variant, source;
    const override = OVERRIDES[product.slug];

    if (override) {
      baseModel = override.baseModel;
      variant = override.variant;
      source = 'override';
      stats.overridden++;
    } else {
      const derived = deriveVariant(product.model, product.base_model);
      baseModel = derived.baseModel;
      variant = derived.variant;
      source = variant ? 'auto' : 'no-variant';
      if (variant) stats.autoDerive++;
      else stats.noVariant++;
    }

    // 3. Build new slug from imagePath (consistent with url field)
    const newSlug = `${brandSlug}-${productSlug}`;

    // 4. Build output object
    const { base_model: _removed, slug: _oldSlug, ...rest } = product;
    const output = {
      slug: newSlug,
      brand: product.brand,
      model: product.model,
      baseModel,
      variant,
      ...rest,
    };
    // Remove duplicate brand/model since they're in rest too
    // Actually they need to be at the top for readability,
    // so we delete from rest to avoid duplication
    delete output.brand;
    delete output.model;

    // Re-order: identity fields first
    const ordered = {
      slug: newSlug,
      brand: product.brand,
      model: product.model,
      baseModel,
      variant,
      category: product.category,
      imagePath: product.imagePath,
    };
    // Copy remaining fields (skip ones already set)
    const skipKeys = new Set(['slug', 'brand', 'model', 'base_model', 'baseModel', 'variant', 'category', 'imagePath']);
    for (const [k, v] of Object.entries(product)) {
      if (!skipKeys.has(k)) {
        ordered[k] = v;
      }
    }

    // 5. Write file
    const outDir = join(OUT_DIR, category, brandSlug);
    mkdirSync(outDir, { recursive: true });
    const outFile = join(outDir, `${productSlug}.json`);
    writeFileSync(outFile, JSON.stringify(ordered, null, 2) + '\n');

    // 6. Log
    allProducts.push({
      category,
      brand: product.brand,
      model: product.model,
      baseModel,
      variant: variant || '(none)',
      source,
      file: `${category}/${brandSlug}/${productSlug}.json`,
    });
  }
}

// ── Summary ────────────────────────────────────────────────────────────────
console.log('\n══════════════════════════════════════════');
console.log(`Total:      ${stats.total}`);
console.log(`Overrides:  ${stats.overridden}`);
console.log(`Auto-derive:${stats.autoDerive}`);
console.log(`No variant: ${stats.noVariant}`);
console.log(`Errors:     ${stats.errors.length}`);

if (stats.errors.length > 0) {
  console.log('\nErrors:');
  stats.errors.forEach(e => console.log(`  - ${e}`));
}

// Write review log
const logPath = join(ROOT, 'scripts', 'split-products-review.log');
const lines = [
  'CATEGORY | BRAND | MODEL | BASE_MODEL | VARIANT | SOURCE | FILE',
  '-'.repeat(120),
  ...allProducts.map(p =>
    `${p.category} | ${p.brand} | ${p.model} | ${p.baseModel} | ${p.variant} | ${p.source} | ${p.file}`
  ),
];
writeFileSync(logPath, lines.join('\n') + '\n');
console.log(`\nReview log: scripts/split-products-review.log`);
