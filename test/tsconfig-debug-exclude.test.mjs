import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const tsconfigPath = path.resolve(import.meta.dirname, '..', 'tsconfig.json');
const tsconfig = JSON.parse(fs.readFileSync(tsconfigPath, 'utf8'));

test('tsconfig excludes generated debug artifacts from type-checking', () => {
  assert.ok(Array.isArray(tsconfig.exclude));
  assert.ok(tsconfig.exclude.includes('debug'));
});
