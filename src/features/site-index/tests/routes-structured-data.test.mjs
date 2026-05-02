import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const ROUTE_PATHS = [
  new URL('../../../pages/reviews/[...slug].astro', import.meta.url),
  new URL('../../../pages/guides/[...slug].astro', import.meta.url),
  new URL('../../../pages/news/[...slug].astro', import.meta.url),
];

describe('site-index route structured data contract', () => {
  it('passes page-level structured data into MainLayout for every route family', async () => {
    for (const routePath of ROUTE_PATHS) {
      const source = await readFile(routePath, 'utf8');
      assert.match(
        source,
        /structuredData=\{vm\.seo\.structuredData\}/,
        `Expected ${routePath.pathname} to pass vm.seo.structuredData into MainLayout`
      );
    }
  });
});
