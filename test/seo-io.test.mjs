import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {
  routePathFromHtmlFile,
  collectBuiltHtmlPages,
  readSitemapUrls,
} from '../scripts/lib/seo-io.mjs';

// ---------------------------------------------------------------------------
// routePathFromHtmlFile — table-driven
// ---------------------------------------------------------------------------

describe('routePathFromHtmlFile', () => {
  const cases = [
    { file: 'index.html',                  expected: '/' },
    { file: 'reviews/foo/index.html',       expected: '/reviews/foo/' },
    { file: 'hubs/mice/index.html',         expected: '/hubs/mice/' },
    { file: 'brands/razer/index.html',      expected: '/brands/razer/' },
    { file: '404.html',                     expected: '/404/' },
    { file: 'search/index.html',            expected: '/search/' },
    { file: 'deeply/nested/page/index.html', expected: '/deeply/nested/page/' },
  ];

  for (const { file, expected } of cases) {
    it(`${file} → ${expected}`, () => {
      const clientDir = '/dist/client';
      const filePath = path.posix.join(clientDir, file);
      assert.equal(
        routePathFromHtmlFile({ clientDir, filePath }),
        expected,
      );
    });
  }
});

// ---------------------------------------------------------------------------
// collectBuiltHtmlPages — synthetic temp dir
// ---------------------------------------------------------------------------

describe('collectBuiltHtmlPages', () => {
  async function makeTempDist(structure) {
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'seo-io-test-'));
    for (const [relPath, content] of Object.entries(structure)) {
      const fullPath = path.join(tmpDir, relPath);
      await fs.mkdir(path.dirname(fullPath), { recursive: true });
      await fs.writeFile(fullPath, content, 'utf8');
    }
    return tmpDir;
  }

  it('collects HTML files with correct route paths', async () => {
    const clientDir = await makeTempDist({
      'index.html': '<html><body>Home</body></html>',
      'reviews/mouse-1/index.html': '<html><body>Review</body></html>',
      'brands/razer/index.html': '<html><body>Razer</body></html>',
    });

    const pages = await collectBuiltHtmlPages({ clientDir });
    const routes = pages.map(p => p.routePath).sort();

    assert.deepEqual(routes, ['/', '/brands/razer/', '/reviews/mouse-1/']);
    await fs.rm(clientDir, { recursive: true });
  });

  it('excludes sitemap files', async () => {
    const clientDir = await makeTempDist({
      'index.html': '<html>Home</html>',
      'sitemap-index.xml': '<xml></xml>',
      'sitemap-0.xml': '<xml></xml>',
    });

    const pages = await collectBuiltHtmlPages({ clientDir });
    assert.equal(pages.length, 1);
    assert.equal(pages[0].routePath, '/');
    await fs.rm(clientDir, { recursive: true });
  });

  it('excludes non-HTML files', async () => {
    const clientDir = await makeTempDist({
      'index.html': '<html>Home</html>',
      'robots.txt': 'User-agent: *',
      'styles.css': 'body {}',
    });

    const pages = await collectBuiltHtmlPages({ clientDir });
    assert.equal(pages.length, 1);
    await fs.rm(clientDir, { recursive: true });
  });

  it('reads HTML content correctly', async () => {
    const htmlContent = '<html><head><link rel="canonical" href="https://eggear.com/"></head></html>';
    const clientDir = await makeTempDist({
      'index.html': htmlContent,
    });

    const pages = await collectBuiltHtmlPages({ clientDir });
    assert.equal(pages[0].html, htmlContent);
    await fs.rm(clientDir, { recursive: true });
  });

  it('returns empty array for empty directory', async () => {
    const clientDir = await makeTempDist({});
    const pages = await collectBuiltHtmlPages({ clientDir });
    assert.deepEqual(pages, []);
    await fs.rm(clientDir, { recursive: true });
  });
});

// ---------------------------------------------------------------------------
// readSitemapUrls — synthetic sitemaps
// ---------------------------------------------------------------------------

describe('readSitemapUrls', () => {
  async function makeTempDist(structure) {
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'seo-io-sitemap-'));
    for (const [relPath, content] of Object.entries(structure)) {
      const fullPath = path.join(tmpDir, relPath);
      await fs.mkdir(path.dirname(fullPath), { recursive: true });
      await fs.writeFile(fullPath, content, 'utf8');
    }
    return tmpDir;
  }

  it('reads URLs from a sitemap index with nested sitemaps', async () => {
    const clientDir = await makeTempDist({
      'sitemap-index.xml': `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <sitemap><loc>https://eggear.com/sitemap-0.xml</loc></sitemap>
  <sitemap><loc>https://eggear.com/sitemap-1.xml</loc></sitemap>
</sitemapindex>`,
      'sitemap-0.xml': `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>https://eggear.com/</loc></url>
  <url><loc>https://eggear.com/reviews/mouse-1/</loc></url>
</urlset>`,
      'sitemap-1.xml': `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>https://eggear.com/brands/razer/</loc></url>
</urlset>`,
    });

    const urls = await readSitemapUrls({ clientDir });
    assert.deepEqual(urls.sort(), [
      'https://eggear.com/',
      'https://eggear.com/brands/razer/',
      'https://eggear.com/reviews/mouse-1/',
    ]);
    await fs.rm(clientDir, { recursive: true });
  });

  it('reads URLs from a flat sitemap (no sitemapindex)', async () => {
    const clientDir = await makeTempDist({
      'sitemap-index.xml': `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>https://eggear.com/</loc></url>
  <url><loc>https://eggear.com/about/</loc></url>
</urlset>`,
    });

    const urls = await readSitemapUrls({ clientDir });
    assert.deepEqual(urls, [
      'https://eggear.com/',
      'https://eggear.com/about/',
    ]);
    await fs.rm(clientDir, { recursive: true });
  });

  it('supports custom index file name', async () => {
    const clientDir = await makeTempDist({
      'custom-sitemap.xml': `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>https://eggear.com/custom/</loc></url>
</urlset>`,
    });

    const urls = await readSitemapUrls({ clientDir, indexFileName: 'custom-sitemap.xml' });
    assert.deepEqual(urls, ['https://eggear.com/custom/']);
    await fs.rm(clientDir, { recursive: true });
  });
});
