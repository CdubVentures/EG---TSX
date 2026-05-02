import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

describe('GET /robots.txt', () => {
  it('publishes the shared utility disallow rules and sitemap location', async () => {
    const { GET } = await import('../src/pages/robots.txt.ts');
    const response = await GET();
    const body = await response.text();

    assert.equal(response.headers.get('Content-Type'), 'text/plain; charset=utf-8');
    assert.ok(body.includes('Disallow: /api/'));
    assert.ok(body.includes('Disallow: /profile/'));
    assert.ok(body.includes('Disallow: /login/'));
    assert.ok(body.includes('Disallow: /logout'));
    assert.ok(body.includes('Disallow: /auth/'));
    assert.ok(body.includes('Sitemap:'));
  });
});
