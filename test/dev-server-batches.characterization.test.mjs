import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function readBatchFile(name) {
  return readFileSync(path.join(__dirname, '..', name), 'utf8');
}

test('startVite keeps the Astro dev launcher contract', () => {
  const script = readBatchFile('startVite.bat');
  assert.match(script, /astro dev/i);
});

test('refreshVite keeps the cache reset plus Astro dev restart contract', () => {
  const script = readBatchFile('refreshVite.bat');
  assert.match(script, /node_modules\\\.vite/i);
  assert.match(script, /astro dev/i);
});

test('buildVite keeps the build-then-preview contract', () => {
  const script = readBatchFile('buildVite.bat');
  assert.match(script, /astro build/i);
  assert.match(script, /astro preview/i);
});
