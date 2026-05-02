import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';

const tempRoots = [];

function makeTempRoot() {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'egtsx-validate-sitemap-'));
  tempRoots.push(tempRoot);
  return tempRoot;
}

function writeFile(filePath, contents) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, contents, 'utf8');
}

afterEach(() => {
  while (tempRoots.length > 0) {
    const tempRoot = tempRoots.pop();
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
});

describe('validateSeoSitemap', () => {
  it('accepts a sitemap whose URLs match built canonical HTML pages', async () => {
    const tempRoot = makeTempRoot();
    const clientDir = path.join(tempRoot, 'dist', 'client');

    writeFile(
      path.join(clientDir, 'index.html'),
      '<html><head><link rel="canonical" href="https://eggear.com/" /></head></html>',
    );
    writeFile(
      path.join(clientDir, 'reviews', 'index.html'),
      '<html><head><link rel="canonical" href="https://eggear.com/reviews/" /></head></html>',
    );
    writeFile(
      path.join(clientDir, 'login', 'index.html'),
      '<html><head><meta name="robots" content="noindex,nofollow" /><link rel="canonical" href="https://eggear.com/login/" /></head></html>',
    );
    writeFile(
      path.join(clientDir, 'sitemap-index.xml'),
      '<?xml version="1.0" encoding="UTF-8"?><sitemapindex><sitemap><loc>https://eggear.com/sitemap-0.xml</loc></sitemap></sitemapindex>',
    );
    writeFile(
      path.join(clientDir, 'sitemap-0.xml'),
      '<?xml version="1.0" encoding="UTF-8"?><urlset><url><loc>https://eggear.com/</loc></url><url><loc>https://eggear.com/reviews/</loc></url></urlset>',
    );

    const { validateSeoSitemap } = await import('../validate-seo-sitemap.mjs');
    const report = await validateSeoSitemap({ clientDir, siteUrl: 'https://eggear.com' });

    assert.deepEqual(report.expected, [
      'https://eggear.com/',
      'https://eggear.com/reviews/',
    ]);
    assert.deepEqual(report.actual, [
      'https://eggear.com/',
      'https://eggear.com/reviews/',
    ]);
    assert.equal(report.ok, true);
  });

  it('throws a readable error when the generated sitemap drifts from built canonicals', async () => {
    const tempRoot = makeTempRoot();
    const clientDir = path.join(tempRoot, 'dist', 'client');

    writeFile(
      path.join(clientDir, 'index.html'),
      '<html><head><link rel="canonical" href="https://eggear.com/" /></head></html>',
    );
    writeFile(
      path.join(clientDir, 'reviews', 'index.html'),
      '<html><head><link rel="canonical" href="https://eggear.com/reviews/" /></head></html>',
    );
    writeFile(
      path.join(clientDir, 'sitemap-index.xml'),
      '<?xml version="1.0" encoding="UTF-8"?><sitemapindex><sitemap><loc>https://eggear.com/sitemap-0.xml</loc></sitemap></sitemapindex>',
    );
    writeFile(
      path.join(clientDir, 'sitemap-0.xml'),
      '<?xml version="1.0" encoding="UTF-8"?><urlset><url><loc>https://eggear.com/</loc></url><url><loc>https://eggear.com/news/</loc></url></urlset>',
    );

    const { validateSeoSitemap } = await import('../validate-seo-sitemap.mjs');

    await assert.rejects(
      () => validateSeoSitemap({ clientDir, siteUrl: 'https://eggear.com' }),
      /Missing sitemap URLs: https:\/\/eggear\.com\/reviews\/[\s\S]*Unexpected sitemap URLs: https:\/\/eggear\.com\/news\//i,
    );
  });
});
