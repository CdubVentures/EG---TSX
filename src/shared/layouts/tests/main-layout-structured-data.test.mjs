import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const MAIN_LAYOUT_PATH = new URL('../MainLayout.astro', import.meta.url);

describe('MainLayout.astro structured data contract', () => {
  it('accepts an optional structuredData prop for page-specific JSON-LD', async () => {
    const source = await readFile(MAIN_LAYOUT_PATH, 'utf8');

    assert.match(
      source,
      /structuredData\?:\s*(?:Record<string,\s*unknown>\s*\|\s*)?Array<Record<string,\s*unknown>>|structuredData\?:\s*Array<Record<string,\s*unknown>>\s*\|\s*Record<string,\s*unknown>/,
      'Expected MainLayout props to expose an optional structuredData contract'
    );
  });

  it('renders any page-specific JSON-LD entries in addition to the base site schema', async () => {
    const source = await readFile(MAIN_LAYOUT_PATH, 'utf8');

    assert.match(
      source,
      /Array\.isArray\(structuredData\)/,
      'Expected MainLayout to normalize singular or array structuredData values'
    );
    assert.match(
      source,
      /pageStructuredData\.map\(\(entry\)\s*=>\s*\(/,
      'Expected MainLayout to render a script tag for each page-level structuredData entry'
    );
  });
});
