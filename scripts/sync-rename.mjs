#!/usr/bin/env node
/**
 * sync-rename.mjs
 *
 * Renames BOTH a content file AND its image folder atomically.
 * Convention: content at src/content/{collection}/{entryId}.md
 *          → images at public/images/{collection}/{entryId}/
 *
 * Usage:
 *   node scripts/sync-rename.mjs <collection> <old-entry-id> <new-entry-id>
 *   node scripts/sync-rename.mjs <collection> <old-entry-id> <new-entry-id> --dry-run
 *
 * Examples:
 *   node scripts/sync-rename.mjs games apex-legends apex-legends-2
 *   node scripts/sync-rename.mjs guides mouse/mouse-best-overall mouse/mouse-top-picks
 *   node scripts/sync-rename.mjs reviews mouse/alienware-aw610m-review mouse/alienware-aw610m-v2-review --dry-run
 *
 * Only renames — never deletes. If the target already exists, it refuses.
 */

import { existsSync, renameSync, cpSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = join(__dirname, '..');

const COLLECTIONS = ['games', 'brands', 'guides', 'news', 'reviews'];

function validateArgs(collection, oldEntryId, newEntryId) {
  if (!collection) throw new Error('collection is required');
  if (!oldEntryId) throw new Error('old entry ID is required');
  if (!newEntryId) throw new Error('new entry ID is required');
  if (oldEntryId === newEntryId) throw new Error('old and new entry IDs must be different');
  if (!COLLECTIONS.includes(collection)) throw new Error(`unknown collection: ${collection}`);
}

function computePaths(collection, oldEntryId, newEntryId) {
  const contentBase = join(ROOT, 'src', 'content', collection);

  // Detect slug-folder mode: {entryId}/index.{md,mdx}
  const slugFolderMd  = join(contentBase, oldEntryId, 'index.md');
  const slugFolderMdx = join(contentBase, oldEntryId, 'index.mdx');

  if (existsSync(slugFolderMd) || existsSync(slugFolderMdx)) {
    const ext = existsSync(slugFolderMdx) ? '.mdx' : '.md';
    return {
      contentFrom: join(contentBase, oldEntryId, `index${ext}`),
      contentTo:   join(contentBase, newEntryId, `index${ext}`),
      contentDirFrom: join(contentBase, oldEntryId),
      contentDirTo:   join(contentBase, newEntryId),
      imagesFrom:  join(ROOT, 'public', 'images', collection, oldEntryId),
      imagesTo:    join(ROOT, 'public', 'images', collection, newEntryId),
      mode: 'slug-folder',
    };
  }

  // Flat mode fallback: {entryId}.{md,mdx}
  const mdxPath = join(contentBase, `${oldEntryId}.mdx`);
  const ext = existsSync(mdxPath) ? '.mdx' : '.md';

  return {
    contentFrom: join(contentBase, `${oldEntryId}${ext}`),
    contentTo:   join(contentBase, `${newEntryId}${ext}`),
    imagesFrom:  join(ROOT, 'public', 'images', collection, oldEntryId),
    imagesTo:    join(ROOT, 'public', 'images', collection, newEntryId),
    mode: 'flat',
  };
}

function safeRename(from, to) {
  try {
    renameSync(from, to);
  } catch (e) {
    if (e.code === 'EPERM' || e.code === 'EBUSY') {
      cpSync(from, to, { recursive: true });
      rmSync(from, { recursive: true, force: true });
    } else {
      throw e;
    }
  }
}

function main() {
  const args = process.argv.slice(2).filter(a => a !== '--dry-run');
  const dryRun = process.argv.includes('--dry-run');

  if (args.length !== 3) {
    console.log('Usage: node scripts/sync-rename.mjs <collection> <old-entry-id> <new-entry-id> [--dry-run]');
    console.log('');
    console.log('Examples:');
    console.log('  node scripts/sync-rename.mjs games apex-legends apex-legends-2');
    console.log('  node scripts/sync-rename.mjs guides mouse/mouse-best-overall mouse/mouse-top-picks');
    process.exit(1);
  }

  const [collection, oldEntryId, newEntryId] = args;
  validateArgs(collection, oldEntryId, newEntryId);

  const paths = computePaths(collection, oldEntryId, newEntryId);

  console.log(dryRun ? '=== DRY RUN ===' : '=== EXECUTING ===');
  console.log();

  // Pre-flight checks
  const contentExists = existsSync(paths.contentFrom);
  const imagesExist = existsSync(paths.imagesFrom);
  const contentTargetExists = paths.mode === 'slug-folder'
    ? existsSync(paths.contentDirTo)
    : existsSync(paths.contentTo);
  const imagesTargetExists = existsSync(paths.imagesTo);

  const contentLabel = paths.mode === 'slug-folder' ? paths.contentDirFrom : paths.contentFrom;
  console.log(`Content: ${contentExists ? '✓' : '✗'} ${contentLabel} (${paths.mode})`);
  console.log(`Images:  ${imagesExist ? '✓' : '✗'} ${paths.imagesFrom}`);
  console.log();

  if (contentTargetExists) {
    const targetLabel = paths.mode === 'slug-folder' ? paths.contentDirTo : paths.contentTo;
    console.error(`ERROR: Target content already exists: ${targetLabel}`);
    process.exit(1);
  }
  if (imagesTargetExists) {
    console.error(`ERROR: Target image folder already exists: ${paths.imagesTo}`);
    process.exit(1);
  }
  if (!contentExists && !imagesExist) {
    console.error('ERROR: Neither content file nor image folder found for old entry ID.');
    process.exit(1);
  }

  // Rename content — slug-folder: rename entire directory; flat: rename single file
  if (contentExists) {
    if (paths.mode === 'slug-folder') {
      console.log(`Rename content folder:`);
      console.log(`  ${paths.contentDirFrom}/`);
      console.log(`  → ${paths.contentDirTo}/`);
      if (!dryRun) {
        safeRename(paths.contentDirFrom, paths.contentDirTo);
        console.log('  ✓ done');
      }
    } else {
      console.log(`Rename content file:`);
      console.log(`  ${paths.contentFrom}`);
      console.log(`  → ${paths.contentTo}`);
      if (!dryRun) {
        safeRename(paths.contentFrom, paths.contentTo);
        console.log('  ✓ done');
      }
    }
  } else {
    console.log('Content file not found — skipping.');
  }

  // Rename image folder
  if (imagesExist) {
    console.log(`Rename images:`);
    console.log(`  ${paths.imagesFrom}`);
    console.log(`  → ${paths.imagesTo}`);
    if (!dryRun) {
      safeRename(paths.imagesFrom, paths.imagesTo);
      console.log('  ✓ done');
    }
  } else {
    console.log('Image folder not found — skipping.');
  }

  console.log();
  console.log(dryRun ? 'Dry run complete. Run without --dry-run to execute.' : 'Sync rename complete.');
}

const isMain = process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, '/').split('/').pop());
if (isMain) {
  main();
}
