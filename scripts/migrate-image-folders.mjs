#!/usr/bin/env node
/**
 * migrate-image-folders.mjs
 *
 * One-time migration: renames image folders to match the content filename convention.
 * Convention: content at src/content/{collection}/{subdir}/{slug}.md
 *          → images at public/images/{collection}/{subdir}/{slug}/
 *
 * Usage:
 *   node scripts/migrate-image-folders.mjs --dry-run    # preview changes
 *   node scripts/migrate-image-folders.mjs              # execute renames
 *
 * This script:
 * 1. Scans content files and image folders
 * 2. Identifies mismatched entries (content file exists, no matching image folder)
 * 3. Finds the best orphan folder match for each mismatch
 * 4. Renames orphan folders to match the convention
 *
 * Does NOT delete anything. Only renames.
 */

import { readdirSync, renameSync, cpSync, rmSync, existsSync, mkdirSync } from 'node:fs';
import { join, relative, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = join(__dirname, '..');
const CONTENT_DIR = join(ROOT, 'src', 'content');
const IMAGES_DIR = join(ROOT, 'public', 'images');
const PUBLIC_DIR = join(ROOT, 'public');

const COLLECTIONS = ['games', 'brands', 'guides', 'news', 'reviews'];

// ─── Pure functions ─────────────────────────────────────────────────────────

export function parseContentPath(relPath) {
  const parts = relPath.replace(/\\/g, '/').split('/');
  const collection = parts[0];
  const rest = parts.slice(1).join('/').replace(/\.(md|mdx)$/, '');
  return { collection, entryId: rest };
}

export function expectedImageFolder(collection, entryId) {
  return `images/${collection}/${entryId}`;
}

export function findBestMatch(entry, orphanFolders) {
  const { collection, entryId } = entry;
  const prefix = `images/${collection}/`;
  const relevantOrphans = orphanFolders.filter(f => f.startsWith(prefix));

  const parts = entryId.split('/');

  // Strategy 1: Strip category prefix
  if (parts.length >= 2) {
    const subdir = parts[0];
    const slug = parts.slice(1).join('/');
    if (slug.startsWith(subdir + '-')) {
      const stripped = subdir + '/' + slug.slice(subdir.length + 1);
      const candidate = `images/${collection}/${stripped}`;
      if (relevantOrphans.includes(candidate)) {
        return candidate;
      }
    }
  }

  // Strategy 2: Brand/model nesting → flat slug
  if (parts.length >= 2) {
    const subdir = parts[0];
    const slug = parts.slice(1).join('/');
    const withoutReview = slug.replace(/-review$/, '');
    for (const orphan of relevantOrphans) {
      const orphanRel = orphan.slice(prefix.length);
      const orphanParts = orphanRel.split('/');
      if (orphanParts[0] === subdir && orphanParts.length >= 3) {
        const nestedSlug = orphanParts.slice(1).join('-');
        if (nestedSlug === withoutReview) {
          return orphan;
        }
      }
    }
  }

  // Strategy 3: Fuzzy word overlap
  if (parts.length >= 2) {
    const subdir = parts[0];
    const slug = parts.slice(1).join('/');
    const slugWords = new Set(slug.replace(/-review$/, '').split('-'));

    let bestMatch = null;
    let bestScore = 0;

    for (const orphan of relevantOrphans) {
      const orphanRel = orphan.slice(prefix.length);
      const orphanParts = orphanRel.split('/');
      if (orphanParts[0] !== subdir) continue;

      const orphanSlug = orphanParts.slice(1).join('-');
      const orphanWords = new Set(orphanSlug.split('-'));

      let overlap = 0;
      for (const word of slugWords) {
        if (orphanWords.has(word)) overlap++;
      }
      const score = overlap / Math.max(slugWords.size, orphanWords.size);

      if (score > bestScore && score >= 0.4) {
        bestScore = score;
        bestMatch = orphan;
      }
    }

    if (bestMatch) return bestMatch;
  }

  return null;
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
    if (entry.name === 'originals') continue;
    const fullPath = join(dir, entry.name);
    const relPath = relative(base, fullPath).replace(/\\/g, '/');
    const children = readdirSync(fullPath, { withFileTypes: true });
    const hasFiles = children.some(c => c.isFile());
    if (hasFiles) {
      results.push(relPath);
    }
    results.push(...walkImageDirs(fullPath, base, depth + 1, maxDepth));
  }
  return results;
}

function compareEntriesToFolders(entries, existingFolders) {
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

// ─── Main ───────────────────────────────────────────────────────────────────

function main() {
  const dryRun = process.argv.includes('--dry-run');

  console.log(dryRun ? '=== DRY RUN ===' : '=== EXECUTING RENAMES ===');
  console.log();

  // Gather all entries and folders
  const allEntries = [];
  const allFolders = [];

  for (const collection of COLLECTIONS) {
    const contentDir = join(CONTENT_DIR, collection);
    const imagesBaseDir = join(IMAGES_DIR, collection);

    const contentFiles = walkFiles(contentDir, CONTENT_DIR);
    const entries = contentFiles.map(f => ({ ...parseContentPath(f), file: f }));
    allEntries.push(...entries);

    const imageFolders = walkImageDirs(imagesBaseDir, PUBLIC_DIR);
    allFolders.push(...imageFolders);
  }

  const { matched, mismatched, orphanFolders } = compareEntriesToFolders(allEntries, allFolders);

  console.log(`Already matched: ${matched.length}`);
  console.log(`Mismatched:      ${mismatched.length}`);
  console.log(`Orphan folders:  ${orphanFolders.length}`);
  console.log();

  // For each mismatch, find the best orphan match
  const renames = [];
  const unmatched = [];
  const usedOrphans = new Set();

  for (const entry of mismatched) {
    const availableOrphans = orphanFolders.filter(o => !usedOrphans.has(o));
    const match = findBestMatch(entry, availableOrphans);

    if (match) {
      renames.push({
        from: match,
        to: entry.expectedFolder,
        content: entry.file,
      });
      usedOrphans.add(match);
    } else {
      unmatched.push(entry);
    }
  }

  // Execute renames
  if (renames.length > 0) {
    console.log(`RENAMES (${renames.length}):`);
    for (const r of renames) {
      const fromAbs = join(PUBLIC_DIR, r.from);
      const toAbs = join(PUBLIC_DIR, r.to);
      console.log(`  ${r.content}`);
      console.log(`    ${r.from}/`);
      console.log(`    → ${r.to}/`);

      if (!dryRun) {
        const parentDir = dirname(toAbs);
        if (!existsSync(parentDir)) {
          mkdirSync(parentDir, { recursive: true });
        }
        try {
          renameSync(fromAbs, toAbs);
        } catch (e) {
          if (e.code === 'EPERM' || e.code === 'EBUSY') {
            // Windows fallback: copy then remove
            cpSync(fromAbs, toAbs, { recursive: true });
            rmSync(fromAbs, { recursive: true, force: true });
          } else {
            throw e;
          }
        }
        console.log(`    ✓ renamed`);
      }
      console.log();
    }
  }

  if (unmatched.length > 0) {
    console.log(`\nUNMATCHED (${unmatched.length} — no orphan folder found):`);
    for (const u of unmatched) {
      console.log(`  ✗ ${u.file} → expected: public/${u.expectedFolder}/`);
    }
  }

  // Summary
  console.log(`\n════════════════════════════════════`);
  console.log(`Renamed:    ${renames.length}`);
  console.log(`Unmatched:  ${unmatched.length}`);
  console.log(`Remaining orphans: ${orphanFolders.length - usedOrphans.size}`);

  if (dryRun && renames.length > 0) {
    console.log(`\nRun without --dry-run to execute these renames.`);
  }
}

const isMain = process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, '/').split('/').pop());
if (isMain) {
  main();
}
