#!/usr/bin/env node
/**
 * migrate-to-slug-folders.mjs
 *
 * Converts flat article content files to slug-folder structure:
 *   {slug}.md  →  {slug}/index.md
 *   mouse/{slug}.md  →  mouse/{slug}/index.md
 *
 * Usage:
 *   node scripts/migrate-to-slug-folders.mjs --all                # migrate all collections
 *   node scripts/migrate-to-slug-folders.mjs --all --dry-run      # preview only
 *   node scripts/migrate-to-slug-folders.mjs reviews guides       # specific collections
 *
 * Idempotent: skips files already at slug/index.{md,mdx}.
 * Never deletes. Windows-safe (cpSync fallback on EPERM).
 */

import { existsSync, mkdirSync, renameSync, cpSync, unlinkSync, readdirSync } from 'node:fs';
import { join, dirname, basename, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = join(__dirname, '..');
const CONTENT_DIR = join(ROOT, 'src', 'content');

const COLLECTIONS = ['reviews', 'guides', 'news', 'games', 'brands', 'pages'];

// ─── Pure functions (exported for testing) ──────────────────────────────────

/**
 * Given a relative file path (within a collection dir),
 * derive the slug-folder target path.
 * Returns null if already in slug-folder form.
 *
 * Examples:
 *   "apex-legends.md" → "apex-legends/index.md"
 *   "mouse/slug.md"   → "mouse/slug/index.md"
 *   "slug/index.md"   → null (already migrated)
 */
export function deriveTarget(relPath) {
  const normalized = relPath.replace(/\\/g, '/');
  if (shouldSkip(normalized)) return null;

  const ext = extname(normalized);              // .md or .mdx
  const withoutExt = normalized.slice(0, -ext.length);
  return `${withoutExt}/index${ext}`;
}

/**
 * Returns true if the file is already in slug-folder form (index.md/index.mdx).
 */
export function shouldSkip(relPath) {
  const normalized = relPath.replace(/\\/g, '/');
  return /\/index\.(md|mdx)$/.test(normalized);
}

// ─── File scanning ──────────────────────────────────────────────────────────

function walkFiles(dir, base) {
  const results = [];
  if (!existsSync(dir)) return results;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...walkFiles(fullPath, base));
    } else if (entry.isFile() && /\.(md|mdx)$/.test(entry.name)) {
      results.push({
        abs: fullPath,
        rel: fullPath.slice(base.length + 1).replace(/\\/g, '/'),
      });
    }
  }
  return results;
}

// ─── Safe rename (Windows-safe) ─────────────────────────────────────────────

function safeRename(from, to) {
  const targetDir = dirname(to);
  if (!existsSync(targetDir)) {
    mkdirSync(targetDir, { recursive: true });
  }
  try {
    renameSync(from, to);
  } catch (e) {
    if (e.code === 'EPERM' || e.code === 'EBUSY') {
      cpSync(from, to);
      unlinkSync(from);
    } else {
      throw e;
    }
  }
}

// ─── Main ───────────────────────────────────────────────────────────────────

function main() {
  const args = process.argv.slice(2).filter(a => a !== '--dry-run' && a !== '--all');
  const dryRun = process.argv.includes('--dry-run');
  const all = process.argv.includes('--all');

  const collections = all ? COLLECTIONS : args;

  if (collections.length === 0) {
    console.log('Usage: node scripts/migrate-to-slug-folders.mjs --all [--dry-run]');
    console.log('       node scripts/migrate-to-slug-folders.mjs reviews guides [--dry-run]');
    process.exit(1);
  }

  for (const col of collections) {
    if (!COLLECTIONS.includes(col)) {
      console.error(`Unknown collection: ${col}`);
      process.exit(1);
    }
  }

  console.log(dryRun ? '=== DRY RUN ===' : '=== MIGRATING ===');
  console.log();

  let totalMigrated = 0;
  let totalSkipped = 0;

  for (const collection of collections) {
    const collDir = join(CONTENT_DIR, collection);
    const files = walkFiles(collDir, collDir);

    let migrated = 0;
    let skipped = 0;

    for (const { abs, rel } of files) {
      const target = deriveTarget(rel);
      if (target === null) {
        skipped++;
        continue;
      }

      const targetAbs = join(collDir, target);
      if (existsSync(targetAbs)) {
        console.log(`  SKIP (target exists): ${collection}/${rel}`);
        skipped++;
        continue;
      }

      console.log(`  ${collection}/${rel} → ${collection}/${target}`);
      if (!dryRun) {
        safeRename(abs, targetAbs);
      }
      migrated++;
    }

    console.log(`  ${collection}: ${migrated} migrated, ${skipped} skipped`);
    console.log();

    totalMigrated += migrated;
    totalSkipped += skipped;
  }

  console.log(`════════════════════════════════════`);
  console.log(`TOTAL: ${totalMigrated} migrated, ${totalSkipped} skipped`);
  if (dryRun) {
    console.log('Dry run complete. Run without --dry-run to execute.');
  }
}

const isMain = process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, '/').split('/').pop());
if (isMain) {
  main();
}
