#!/usr/bin/env node
/**
 * migrate-brand-categories.mjs — One-time idempotent migration.
 *
 * For each brand file in src/content/brands/SLUG/index.md,
 * reads frontmatter, finds the navbar YAML list,
 * inserts categories with identical values immediately before navbar,
 * and leaves navbar untouched.
 *
 * Idempotent — skips files that already have a categories field.
 */

import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const BRANDS_DIR = join(import.meta.dirname, '..', 'src', 'content', 'brands');

let updated = 0;
let skipped = 0;

const brandDirs = readdirSync(BRANDS_DIR, { withFileTypes: true })
  .filter(d => d.isDirectory())
  .map(d => d.name)
  .sort();

for (const dir of brandDirs) {
  const filePath = join(BRANDS_DIR, dir, 'index.md');
  let text;
  try {
    text = readFileSync(filePath, 'utf-8');
  } catch {
    console.log(`  SKIP ${dir} — no index.md`);
    skipped++;
    continue;
  }

  // Already has categories: — skip
  if (/^categories:/m.test(text)) {
    console.log(`  SKIP ${dir} — already has categories:`);
    skipped++;
    continue;
  }

  // Find navbar: line and its list items
  const lines = text.split('\n');
  let navbarStart = -1;
  let navbarEnd = -1;
  const navbarItems = [];

  for (let i = 0; i < lines.length; i++) {
    if (/^navbar:/.test(lines[i])) {
      navbarStart = i;
      // Check if it's an inline empty array
      if (/^navbar:\s*\[\]/.test(lines[i])) {
        navbarEnd = i;
        break;
      }
      // Collect list items
      for (let j = i + 1; j < lines.length; j++) {
        const m = lines[j].match(/^\s+-\s+(.+)/);
        if (m) {
          navbarItems.push(m[1].trim());
          navbarEnd = j;
        } else {
          break;
        }
      }
      if (navbarEnd === -1) navbarEnd = i; // navbar: with no items
      break;
    }
  }

  if (navbarStart === -1) {
    console.log(`  SKIP ${dir} — no navbar: field found`);
    skipped++;
    continue;
  }

  // Build categories: block with same values
  const catLines = [];
  if (navbarItems.length === 0) {
    catLines.push('categories: []');
  } else {
    catLines.push('categories:');
    for (const item of navbarItems) {
      catLines.push(`  - ${item}`);
    }
  }

  // Insert categories: immediately before navbar:
  lines.splice(navbarStart, 0, ...catLines);

  writeFileSync(filePath, lines.join('\n'), 'utf-8');
  console.log(`  OK   ${dir} — added categories: [${navbarItems.join(', ')}]`);
  updated++;
}

console.log(`\nDone: ${updated} updated, ${skipped} skipped, ${updated + skipped} total`);
