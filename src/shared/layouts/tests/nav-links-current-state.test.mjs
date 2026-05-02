import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const NAV_LINKS_PATH = new URL('../NavLinks.astro', import.meta.url);

describe('NavLinks.astro current-page underline contract', () => {
  it('keeps the top-level underline tied to locked dropdown state', async () => {
    const source = await readFile(NAV_LINKS_PATH, 'utf8');

    assert.match(source, /\.nav-links > li\.sub-menu\.locked > a::after \{/);
  });

  it('does not underline nav links just because aria-current is set', async () => {
    const source = await readFile(NAV_LINKS_PATH, 'utf8');

    assert.doesNotMatch(source, /\.nav-link\[aria-current="page"\]::after \{/);
  });
});
