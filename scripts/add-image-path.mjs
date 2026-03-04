/**
 * add-image-path.mjs
 *
 * Adds `imagePath` field to every product in the 3 product JSON files.
 * Derives it from the existing `url` field:
 *   /hubs/mouse/alienware/aw610m → /images/mouse/alienware/aw610m
 *
 * Usage:
 *   node scripts/add-image-path.mjs --dry-run   # preview
 *   node scripts/add-image-path.mjs             # execute
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

// --- Pure functions (exported for testing) ---

export function deriveImagePath(url) {
  if (!url) throw new Error('url is required');
  if (!url.startsWith('/hubs/')) throw new Error('url must start with /hubs/');
  const segments = url.split('/').filter(Boolean); // ['hubs', 'mouse', 'alienware', 'aw610m']
  if (segments.length < 4) throw new Error('url must have at least 4 segments');
  return url.replace('/hubs/', '/images/');
}

export function addImagePathToProducts(products) {
  return products.map(product => {
    if (product.imagePath !== undefined) return { ...product };

    const imagePath = deriveImagePath(product.url);

    // Insert imagePath right after url in key order
    const result = {};
    for (const [key, value] of Object.entries(product)) {
      result[key] = value;
      if (key === 'url') {
        result.imagePath = imagePath;
      }
    }
    return result;
  });
}

// --- Orchestrator ---

const PRODUCT_FILES = [
  'src/data/products/mouse.json',
  'src/data/products/keyboard.json',
  'src/data/products/monitor.json',
];

function main() {
  const dryRun = process.argv.includes('--dry-run');
  const root = resolve(import.meta.dirname, '..');

  let totalProducts = 0;
  let totalAdded = 0;

  for (const relPath of PRODUCT_FILES) {
    const absPath = resolve(root, relPath);
    const products = JSON.parse(readFileSync(absPath, 'utf-8'));
    const alreadyHave = products.filter(p => p.imagePath !== undefined).length;
    const needsAdding = products.length - alreadyHave;

    const updated = addImagePathToProducts(products);

    totalProducts += products.length;
    totalAdded += needsAdding;

    console.log(`${relPath}: ${products.length} products, ${needsAdding} need imagePath`);

    if (!dryRun && needsAdding > 0) {
      writeFileSync(absPath, JSON.stringify(updated, null, 2) + '\n', 'utf-8');
      console.log(`  → written`);
    }
  }

  console.log(`\nTotal: ${totalProducts} products, ${totalAdded} updated`);
  if (dryRun) console.log('(dry run — no files changed)');
}

// Only run main when executed directly
const isMain = process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, '/').split('/').pop());
if (isMain) {
  main();
}
