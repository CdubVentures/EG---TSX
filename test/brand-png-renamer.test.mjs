import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readdirSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildRenamePlan, executeRenamePlan } from '../scripts/brand-png-renamer.mjs';

function touch(path) {
  writeFileSync(path, 'x');
}

test('buildRenamePlan maps known stems to professional stems and keeps size suffix', () => {
  const root = mkdtempSync(join(tmpdir(), 'brand-rename-'));
  const brand = join(root, 'razer');
  mkdirSync(brand, { recursive: true });
  touch(join(brand, 'logo_black_xs.png'));
  touch(join(brand, 'logo_text_white_vertical_l.png'));

  const plan = buildRenamePlan({ rootDir: root });
  const renamedTo = plan.map((p) => p.toFileName).sort();

  assert.deepEqual(renamedTo, [
    'brand-logo-horizontal-mono-black_xs.png',
    'brand-wordmark-vertical-mono-white_l.png'
  ]);
});

test('buildRenamePlan gives deterministic legacy names to unknown stems', () => {
  const root = mkdtempSync(join(tmpdir(), 'brand-rename-legacy-'));
  const brand = join(root, 'acer');
  mkdirSync(brand, { recursive: true });
  touch(join(brand, 'ROG logo_black.png'));

  const plan = buildRenamePlan({ rootDir: root });
  assert.equal(plan.length, 1);
  assert.match(plan[0].toFileName, /^brand-legacy-rog-logo_black\.png$/);
});

test('executeRenamePlan renames files on disk', () => {
  const root = mkdtempSync(join(tmpdir(), 'brand-rename-exec-'));
  const brand = join(root, 'pulsar');
  mkdirSync(brand, { recursive: true });
  const src = join(brand, 'logo_color_m.png');
  touch(src);

  const plan = buildRenamePlan({ rootDir: root });
  executeRenamePlan({ plan });

  const files = readdirSync(brand);
  assert.equal(files.length, 1);
  assert.equal(files[0], 'brand-logo-horizontal-primary_m.png');
  assert.equal(existsSync(src), false);
});
