#!/usr/bin/env node
// WHY: One-time backfill — adds random datePublished + dateUpdated to brand frontmatter.
// dateUpdated >= datePublished. Skips brands that already have both fields.

import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const BRANDS_DIR = join(import.meta.dirname, '..', 'src', 'content', 'brands');

function randomDate(startMs, endMs) {
  const ms = startMs + Math.random() * (endMs - startMs);
  const d = new Date(ms);
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(d.getUTCDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

const START = new Date('2025-01-01').getTime();
const END   = new Date('2025-12-31').getTime();

const brands = readdirSync(BRANDS_DIR, { withFileTypes: true })
  .filter(d => d.isDirectory())
  .map(d => d.name);

let updated = 0;
let skipped = 0;

for (const slug of brands) {
  const file = join(BRANDS_DIR, slug, 'index.md');
  let content;
  try {
    content = readFileSync(file, 'utf-8');
  } catch {
    console.log(`SKIP ${slug} — no index.md`);
    skipped++;
    continue;
  }

  const hasPub = /^datePublished:/m.test(content);
  const hasUpd = /^dateUpdated:/m.test(content);

  if (hasPub && hasUpd) {
    console.log(`SKIP ${slug} — already has both dates`);
    skipped++;
    continue;
  }

  const pubDate = hasPub ? null : randomDate(START, END);
  const updDate = hasUpd ? null : (() => {
    // dateUpdated >= datePublished
    const pubMs = pubDate
      ? new Date(pubDate).getTime()
      : new Date(content.match(/^datePublished:\s*'?(\d{4}-\d{2}-\d{2})/m)?.[1] ?? '2025-06-01').getTime();
    return randomDate(pubMs, END);
  })();

  // Insert before the closing ---
  // Find the second --- (end of frontmatter)
  const lines = content.split('\n');
  const fmStart = lines.indexOf('---');
  let fmEnd = -1;
  for (let i = fmStart + 1; i < lines.length; i++) {
    if (lines[i].trim() === '---') {
      fmEnd = i;
      break;
    }
  }

  if (fmEnd === -1) {
    console.log(`SKIP ${slug} — can't find frontmatter end`);
    skipped++;
    continue;
  }

  const insertLines = [];
  if (pubDate) insertLines.push(`datePublished: '${pubDate}'`);
  if (updDate) insertLines.push(`dateUpdated: '${updDate}'`);

  lines.splice(fmEnd, 0, ...insertLines);
  writeFileSync(file, lines.join('\n'), 'utf-8');
  console.log(`OK   ${slug} — added ${insertLines.join(', ')}`);
  updated++;
}

console.log(`\nDone: ${updated} updated, ${skipped} skipped`);
