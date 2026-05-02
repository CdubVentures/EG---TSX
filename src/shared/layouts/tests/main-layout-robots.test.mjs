import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const MAIN_LAYOUT_PATH = new URL('../MainLayout.astro', import.meta.url);

describe('MainLayout.astro robots contract', () => {
  it('derives robots directives from the shared indexation policy instead of inlining them', async () => {
    const source = await readFile(MAIN_LAYOUT_PATH, 'utf8');

    assert.match(source, /buildDocumentIndexation/);
    assert.doesNotMatch(source, /noIndex \? 'noindex,nofollow'/);
  });
});
