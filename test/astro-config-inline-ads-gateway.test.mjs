import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const astroConfigUrl = pathToFileURL(
  path.resolve(import.meta.dirname, '..', 'astro.config.mjs'),
).href;

test('astro config imports the inline ads rehype plugin through a node-safe gateway', async () => {
  const mod = await import(astroConfigUrl);

  assert.ok(mod.default);
  assert.ok(mod.default.markdown);
  assert.ok(Array.isArray(mod.default.markdown.rehypePlugins));
  assert.equal(typeof mod.default.markdown.rehypePlugins[0], 'function');
});
