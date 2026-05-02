import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const MAIN_LAYOUT_PATH = new URL('../MainLayout.astro', import.meta.url);

describe('MainLayout auth bootstrap contract', () => {
  it('hydrates auth only through the cookie-hinted bootstrap path', async () => {
    const source = await readFile(MAIN_LAYOUT_PATH, 'utf8');

    assert.match(
      source,
      /hydrateAuthFromCookieHint/,
      'Expected MainLayout to import the cookie-hinted auth bootstrap helper'
    );
    assert.match(
      source,
      /hydrateAuthFromCookieHint\(document\.cookie\)/,
      'Expected MainLayout to pass document.cookie into the auth bootstrap helper'
    );
    assert.doesNotMatch(
      source,
      /hydrateAuth\(\);/,
      'Expected MainLayout to stop calling hydrateAuth() unconditionally at startup'
    );
  });
});
