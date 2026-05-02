import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import { constants } from 'node:fs';

const ENV_PATH = new URL('../.env', import.meta.url);
const ENV_EXAMPLE_PATH = new URL('../.env.example', import.meta.url);
const ASTRO_CONFIG_PATH = new URL('../astro.config.mjs', import.meta.url);
const STATIC_ROBOTS_PATH = new URL('../public/robots.txt', import.meta.url);
const DYNAMIC_ROBOTS_PATH = new URL('../src/pages/robots.txt.ts', import.meta.url);

describe('site domain contract', () => {
  it('sets PUBLIC_SITE_URL to eggear.com in the local env file', async () => {
    const envSource = await readFile(ENV_PATH, 'utf8');
    assert.match(envSource, /^PUBLIC_SITE_URL=https:\/\/eggear\.com$/m);
  });

  it('keeps eggear.com as the example PUBLIC_SITE_URL', async () => {
    const envExampleSource = await readFile(ENV_EXAMPLE_PATH, 'utf8');
    assert.match(envExampleSource, /^PUBLIC_SITE_URL=https:\/\/eggear\.com$/m);
  });

  it('uses EG Gear as the TSX site brand across runtime config and the web manifest', async () => {
    const [{ CONFIG }, manifestSource] = await Promise.all([
      import('../src/core/config.ts'),
      readFile(new URL('../public/site.webmanifest', import.meta.url), 'utf8'),
    ]);

    const manifest = JSON.parse(manifestSource);

    assert.equal(CONFIG.site.name, 'EG Gear');
    assert.equal(manifest.name, 'EG Gear');
    assert.equal(manifest.short_name, 'EG Gear');
  });

  it('keeps the default site description evergreen instead of hardcoding catalog counts', async () => {
    const { CONFIG } = await import('../src/core/config.ts');

    assert.doesNotMatch(CONFIG.site.defaultDescription, /\b\d+\+?\b/);
    assert.match(CONFIG.site.defaultDescription, /deep specs/i);
    assert.match(CONFIG.site.defaultDescription, /reviews/i);
    assert.match(CONFIG.site.defaultDescription, /guides/i);
    assert.match(CONFIG.site.defaultDescription, /builds/i);
  });

  it('reads the Astro site URL from PUBLIC_SITE_URL instead of hardcoding the domain', async () => {
    const astroConfigSource = await readFile(ASTRO_CONFIG_PATH, 'utf8');
    assert.match(astroConfigSource, /loadEnv/);
    assert.match(astroConfigSource, /PUBLIC_SITE_URL/);
    assert.doesNotMatch(astroConfigSource, /site:\s*'https:\/\/eggear\.com'/);
  });

  it('generates robots.txt from source code instead of a hardcoded public file', async () => {
    await access(DYNAMIC_ROBOTS_PATH, constants.F_OK);

    const robotsRouteSource = await readFile(DYNAMIC_ROBOTS_PATH, 'utf8');
    assert.match(robotsRouteSource, /CONFIG\.site\.url|PUBLIC_SITE_URL/);

    await assert.rejects(
      () => access(STATIC_ROBOTS_PATH, constants.F_OK),
      /ENOENT/
    );
  });
});
