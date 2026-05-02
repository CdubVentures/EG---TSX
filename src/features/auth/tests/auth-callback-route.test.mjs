import { beforeEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';

let importCounter = 0;

async function freshCallbackRoute() {
  importCounter += 1;
  return import(`../../../pages/auth/callback.ts?test=${importCounter}`);
}

function makeCookies(values = {}) {
  return {
    get(name) {
      const value = values[name];
      return value ? { value } : undefined;
    },
  };
}

describe('GET /auth/callback', () => {
  beforeEach(() => {
    delete process.env.COGNITO_CLIENT_SECRET;
    globalThis.__mockExchangeCodeForTokens = async () => ({
      id_token: 'mock-id-token',
      access_token: 'mock-access-token',
      refresh_token: 'mock-refresh-token',
      token_type: 'Bearer',
      expires_in: 3600,
    });
    globalThis.__mockVerifyIdToken = async () => ({
      uid: 'user-123',
      email: 'user@example.com',
      username: 'test-user',
    });
    globalThis.__mockReadVaultRev = async () => 0;
  });

  it('returns X-Robots-Tag noindex,nofollow on the mobile redirect response', async () => {
    const { GET } = await freshCallbackRoute();
    const response = await GET({
      url: new URL('http://localhost:4321/auth/callback?code=test-code&state=nonce-123'),
      cookies: makeCookies({
        eg_nonce: 'nonce-123',
        eg_return: '/reviews/viper-v3-pro',
      }),
    });

    assert.equal(response.status, 302);
    assert.equal(response.headers.get('Location'), '/reviews/viper-v3-pro');
    assert.equal(response.headers.get('X-Robots-Tag'), 'noindex,nofollow');
  });

  it('returns X-Robots-Tag noindex,nofollow on the popup completion HTML response', async () => {
    const { GET } = await freshCallbackRoute();
    const response = await GET({
      url: new URL('http://localhost:4321/auth/callback?code=test-code&state=nonce-456'),
      cookies: makeCookies({
        eg_nonce: 'nonce-456',
      }),
    });

    assert.equal(response.status, 200);
    assert.equal(response.headers.get('Content-Type'), 'text/html');
    assert.equal(response.headers.get('X-Robots-Tag'), 'noindex,nofollow');
    const body = await response.text();
    assert.ok(body.includes('Signed in'));
  });
});
