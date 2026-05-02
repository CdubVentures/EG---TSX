import { beforeEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';

describe('GET /api/auth/me', () => {
  /** @type {import('../../../pages/api/auth/me.ts')} */
  let mod;

  beforeEach(async () => {
    const ts = Date.now() + Math.random();
    mod = await import(`../../../pages/api/auth/me.ts?t=${ts}`);
  });

  it('returns X-Robots-Tag noindex,nofollow for guest responses', async () => {
    const response = await mod.GET({
      cookies: {
        get() {
          return undefined;
        },
      },
    });

    assert.equal(response.status, 200);
    assert.equal(response.headers.get('X-Robots-Tag'), 'noindex,nofollow');
  });
});

describe('GET /logout', () => {
  /** @type {import('../../../pages/logout.ts')} */
  let mod;

  beforeEach(async () => {
    process.env.PUBLIC_COGNITO_APP_CLIENT_ID = 'test-client-id';
    process.env.PUBLIC_COGNITO_REGION = 'us-east-1';
    process.env.PUBLIC_COGNITO_USER_POOL_ID = 'us-east-1_TestPool';
    process.env.COGNITO_DOMAIN = 'test.auth.us-east-1.amazoncognito.com';
    process.env.COGNITO_CALLBACK_URL = 'http://localhost:4321/auth/callback';
    process.env.COGNITO_LOGOUT_URL = 'http://localhost:4321';

    const ts = Date.now() + Math.random();
    mod = await import(`../../../pages/logout.ts?t=${ts}`);
  });

  it('returns X-Robots-Tag noindex,nofollow on the redirect response', async () => {
    const response = await mod.GET();

    assert.equal(response.status, 302);
    assert.equal(response.headers.get('X-Robots-Tag'), 'noindex,nofollow');
  });
});
