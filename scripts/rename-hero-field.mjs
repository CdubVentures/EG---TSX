#!/usr/bin/env node
// ─── One-time migration: heroImg → hero ─────────────────────────────────────
// Renames the frontmatter field in ALL article .md/.mdx files.
// Also fixes 5 broken full-path values → correct bare stems.
// Also backfills 49 articles that were missing the field entirely.
//
// Usage: node scripts/rename-hero-field.mjs [--dry-run]

import fs from 'node:fs';
import path from 'node:path';

const DRY_RUN = process.argv.includes('--dry-run');
const CONTENT_ROOT = path.resolve('src/content');
const IMAGES_ROOT = path.resolve('public/images');

// ─── Explicit fixes for 5 articles with full-path heroImg values ─────────
// These had full /images/... paths instead of bare stems, AND some pointed
// to wrong stems. Map: entryId → correct bare stem.
const FULL_PATH_FIXES = {
  'mouse/mouse-corsair-scimitar-elite-wireless-se-vs-elite-wireless': 'hero-img',
  'mouse/mouse-rog-harpe-ace-extreme-vs-harpe-ace-mini-vs-harpe-ace-aim-lab': 'carbon-fiber-hero',
  'monitor/philips-aoc-announce-dual-mode-1-000hz-gaming-monitors-ahead-of-ces-2026': 'dual-mode-stage-reveal',
  'mouse/razer-brings-back-the-boomslang-20th-anniversary-edition-what-we-know-so-far': 'boomslang-20th-bottom-serial',
  'monitor/dell-aw2725q-4k-240hz-qd-oled-now-available-a-game-changer-for-2025-gaming': 'aw2725q-front',
};

// ─── Default stems for articles missing heroImg ──────────────────────────
// Determined by checking actual image files on disk.
const BACKFILL_STEMS = {
  // Reviews
  'game/call-of-duty-black-ops-7-review-fun-to-play-tough-to-love': 'hero-img',
  'mouse/alienware-aw610m-review': 'feature-image',
  // Guides
  'hardware/hardware-highlighted-products': 'hero-img',
  // mouse/mouse-buyer-s-guide — NO images on disk, skip
  // News
  'ai/common-sense-machines-unveils-ai-platform-for-real-time-level-generation-in-games': 'hero-img',
  'ai/nvidia-ace-autonomous-characters-debut-in-major-titles-redefining-npc-interaction': 'ace-autonomous-characters-diagram',
  'hardware/nvidia-n1x-cpu-what-we-actually-know-so-far': 'hero-img',
  'hardware/valve-unveils-steam-machine-new-steam-controller-and-steam-frame-vr-living-room-pc-gaming-returns-in-2026': 'hero-img',
  'mouse/esports-events-2025-what-mice-are-the-pros-using': 'hero-img',
  'mouse/logitech-g-pro-x-superlight-3-rumors-everything-leaked-so-far': 'hero-img',
  'mouse/razer-deathadder-v4-pro-lighter-faster-and-already-winning-tournaments': 'hero-img',
  'mouse/razer-viper-v4-pro-leak-what-we-know-and-what-s-still-missing': 'hero-img',
  // Games (all use box-art-cover)
  'apex-legends': 'box-art-cover',
  'call-of-duty-warzone': 'box-art-cover',
  'counter-strike-2': 'box-art-cover',
  'dota-2': 'box-art-cover',
  'fortnite': 'box-art-cover',
  'league-of-legends': 'box-art-cover',
  'overwatch-2': 'box-art-cover',
  'pubg': 'box-art-cover',
  'rainbow-six-siege': 'box-art-cover',
  'valorant': 'box-art-cover',
  'world-of-warcraft': 'box-art-cover',
  // Brands (all use brand-logo-horizontal-index)
  'aorus': 'brand-logo-horizontal-index',
  'asus': 'brand-logo-horizontal-index',
  'cooler-master': 'brand-logo-horizontal-index',
  'corsair': 'brand-logo-horizontal-index',
  'cougar': 'brand-logo-horizontal-index',
  'endgame-gear': 'brand-logo-horizontal-index',
  'evga': 'brand-logo-horizontal-index',
  'finalmouse': 'brand-logo-horizontal-index',
  'fnatic': 'brand-logo-horizontal-index',
  'g-wolves': 'brand-logo-horizontal-index',
  'glorious': 'brand-logo-horizontal-index',
  'hyperx': 'brand-logo-horizontal-index',
  'lamzu': 'brand-logo-horizontal-index',
  'lenovo-legion': 'brand-logo-horizontal-index',
  'logitech-g': 'brand-logo-horizontal-index',
  'mad-catz': 'brand-logo-horizontal-index',
  'msi': 'brand-logo-horizontal-index',
  'nzxt': 'brand-logo-horizontal-index',
  'pulsar': 'brand-logo-horizontal-index',
  'pwnage': 'brand-logo-horizontal-index',
  'razer': 'brand-logo-horizontal-index',
  'redragon': 'brand-logo-horizontal-index',
  'roccat': 'brand-logo-horizontal-index',
  'steelseries': 'brand-logo-horizontal-index',
  'thermaltake': 'brand-logo-horizontal-index',
  'turtle-beach': 'brand-logo-horizontal-index',
  'zowie': 'brand-logo-horizontal-index',
  // Pages — no images on disk, skip
};

// Collections that use the hero field
const COLLECTIONS = ['reviews', 'guides', 'news', 'games', 'brands', 'pages'];

let stats = { renamed: 0, fixed: 0, backfilled: 0, skipped: 0 };

function walkMd(dir) {
  const files = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...walkMd(full));
    } else if (/index\.(md|mdx)$/.test(entry.name)) {
      files.push(full);
    }
  }
  return files;
}

function getEntryId(filePath, collection) {
  const collectionDir = path.join(CONTENT_ROOT, collection);
  const rel = path.relative(collectionDir, filePath).replace(/\\/g, '/');
  return rel.replace(/\/index\.(md|mdx)$/, '');
}

function processFile(filePath, collection) {
  let content = fs.readFileSync(filePath, 'utf-8');
  const entryId = getEntryId(filePath, collection);

  // Normalize line endings to LF for consistent regex matching
  const hadCRLF = content.includes('\r\n');
  content = content.replace(/\r\n/g, '\n');

  // Check if this file has frontmatter
  if (!content.startsWith('---')) return;

  const endIdx = content.indexOf('---', 3);
  if (endIdx === -1) return;

  const frontmatter = content.slice(0, endIdx + 3);
  const body = content.slice(endIdx + 3);

  let newFrontmatter = frontmatter;
  let action = null;

  // Case 1: Has heroImg with multiline value (>- syntax) — these are the full-path ones
  const multilineMatch = frontmatter.match(/^heroImg: >-\n\s+(.+)$/m);
  if (multilineMatch) {
    const fixedStem = FULL_PATH_FIXES[entryId];
    if (fixedStem) {
      // Replace the multiline heroImg with single-line hero using correct stem
      newFrontmatter = newFrontmatter.replace(
        /^heroImg: >-\n\s+.+$/m,
        `hero: ${fixedStem}`
      );
      action = 'fixed';
      stats.fixed++;
    } else {
      console.warn(`  WARN: ${collection}/${entryId} has multiline heroImg but no fix mapping`);
      // Still rename the field — collapse multiline to single line
      const val = multilineMatch[1].trim();
      newFrontmatter = newFrontmatter.replace(
        /^heroImg: >-\n\s+.+$/m,
        `hero: ${val}`
      );
      action = 'renamed';
      stats.renamed++;
    }
  }
  // Case 2: Has heroImg with inline value — simple rename
  else if (/^heroImg:\s+/m.test(frontmatter)) {
    newFrontmatter = newFrontmatter.replace(
      /^heroImg:\s+(.+)$/m,
      (_, val) => `hero: ${val.trim()}`
    );
    action = 'renamed';
    stats.renamed++;
  }
  // Case 3: Missing heroImg — backfill if we have a stem
  else {
    const stem = BACKFILL_STEMS[entryId];
    if (stem) {
      const lines = newFrontmatter.split('\n');
      const closingIdx = lines.lastIndexOf('---');

      // Find a good insertion point — after date/author fields if present
      let insertIdx = closingIdx;
      for (let i = 0; i < closingIdx; i++) {
        if (/^(datePublished|dateUpdated|author|heroCredit):/.test(lines[i])) {
          insertIdx = i + 1;
        }
      }
      lines.splice(insertIdx, 0, `hero: ${stem}`);
      newFrontmatter = lines.join('\n');
      action = 'backfilled';
      stats.backfilled++;
    } else {
      stats.skipped++;
      return;
    }
  }

  // Also rename heroAltImg → heroAlt if present (games only)
  if (/^heroAltImg:/m.test(newFrontmatter)) {
    newFrontmatter = newFrontmatter.replace(/^heroAltImg:/m, 'heroAlt:');
  }

  if (newFrontmatter !== frontmatter) {
    let result = newFrontmatter + body;
    // Restore original line endings
    if (hadCRLF) result = result.replace(/\n/g, '\r\n');

    if (DRY_RUN) {
      console.log(`  [DRY] ${action}: ${collection}/${entryId}`);
    } else {
      fs.writeFileSync(filePath, result, 'utf-8');
      console.log(`  ${action}: ${collection}/${entryId}`);
    }
  }
}

console.log(`\n${DRY_RUN ? '[DRY RUN] ' : ''}Renaming heroImg → hero in frontmatter...\n`);

for (const collection of COLLECTIONS) {
  const dir = path.join(CONTENT_ROOT, collection);
  if (!fs.existsSync(dir)) continue;

  console.log(`── ${collection} ──`);
  const files = walkMd(dir);
  for (const f of files) {
    processFile(f, collection);
  }
}

console.log(`\nDone. renamed=${stats.renamed} fixed=${stats.fixed} backfilled=${stats.backfilled} skipped=${stats.skipped}`);
