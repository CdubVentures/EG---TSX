import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

describe('core/seo/sitemap-manifest', () => {
  it('builds expected sitemap URLs from indexable built pages and falls back to route paths when canonical is absent', async () => {
    const { buildExpectedSitemapUrls } = await import('../seo/sitemap-manifest.ts');

    const urls = buildExpectedSitemapUrls({
      siteUrl: 'https://eggear.com',
      pages: [
        {
          routePath: '/',
          html: '<html><head><link rel="canonical" href="https://eggear.com/" /></head></html>',
        },
        {
          routePath: '/reviews/',
          html: '<html><head><link href="https://eggear.com/reviews/" rel="canonical" /></head></html>',
        },
        {
          routePath: '/guides/hardware/',
          html: '<html><head><meta name="robots" content="index, follow" /></head></html>',
        },
        {
          routePath: '/login/',
          html: '<html><head><meta name="robots" content="noindex,nofollow" /><link rel="canonical" href="https://eggear.com/login/" /></head></html>',
        },
      ],
    });

    assert.deepEqual(urls, [
      'https://eggear.com/',
      'https://eggear.com/guides/hardware/',
      'https://eggear.com/reviews/',
    ]);
  });

  it('ignores asset-tree HTML pages so stash artifacts do not pollute sitemap validation', async () => {
    const { buildExpectedSitemapUrls } = await import('../seo/sitemap-manifest.ts');

    const urls = buildExpectedSitemapUrls({
      siteUrl: 'https://eggear.com',
      pages: [
        {
          routePath: '/images/mouse/vendor/product/originals/saved_resource/',
          html: '<html><head><link rel="canonical" href="https://vendor.example/product" /></head></html>',
        },
        {
          routePath: '/reviews/',
          html: '<html><head><link rel="canonical" href="https://eggear.com/reviews/" /></head></html>',
        },
      ],
    });

    assert.deepEqual(urls, ['https://eggear.com/reviews/']);
  });

  it('reports missing, unexpected, and duplicate sitemap URLs separately', async () => {
    const { diffSitemapUrls } = await import('../seo/sitemap-manifest.ts');

    const report = diffSitemapUrls({
      expected: [
        'https://eggear.com/',
        'https://eggear.com/reviews/',
        'https://eggear.com/reviews/',
      ],
      actual: [
        'https://eggear.com/',
        'https://eggear.com/news/',
        'https://eggear.com/news/',
      ],
    });

    assert.deepEqual(report.missing, ['https://eggear.com/reviews/']);
    assert.deepEqual(report.unexpected, ['https://eggear.com/news/']);
    assert.deepEqual(report.duplicateExpected, ['https://eggear.com/reviews/']);
    assert.deepEqual(report.duplicateActual, ['https://eggear.com/news/']);
    assert.equal(report.ok, false);
  });
});
