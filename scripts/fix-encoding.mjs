#!/usr/bin/env node
/**
 * fix-encoding.mjs — Fix double-encoded UTF-8 files.
 *
 * When UTF-8 bytes are misread as Windows-1252 and re-saved as UTF-8,
 * characters like smart quotes and em dashes turn into mojibake
 * (e.g., ' → â€™, — → â€", " → â€œ).
 *
 * This script reverses the double encoding by mapping each character
 * back to its CP1252 byte value, then re-decoding as proper UTF-8.
 *
 * Usage:
 *   node scripts/fix-encoding.mjs <file-path>           # single file
 *   node scripts/fix-encoding.mjs --scan <directory>     # find & fix all .md files
 *   node scripts/fix-encoding.mjs --dry-run --scan <dir> # preview without writing
 */
import fs from 'node:fs';
import path from 'node:path';

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const scanMode = args.includes('--scan');
const filteredArgs = args.filter(a => a !== '--dry-run' && a !== '--scan');
const target = filteredArgs[0];

if (!target) {
  console.error('Usage: node scripts/fix-encoding.mjs [--dry-run] [--scan] <path>');
  process.exit(1);
}

// Reverse CP1252 map: Unicode code point → CP1252 byte value
const cp1252Rev = new Map([
  [0x20AC, 0x80], // €
  [0x201A, 0x82], // ‚
  [0x0192, 0x83], // ƒ
  [0x201E, 0x84], // „
  [0x2026, 0x85], // …
  [0x2020, 0x86], // †
  [0x2021, 0x87], // ‡
  [0x02C6, 0x88], // ˆ
  [0x2030, 0x89], // ‰
  [0x0160, 0x8A], // Š
  [0x2039, 0x8B], // ‹
  [0x0152, 0x8C], // Œ
  [0x017D, 0x8E], // Ž
  [0x2018, 0x91], // '
  [0x2019, 0x92], // '
  [0x201C, 0x93], // "
  [0x201D, 0x94], // "
  [0x2022, 0x95], // •
  [0x2013, 0x96], // –
  [0x2014, 0x97], // —
  [0x02DC, 0x98], // ˜
  [0x2122, 0x99], // ™
  [0x0161, 0x9A], // š
  [0x203A, 0x9B], // ›
  [0x0153, 0x9C], // œ
  [0x017E, 0x9E], // ž
  [0x0178, 0x9F], // Ÿ
]);

// Mojibake detection: â (U+00E2) followed by € (U+20AC) is the telltale
const MOJIBAKE_MARKER = '\u00e2\u20ac';

function fixFile(filePath) {
  let text = fs.readFileSync(filePath, 'utf8');

  // Strip BOM
  const hadBom = text.charCodeAt(0) === 0xFEFF;
  if (hadBom) text = text.slice(1);

  // Check if file actually has mojibake
  if (!text.includes(MOJIBAKE_MARKER)) {
    return { path: filePath, status: 'clean', remapped: 0 };
  }

  // Convert each char back to its original byte value
  const bytes = [];
  let remapped = 0;
  for (const ch of text) {
    const cp = ch.codePointAt(0);
    if (cp < 0x100) {
      bytes.push(cp);
    } else if (cp1252Rev.has(cp)) {
      bytes.push(cp1252Rev.get(cp));
      remapped++;
    } else {
      // Not double-encoded — keep as UTF-8 bytes
      const encoded = Buffer.from(ch, 'utf8');
      for (const b of encoded) bytes.push(b);
    }
  }

  const fixed = Buffer.from(bytes).toString('utf8');

  if (!dryRun) {
    // Preserve BOM if original had one
    const output = hadBom ? '\uFEFF' + fixed : fixed;
    fs.writeFileSync(filePath, output, 'utf8');
  }

  return { path: filePath, status: dryRun ? 'would-fix' : 'fixed', remapped };
}

function walkDir(dir, ext) {
  const results = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...walkDir(full, ext));
    } else if (entry.name.endsWith(ext)) {
      results.push(full);
    }
  }
  return results;
}

// ── Main ────────────────────────────────────────────────────────────────────────
if (scanMode) {
  const files = walkDir(target, '.md');
  console.log(`Scanning ${files.length} .md files in ${target}...`);

  let fixedCount = 0;
  let totalRemapped = 0;

  for (const f of files) {
    const result = fixFile(f);
    if (result.status !== 'clean') {
      const rel = path.relative(process.cwd(), result.path);
      console.log(`  ${result.status}: ${rel} (${result.remapped} chars)`);
      fixedCount++;
      totalRemapped += result.remapped;
    }
  }

  console.log(`\n${fixedCount} files ${dryRun ? 'need fixing' : 'fixed'}, ${totalRemapped} total chars remapped`);
  if (fixedCount === 0) console.log('All files clean!');
} else {
  const result = fixFile(target);
  console.log(`${result.status}: ${result.path} (${result.remapped} chars remapped)`);
}
