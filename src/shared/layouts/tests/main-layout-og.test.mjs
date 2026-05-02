import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import { constants } from 'node:fs';

const MAIN_LAYOUT_PATH = new URL('../MainLayout.astro', import.meta.url);
const SOCIAL_IMAGE_PATH = new URL('../../../../public/images/social/eg-default-1200x630.png', import.meta.url);

describe('MainLayout.astro OG fallback contract', () => {
  it('uses the dedicated social fallback image instead of the favicon', async () => {
    const source = await readFile(MAIN_LAYOUT_PATH, 'utf8');

    const resolvedOgImageLine = source
      .split('\n')
      .find((line) => line.includes('const resolvedOgImage ='));

    assert.ok(resolvedOgImageLine, 'Expected MainLayout to define resolvedOgImage');
    assert.doesNotMatch(resolvedOgImageLine, /images\/favicons\/icon-512\.png/);
    assert.match(resolvedOgImageLine, /images\/social\/eg-default-1200x630\.png/);
  });

  it('ships the social fallback image asset', async () => {
    await access(SOCIAL_IMAGE_PATH, constants.F_OK);
  });
});
