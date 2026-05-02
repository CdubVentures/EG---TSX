import { beforeEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';

let importCounter = 0;

async function freshVaultRoute() {
  importCounter += 1;
  return import(`../../../pages/api/user/vault.ts?test=${importCounter}`);
}

async function freshVaultThumbsRoute() {
  importCounter += 1;
  return import(`../../../pages/api/vault/thumbs.ts?test=${importCounter}`);
}

function makeCookies(sessionToken) {
  return {
    get(name) {
      if (name !== 'eg_session' || !sessionToken) return undefined;
      return { value: sessionToken };
    },
  };
}

function makeVaultEntry() {
  return {
    productId: 'mouse/razer/viper-v3-pro',
    category: 'mouse',
    product: {
      id: 'mouse/razer/viper-v3-pro',
      slug: 'viper-v3-pro',
      brand: 'Razer',
      model: 'Viper V3 Pro',
      category: 'mouse',
      imagePath: '/images/data-products/mouse/razer/viper-v3-pro',
      thumbnailStem: 'top',
    },
    addedAt: 1700000000000,
  };
}

describe('GET /api/user/vault', () => {
  beforeEach(() => {
    globalThis.__mockVerifyIdToken = async () => ({
      uid: 'user-123',
      email: 'user@example.com',
      username: 'test-user',
    });
    globalThis.__mockReadVault = async () => ({
      compare: [makeVaultEntry()],
      builds: [{ id: 'build-1' }],
      rev: 7,
    });
    globalThis.__mockWriteVault = async () => 8;
  });

  it('returns X-Robots-Tag noindex,nofollow for unauthorized requests', async () => {
    const { GET } = await freshVaultRoute();
    const response = await GET({
      cookies: makeCookies(),
      url: new URL('http://localhost:4321/api/user/vault'),
    });

    assert.equal(response.status, 401);
    assert.equal(response.headers.get('X-Robots-Tag'), 'noindex,nofollow');
  });

  it('returns the existing vault payload with noindex headers for authenticated requests', async () => {
    const { GET } = await freshVaultRoute();
    const response = await GET({
      cookies: makeCookies('mock-session-token'),
      url: new URL('http://localhost:4321/api/user/vault'),
    });

    assert.equal(response.status, 200);
    assert.equal(response.headers.get('X-Robots-Tag'), 'noindex,nofollow');
    const payload = await response.json();
    assert.deepStrictEqual(payload, {
      compare: [makeVaultEntry()],
      builds: [{ id: 'build-1' }],
      rev: 7,
    });
  });

  it('returns 304 with noindex headers when the client rev matches', async () => {
    const { GET } = await freshVaultRoute();
    const response = await GET({
      cookies: makeCookies('mock-session-token'),
      url: new URL('http://localhost:4321/api/user/vault?rev=7'),
    });

    assert.equal(response.status, 304);
    assert.equal(response.headers.get('X-Robots-Tag'), 'noindex,nofollow');
  });
});

describe('PUT /api/user/vault', () => {
  beforeEach(() => {
    globalThis.__mockVerifyIdToken = async () => ({
      uid: 'user-123',
      email: 'user@example.com',
      username: 'test-user',
    });
    globalThis.__mockReadVault = async () => ({
      compare: [makeVaultEntry()],
      builds: [{ id: 'build-1' }],
      rev: 7,
    });
    globalThis.__mockWriteVault = async () => 8;
  });

  it('returns X-Robots-Tag noindex,nofollow when the request body is invalid JSON', async () => {
    const { PUT } = await freshVaultRoute();
    const response = await PUT({
      cookies: makeCookies('mock-session-token'),
      request: new Request('http://localhost:4321/api/user/vault', {
        method: 'PUT',
        headers: { 'Content-Type': 'text/plain' },
        body: 'not-json',
      }),
    });

    assert.equal(response.status, 400);
    assert.equal(response.headers.get('X-Robots-Tag'), 'noindex,nofollow');
  });

  it('returns the existing PUT payload with noindex headers on success', async () => {
    const { PUT } = await freshVaultRoute();
    const response = await PUT({
      cookies: makeCookies('mock-session-token'),
      request: new Request('http://localhost:4321/api/user/vault', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          compare: [makeVaultEntry()],
        }),
      }),
    });

    assert.equal(response.status, 200);
    assert.equal(response.headers.get('X-Robots-Tag'), 'noindex,nofollow');
    const payload = await response.json();
    assert.deepStrictEqual(payload, { ok: true, rev: 8 });
  });
});

describe('POST /api/vault/thumbs', () => {
  beforeEach(() => {
    globalThis.__mockGetProducts = async () => [];
  });

  it('returns X-Robots-Tag noindex,nofollow for invalid JSON requests', async () => {
    const { POST } = await freshVaultThumbsRoute();
    const response = await POST({
      request: new Request('http://localhost:4321/api/vault/thumbs', {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' },
        body: 'not-json',
      }),
    });

    assert.equal(response.status, 400);
    assert.equal(response.headers.get('X-Robots-Tag'), 'noindex,nofollow');
  });

  it('preserves cache headers while adding noindex headers on success', async () => {
    const { POST } = await freshVaultThumbsRoute();
    const response = await POST({
      request: new Request('http://localhost:4321/api/vault/thumbs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: [] }),
      }),
    });

    assert.equal(response.status, 200);
    assert.equal(response.headers.get('Cache-Control'), 'public, max-age=60, s-maxage=300');
    assert.equal(response.headers.get('X-Robots-Tag'), 'noindex,nofollow');
    const payload = await response.json();
    assert.deepStrictEqual(payload, { items: [] });
  });
});
