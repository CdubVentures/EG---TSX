import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

describe('core/seo/indexation-policy', () => {
  it('returns the indexable robots directives for public HTML pages', async () => {
    const { buildDocumentIndexation } = await import('../seo/indexation-policy.ts');

    assert.deepEqual(
      buildDocumentIndexation({ noIndex: false }),
      {
        robots: 'index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1',
        googlebot: 'index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1',
      },
    );
  });

  it('returns noindex directives for blocked HTML pages', async () => {
    const { buildDocumentIndexation } = await import('../seo/indexation-policy.ts');

    assert.deepEqual(
      buildDocumentIndexation({ noIndex: true }),
      {
        robots: 'noindex,nofollow',
        googlebot: 'noindex,nofollow',
      },
    );
  });

  it('adds X-Robots-Tag while preserving existing headers', async () => {
    const { withNoIndexHeaders } = await import('../seo/indexation-policy.ts');

    const headers = withNoIndexHeaders({ 'Cache-Control': 'no-store' });

    assert.equal(headers.get('Cache-Control'), 'no-store');
    assert.equal(headers.get('X-Robots-Tag'), 'noindex,nofollow');
  });

  it('builds robots.txt body with the default utility disallows', async () => {
    const { buildRobotsTxt } = await import('../seo/indexation-policy.ts');

    assert.equal(
      buildRobotsTxt({ siteUrl: 'https://eggear.com' }),
      [
        'User-agent: *',
        'Allow: /',
        'Disallow: /api/',
        'Disallow: /profile/',
        'Disallow: /login/',
        'Disallow: /logout',
        'Disallow: /auth/',
        'Sitemap: https://eggear.com/sitemap-index.xml',
      ].join('\n'),
    );
  });
});
