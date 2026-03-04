#!/usr/bin/env node
/**
 * validate-image-links.mjs
 *
 * Checks that every content file has a matching image folder on disk.
 * Convention: content at src/content/{collection}/{subdir}/{slug}.md
 *          → images at public/images/{collection}/{subdir}/{slug}/
 *
 * Usage:
 *   node scripts/validate-image-links.mjs              # full report
 *   node scripts/validate-image-links.mjs --strict     # exit code 1 if mismatches
 *   node scripts/validate-image-links.mjs --collection guides   # one collection only
 *
 * Does NOT check products (they use imagePath in JSON, not the convention).
 */

import { readdirSync, statSync, existsSync } from 'node:fs';
import { join, relative, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = join(__dirname, '..');
const CONTENT_DIR = join(ROOT, 'src', 'content');
const IMAGES_DIR = join(ROOT, 'public', 'images');

// Collections that follow the convention (filename = image folder name)
const COLLECTIONS = ['games', 'brands', 'guides', 'news', 'reviews'];

// ─── Pure functions (exported for testing) ──────────────────────────────────

export function parseContentPath(relPath) {
  const parts = relPath.replace(/\\/g, '/').split('/');
  const collection = parts[0];
  let rest = parts.slice(1).join('/').replace(/\.(md|mdx)$/, '');
  rest = rest.replace(/\/index$/, '');
  return { collection, entryId: rest };
}

export function expectedImageFolder(collection, entryId) {
  return `images/${collection}/${entryId}`;
}

export function compareEntriesToFolders(entries, existingFolders) {
  const folderSet = new Set(existingFolders.map(f => f.replace(/\\/g, '/')));
  const expectedSet = new Set();

  const matched = [];
  const mismatched = [];

  for (const entry of entries) {
    const expected = expectedImageFolder(entry.collection, entry.entryId);
    expectedSet.add(expected);
    if (folderSet.has(expected)) {
      matched.push({ ...entry, expectedFolder: expected });
    } else {
      mismatched.push({ ...entry, expectedFolder: expected });
    }
  }

  const orphanFolders = existingFolders
    .map(f => f.replace(/\\/g, '/'))
    .filter(f => !expectedSet.has(f));

  return { matched, mismatched, orphanFolders };
}

// ─── Disk scanning ──────────────────────────────────────────────────────────

function walkFiles(dir, base) {
  const results = [];
  if (!existsSync(dir)) return results;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...walkFiles(fullPath, base));
    } else if (entry.isFile() && /\.(md|mdx)$/.test(entry.name)) {
      results.push(relative(base, fullPath));
    }
  }
  return results;
}

function walkImageDirs(dir, base, depth = 0, maxDepth = 3) {
  const results = [];
  if (!existsSync(dir) || depth > maxDepth) return results;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    if (entry.name === 'originals') continue; // skip originals subdirs
    const fullPath = join(dir, entry.name);
    const relPath = relative(base, fullPath).replace(/\\/g, '/');
    // Only add leaf-level image dirs (those that contain image files, not just subdirs)
    const children = readdirSync(fullPath, { withFileTypes: true });
    const hasFiles = children.some(c => c.isFile());
    if (hasFiles) {
      results.push(relPath);
    }
    // Also recurse into subdirs
    results.push(...walkImageDirs(fullPath, base, depth + 1, maxDepth));
  }
  return results;
}

// ─── Main ───────────────────────────────────────────────────────────────────

function main() {
  const args = process.argv.slice(2);
  const strict = args.includes('--strict');
  const collectionFilter = args.includes('--collection')
    ? args[args.indexOf('--collection') + 1]
    : null;

  const collections = collectionFilter
    ? [collectionFilter]
    : COLLECTIONS;

  let totalMatched = 0;
  let totalMismatched = 0;
  let totalOrphans = 0;
  const allMismatched = [];
  const allOrphans = [];

  for (const collection of collections) {
    const contentDir = join(CONTENT_DIR, collection);
    const imagesBaseDir = join(IMAGES_DIR, collection);

    // Scan content files
    const contentFiles = walkFiles(contentDir, CONTENT_DIR);
    const entries = contentFiles.map(f => {
      const parsed = parseContentPath(f);
      return { ...parsed, file: f };
    });

    // Scan image folders
    const imageFolders = walkImageDirs(imagesBaseDir, join(IMAGES_DIR, '..', '..', 'public'));

    const result = compareEntriesToFolders(entries, imageFolders);

    console.log(`\n═══ ${collection.toUpperCase()} ═══`);
    console.log(`  Content files:  ${entries.length}`);
    console.log(`  Image folders:  ${imageFolders.length}`);
    console.log(`  Matched:        ${result.matched.length}`);
    console.log(`  Mismatched:     ${result.mismatched.length}`);
    console.log(`  Orphan folders: ${result.orphanFolders.length}`);

    if (result.mismatched.length > 0) {
      console.log(`\n  MISMATCHED (content exists, expected image folder missing):`);
      for (const m of result.mismatched) {
        console.log(`    ✗ ${m.file}`);
        console.log(`      expected: public/${m.expectedFolder}/`);
      }
    }

    if (result.orphanFolders.length > 0) {
      console.log(`\n  ORPHAN FOLDERS (image folder exists, no matching content):`);
      for (const o of result.orphanFolders) {
        console.log(`    ? public/${o}/`);
      }
    }

    totalMatched += result.matched.length;
    totalMismatched += result.mismatched.length;
    totalOrphans += result.orphanFolders.length;
    allMismatched.push(...result.mismatched);
    allOrphans.push(...result.orphanFolders);
  }

  console.log(`\n════════════════════════════════════`);
  console.log(`TOTAL: ${totalMatched} matched, ${totalMismatched} mismatched, ${totalOrphans} orphan folders`);

  if (totalMismatched > 0) {
    console.log(`\n⚠ ${totalMismatched} content files have no matching image folder.`);
    console.log(`  Run the rename migration to fix these.`);
  }

  if (totalOrphans > 0) {
    console.log(`\n⚠ ${totalOrphans} orphan image folders have no matching content file.`);
    console.log(`  These are likely old folder names that need renaming.`);
  }

  if (totalMismatched === 0 && totalOrphans === 0) {
    console.log(`\n✓ All content files have matching image folders. Convention is fully satisfied.`);
  }

  if (strict && totalMismatched > 0) {
    process.exit(1);
  }
}

const isMain = process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, '/').split('/').pop());
if (isMain) {
  main();
}
