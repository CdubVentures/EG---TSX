import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import * as jose from 'jose';
import { createHash, randomBytes } from 'node:crypto';

/**
 * Server auth utilities — unit tests
 *
 * Tests OIDC state generation/validation, JWT verification, and token exchange.
 * Uses jose to generate test keypairs for JWT verification tests.
 */

// ─── OIDC State Tests (with secret — HMAC mode) ─────────────────────────────

describe('OIDC state with secret (HMAC mode)', () => {
  /** @type {import('../server/oidc.ts')} */
  let mod;

  beforeEach(async () => {
    process.env.COGNITO_CLIENT_SECRET = 'test-secret-key-for-hmac-signing-32b';
    delete process.env.AUTH_STATE_SECRET;
    const ts = Date.now() + Math.random();
    mod = await import(`../server/oidc.ts?t=${ts}`);
  });

  it('generates a non-empty HMAC-signed state string', () => {
    const state = mod.generateOidcState();
    assert.ok(state.length > 0);
    assert.ok(state.includes('.'), 'HMAC state should contain a dot separator');
  });

  it('validates a correctly signed state', () => {
    const state = mod.generateOidcState();
    assert.equal(mod.validateOidcState(state), true);
  });

  it('rejects a tampered state', () => {
    const state = mod.generateOidcState();
    const tampered = state.slice(0, -4) + 'XXXX';
    assert.equal(mod.validateOidcState(tampered), false);
  });

  it('rejects an empty string', () => {
    assert.equal(mod.validateOidcState(''), false);
  });
});

// ─── OIDC State Tests (no secret — nonce fallback mode) ──────────────────────

describe('OIDC state without secret (nonce fallback)', () => {
  /** @type {import('../server/oidc.ts')} */
  let mod;

  beforeEach(async () => {
    delete process.env.COGNITO_CLIENT_SECRET;
    delete process.env.AUTH_STATE_SECRET;
    const ts = Date.now() + Math.random();
    mod = await import(`../server/oidc.ts?t=${ts}`);
  });

  it('generates a plain nonce (no dot)', () => {
    const state = mod.generateOidcState();
    assert.ok(state.length > 0);
    assert.equal(state.includes('.'), false, 'plain nonce should not contain a dot');
  });

  it('validates a plain nonce', () => {
    const state = mod.generateOidcState();
    assert.equal(mod.validateOidcState(state), true);
  });

  it('rejects an empty string', () => {
    assert.equal(mod.validateOidcState(''), false);
  });
});

// ─── JWT Verification Tests ──────────────────────────────────────────────────

describe('verifyIdToken', () => {
  /** @type {import('../server/jwt.ts')} */
  let mod;
  /** @type {CryptoKeyPair} */
  let keyPair;

  beforeEach(async () => {
    // Generate RS256 keypair for testing
    keyPair = await jose.generateKeyPair('RS256');

    // Create the JWK from the public key
    const publicJwk = await jose.exportJWK(keyPair.publicKey);
    publicJwk.kid = 'test-kid-1';
    publicJwk.alg = 'RS256';
    publicJwk.use = 'sig';

    const jwks = { keys: [publicJwk] };

    // Set env vars to point to our test JWKS
    process.env.PUBLIC_COGNITO_REGION = 'us-east-1';
    process.env.PUBLIC_COGNITO_USER_POOL_ID = 'us-east-1_TestPool';
    process.env.PUBLIC_COGNITO_APP_CLIENT_ID = 'test-client-id';

    // Mock fetch for JWKS endpoint
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async (url, opts) => {
      const urlStr = typeof url === 'string' ? url : url.toString();
      if (urlStr.includes('.well-known/jwks.json')) {
        return new Response(JSON.stringify(jwks), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      return originalFetch(url, opts);
    };

    const ts = Date.now() + Math.random();
    mod = await import(`../server/jwt.ts?t=${ts}`);
  });

  it('verifies a valid id_token', async () => {
    const token = await new jose.SignJWT({
      sub: 'user-123',
      email: 'test@example.com',
      'cognito:username': 'testuser',
    })
      .setProtectedHeader({ alg: 'RS256', kid: 'test-kid-1' })
      .setIssuer(`https://cognito-idp.us-east-1.amazonaws.com/us-east-1_TestPool`)
      .setAudience('test-client-id')
      .setExpirationTime('1h')
      .setIssuedAt()
      .sign(keyPair.privateKey);

    const claims = await mod.verifyIdToken(token);
    assert.ok(claims);
    assert.equal(claims.uid, 'user-123');
    assert.equal(claims.email, 'test@example.com');
    assert.equal(claims.username, 'testuser');
  });

  it('returns null for an expired token', async () => {
    const token = await new jose.SignJWT({
      sub: 'user-123',
      email: 'test@example.com',
      'cognito:username': 'testuser',
    })
      .setProtectedHeader({ alg: 'RS256', kid: 'test-kid-1' })
      .setIssuer(`https://cognito-idp.us-east-1.amazonaws.com/us-east-1_TestPool`)
      .setAudience('test-client-id')
      .setExpirationTime('-1h')
      .setIssuedAt(Math.floor(Date.now() / 1000) - 7200)
      .sign(keyPair.privateKey);

    const claims = await mod.verifyIdToken(token);
    assert.equal(claims, null);
  });

  it('returns null for a malformed token', async () => {
    const claims = await mod.verifyIdToken('not.a.jwt');
    assert.equal(claims, null);
  });
});

// ─── Token Exchange Tests ────────────────────────────────────────────────────

describe('exchangeCodeForTokens', () => {
  /** @type {import('../server/token-exchange.ts')} */
  let mod;

  beforeEach(async () => {
    process.env.PUBLIC_COGNITO_APP_CLIENT_ID = 'test-client-id';
    process.env.COGNITO_CLIENT_SECRET = 'test-secret';
    process.env.COGNITO_DOMAIN = 'test.auth.us-east-1.amazoncognito.com';
    process.env.COGNITO_CALLBACK_URL = 'http://localhost:4321/auth/callback';

    const ts = Date.now() + Math.random();
    mod = await import(`../server/token-exchange.ts?t=${ts}`);
  });

  it('exchanges code for tokens on success', async () => {
    const mockTokens = {
      id_token: 'mock-id-token',
      access_token: 'mock-access-token',
      refresh_token: 'mock-refresh-token',
      token_type: 'Bearer',
      expires_in: 3600,
    };

    const originalFetch = globalThis.fetch;
    globalThis.fetch = async (url, opts) => {
      const urlStr = typeof url === 'string' ? url : url.toString();
      if (urlStr.includes('/oauth2/token')) {
        return new Response(JSON.stringify(mockTokens), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      return originalFetch(url, opts);
    };

    const result = await mod.exchangeCodeForTokens('test-auth-code');
    assert.ok(result);
    assert.equal(result.id_token, 'mock-id-token');
    assert.equal(result.access_token, 'mock-access-token');
    assert.equal(result.refresh_token, 'mock-refresh-token');
  });

  it('returns null on HTTP error', async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async (url, opts) => {
      const urlStr = typeof url === 'string' ? url : url.toString();
      if (urlStr.includes('/oauth2/token')) {
        return new Response('Bad Request', { status: 400 });
      }
      return originalFetch(url, opts);
    };

    const result = await mod.exchangeCodeForTokens('bad-code');
    assert.equal(result, null);
  });

  it('works without client secret (public client)', async () => {
    delete process.env.COGNITO_CLIENT_SECRET;
    const ts = Date.now() + Math.random();
    const mod2 = await import(`../server/token-exchange.ts?t=${ts}`);

    let capturedBody = '';
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async (url, opts) => {
      const urlStr = typeof url === 'string' ? url : url.toString();
      if (urlStr.includes('/oauth2/token')) {
        capturedBody = opts?.body?.toString() ?? '';
        return new Response(
          JSON.stringify({
            id_token: 'tok',
            access_token: 'tok',
            refresh_token: 'tok',
            token_type: 'Bearer',
            expires_in: 3600,
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }
      return originalFetch(url, opts);
    };

    await mod2.exchangeCodeForTokens('code');
    assert.equal(capturedBody.includes('client_secret'), false);
  });
});

// ─── Return URL Validation Tests ─────────────────────────────────────────────

describe('validateReturnUrl', () => {
  /** @type {import('../server/oidc.ts')} */
  let mod;

  beforeEach(async () => {
    delete process.env.COGNITO_CLIENT_SECRET;
    delete process.env.AUTH_STATE_SECRET;
    const ts = Date.now() + Math.random();
    mod = await import(`../server/oidc.ts?t=${ts}`);
  });

  it('returns a valid path unchanged', () => {
    assert.equal(mod.validateReturnUrl('/reviews/viper-v3-pro'), '/reviews/viper-v3-pro');
  });

  it('allows paths with query strings', () => {
    assert.equal(mod.validateReturnUrl('/hub?category=mouse&sort=weight'), '/hub?category=mouse&sort=weight');
  });

  it('defaults to / for empty input', () => {
    assert.equal(mod.validateReturnUrl(''), '/');
    assert.equal(mod.validateReturnUrl(undefined), '/');
    assert.equal(mod.validateReturnUrl(null), '/');
  });

  it('rejects protocol-relative URLs (//evil.com)', () => {
    assert.equal(mod.validateReturnUrl('//evil.com/attack'), '/');
  });

  it('rejects javascript: scheme', () => {
    assert.equal(mod.validateReturnUrl('javascript:alert(1)'), '/');
  });

  it('rejects http: and data: schemes', () => {
    assert.equal(mod.validateReturnUrl('http://evil.com'), '/');
    assert.equal(mod.validateReturnUrl('data:text/html,<script>'), '/');
  });
});

// ─── PKCE Generation Tests ───────────────────────────────────────────────────

describe('generatePkceChallenge', () => {
  /** @type {import('../server/oidc.ts')} */
  let mod;

  beforeEach(async () => {
    delete process.env.COGNITO_CLIENT_SECRET;
    delete process.env.AUTH_STATE_SECRET;
    const ts = Date.now() + Math.random();
    mod = await import(`../server/oidc.ts?t=${ts}`);
  });

  it('returns an object with verifier and challenge', () => {
    const result = mod.generatePkceChallenge();
    assert.ok(result.verifier);
    assert.ok(result.challenge);
    assert.notEqual(result.verifier, result.challenge);
  });

  it('verifier is 43 characters base64url', () => {
    const { verifier } = mod.generatePkceChallenge();
    assert.equal(verifier.length, 43);
    assert.ok(/^[A-Za-z0-9_-]+$/.test(verifier), 'verifier must be base64url characters');
  });

  it('challenge is base64url SHA-256 of verifier', () => {
    const { verifier, challenge } = mod.generatePkceChallenge();
    const expected = createHash('sha256').update(verifier).digest('base64url');
    assert.equal(challenge, expected);
  });

  it('generates unique verifiers each call', () => {
    const a = mod.generatePkceChallenge();
    const b = mod.generatePkceChallenge();
    assert.notEqual(a.verifier, b.verifier);
  });

  it('challenge is deterministic for a given verifier', () => {
    const { verifier, challenge } = mod.generatePkceChallenge();
    const recomputed = createHash('sha256').update(verifier).digest('base64url');
    assert.equal(challenge, recomputed);
  });
});

// ─── PKCE Cookie Helpers Tests ───────────────────────────────────────────────

describe('PKCE cookie helpers', () => {
  /** @type {import('../server/cookies.ts')} */
  let mod;

  beforeEach(async () => {
    const ts = Date.now() + Math.random();
    mod = await import(`../server/cookies.ts?t=${ts}`);
  });

  it('buildPkceCookie creates HttpOnly SameSite=Lax cookie with Max-Age=300', () => {
    const cookie = mod.buildPkceCookie('test-verifier', false);
    assert.ok(cookie.startsWith('eg_pkce=test-verifier'));
    assert.ok(cookie.includes('HttpOnly'));
    assert.ok(cookie.includes('SameSite=Lax'));
    assert.ok(cookie.includes('Max-Age=300'));
    assert.ok(!cookie.includes('Secure'));
  });

  it('buildPkceCookie adds Secure flag in prod', () => {
    const cookie = mod.buildPkceCookie('test-verifier', true);
    assert.ok(cookie.includes('Secure'));
  });

  it('buildClearPkceCookie expires the cookie', () => {
    const cookie = mod.buildClearPkceCookie();
    assert.ok(cookie.startsWith('eg_pkce='));
    assert.ok(cookie.includes('Max-Age=0'));
  });
});

// ─── Token Exchange with PKCE Tests ──────────────────────────────────────────

describe('exchangeCodeForTokens with PKCE', () => {
  /** @type {import('../server/token-exchange.ts')} */
  let mod;

  beforeEach(async () => {
    process.env.PUBLIC_COGNITO_APP_CLIENT_ID = 'test-client-id';
    process.env.COGNITO_CLIENT_SECRET = 'test-secret';
    process.env.COGNITO_DOMAIN = 'test.auth.us-east-1.amazoncognito.com';
    process.env.COGNITO_CALLBACK_URL = 'http://localhost:4321/auth/callback';

    const ts = Date.now() + Math.random();
    mod = await import(`../server/token-exchange.ts?t=${ts}`);
  });

  it('includes code_verifier in POST body when provided', async () => {
    let capturedBody = '';
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async (url, opts) => {
      const urlStr = typeof url === 'string' ? url : url.toString();
      if (urlStr.includes('/oauth2/token')) {
        capturedBody = opts?.body?.toString() ?? '';
        return new Response(
          JSON.stringify({
            id_token: 'tok', access_token: 'tok', refresh_token: 'tok',
            token_type: 'Bearer', expires_in: 3600,
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }
      return originalFetch(url, opts);
    };

    await mod.exchangeCodeForTokens('code', 'my-verifier-123');
    assert.ok(capturedBody.includes('code_verifier=my-verifier-123'));
  });

  it('omits code_verifier when not provided', async () => {
    let capturedBody = '';
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async (url, opts) => {
      const urlStr = typeof url === 'string' ? url : url.toString();
      if (urlStr.includes('/oauth2/token')) {
        capturedBody = opts?.body?.toString() ?? '';
        return new Response(
          JSON.stringify({
            id_token: 'tok', access_token: 'tok', refresh_token: 'tok',
            token_type: 'Bearer', expires_in: 3600,
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }
      return originalFetch(url, opts);
    };

    await mod.exchangeCodeForTokens('code');
    assert.equal(capturedBody.includes('code_verifier'), false);
  });
});

// ─── Refresh Token Tests ─────────────────────────────────────────────────────

describe('refreshTokens', () => {
  /** @type {import('../server/refresh.ts')} */
  let mod;

  beforeEach(async () => {
    process.env.PUBLIC_COGNITO_APP_CLIENT_ID = 'test-client-id';
    process.env.COGNITO_CLIENT_SECRET = 'test-secret';
    process.env.COGNITO_DOMAIN = 'test.auth.us-east-1.amazoncognito.com';

    const ts = Date.now() + Math.random();
    mod = await import(`../server/refresh.ts?t=${ts}`);
  });

  it('returns new tokens on success', async () => {
    const mockTokens = {
      id_token: 'new-id-token',
      access_token: 'new-access-token',
      token_type: 'Bearer',
      expires_in: 3600,
    };

    const originalFetch = globalThis.fetch;
    globalThis.fetch = async (url, opts) => {
      const urlStr = typeof url === 'string' ? url : url.toString();
      if (urlStr.includes('/oauth2/token')) {
        return new Response(JSON.stringify(mockTokens), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      return originalFetch(url, opts);
    };

    const result = await mod.refreshTokens('old-refresh-token');
    assert.ok(result);
    assert.equal(result.id_token, 'new-id-token');
    assert.equal(result.access_token, 'new-access-token');
  });

  it('returns null on HTTP error', async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async (url, opts) => {
      const urlStr = typeof url === 'string' ? url : url.toString();
      if (urlStr.includes('/oauth2/token')) {
        return new Response('Unauthorized', { status: 401 });
      }
      return originalFetch(url, opts);
    };

    const result = await mod.refreshTokens('expired-refresh-token');
    assert.equal(result, null);
  });

  it('returns null on network error', async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async () => {
      throw new Error('Network failure');
    };

    const result = await mod.refreshTokens('some-token');
    assert.equal(result, null);
  });

  it('sends grant_type=refresh_token in POST body', async () => {
    let capturedBody = '';
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async (url, opts) => {
      const urlStr = typeof url === 'string' ? url : url.toString();
      if (urlStr.includes('/oauth2/token')) {
        capturedBody = opts?.body?.toString() ?? '';
        return new Response(
          JSON.stringify({ id_token: 't', access_token: 't', token_type: 'Bearer', expires_in: 3600 }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }
      return originalFetch(url, opts);
    };

    await mod.refreshTokens('my-refresh-token');
    assert.ok(capturedBody.includes('grant_type=refresh_token'));
    assert.ok(capturedBody.includes('refresh_token=my-refresh-token'));
  });

  it('includes client_secret when available', async () => {
    let capturedBody = '';
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async (url, opts) => {
      const urlStr = typeof url === 'string' ? url : url.toString();
      if (urlStr.includes('/oauth2/token')) {
        capturedBody = opts?.body?.toString() ?? '';
        return new Response(
          JSON.stringify({ id_token: 't', access_token: 't', token_type: 'Bearer', expires_in: 3600 }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }
      return originalFetch(url, opts);
    };

    await mod.refreshTokens('tok');
    assert.ok(capturedBody.includes('client_secret=test-secret'));
  });

  it('omits client_secret for public clients', async () => {
    delete process.env.COGNITO_CLIENT_SECRET;
    const ts = Date.now() + Math.random();
    const mod2 = await import(`../server/refresh.ts?t=${ts}`);

    let capturedBody = '';
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async (url, opts) => {
      const urlStr = typeof url === 'string' ? url : url.toString();
      if (urlStr.includes('/oauth2/token')) {
        capturedBody = opts?.body?.toString() ?? '';
        return new Response(
          JSON.stringify({ id_token: 't', access_token: 't', token_type: 'Bearer', expires_in: 3600 }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }
      return originalFetch(url, opts);
    };

    await mod2.refreshTokens('tok');
    assert.equal(capturedBody.includes('client_secret'), false);
  });

  it('returns null for empty refresh token', async () => {
    const result = await mod.refreshTokens('');
    assert.equal(result, null);
  });
});

// ─── JWT Expiry Helper Tests ─────────────────────────────────────────────────

describe('getTokenExpiry', () => {
  /** @type {import('../server/jwt.ts')} */
  let mod;

  beforeEach(async () => {
    process.env.PUBLIC_COGNITO_REGION = 'us-east-1';
    process.env.PUBLIC_COGNITO_USER_POOL_ID = 'us-east-1_TestPool';
    process.env.PUBLIC_COGNITO_APP_CLIENT_ID = 'test-client-id';
    const ts = Date.now() + Math.random();
    mod = await import(`../server/jwt.ts?t=${ts}`);
  });

  it('returns exp from a valid JWT payload', () => {
    // Build a fake JWT with an exp claim (no signature verification)
    const payload = { sub: 'user-1', exp: 1700000000 };
    const header = { alg: 'RS256', typ: 'JWT' };
    const token = [
      Buffer.from(JSON.stringify(header)).toString('base64url'),
      Buffer.from(JSON.stringify(payload)).toString('base64url'),
      'fake-signature',
    ].join('.');

    const exp = mod.getTokenExpiry(token);
    assert.equal(exp, 1700000000);
  });

  it('returns null for a malformed token', () => {
    assert.equal(mod.getTokenExpiry('not-a-jwt'), null);
    assert.equal(mod.getTokenExpiry(''), null);
  });

  it('returns null when exp claim is missing', () => {
    const payload = { sub: 'user-1' };
    const header = { alg: 'RS256', typ: 'JWT' };
    const token = [
      Buffer.from(JSON.stringify(header)).toString('base64url'),
      Buffer.from(JSON.stringify(payload)).toString('base64url'),
      'fake-signature',
    ].join('.');

    assert.equal(mod.getTokenExpiry(token), null);
  });
});

// ─── escapeHtml Tests ──────────────────────────────────────────────────────

describe('escapeHtml', () => {
  /** @type {import('../server/html.ts')} */
  let mod;

  beforeEach(async () => {
    const ts = Date.now() + Math.random();
    mod = await import(`../server/html.ts?t=${ts}`);
  });

  it('escapes <script> tags', () => {
    assert.equal(
      mod.escapeHtml('<script>alert(1)</script>'),
      '&lt;script&gt;alert(1)&lt;/script&gt;'
    );
  });

  it('escapes ampersands', () => {
    assert.equal(mod.escapeHtml('a&b'), 'a&amp;b');
  });

  it('escapes double and single quotes', () => {
    assert.equal(mod.escapeHtml('"hello"'), '&quot;hello&quot;');
    assert.equal(mod.escapeHtml("it's"), 'it&#39;s');
  });

  it('passes through plain text unchanged', () => {
    assert.equal(mod.escapeHtml('hello world'), 'hello world');
  });

  it('handles empty string', () => {
    assert.equal(mod.escapeHtml(''), '');
  });
});

// ─── errorPage Tests ───────────────────────────────────────────────────────

describe('errorPage (callback.ts)', () => {
  // WHY: these tests import callback.ts indirectly via the errorPage helper.
  // Since errorPage is private, we test it through the GET handler instead.
  // But the plan says to export escapeHtml from html.ts and test that directly.
  // For errorPage behavior (status + escaping), we test the callback GET handler.

  /** @type {import('../server/html.ts')} */
  let htmlMod;

  beforeEach(async () => {
    const ts = Date.now() + Math.random();
    htmlMod = await import(`../server/html.ts?t=${ts}`);
  });

  it('errorPage returns status 400', () => {
    const res = htmlMod.errorPage('test error');
    assert.equal(res.status, 400);
  });

  it('errorPage HTML-escapes the message', async () => {
    const res = htmlMod.errorPage('<img onerror=alert(1)>');
    const body = await res.text();
    assert.ok(body.includes('&lt;img onerror=alert(1)&gt;'));
    assert.ok(!body.includes('<img onerror'));
  });

  it('errorPage sets Content-Type to text/html', () => {
    const res = htmlMod.errorPage('err');
    assert.equal(res.headers.get('Content-Type'), 'text/html');
  });

  it('errorPage sets X-Robots-Tag to noindex,nofollow', () => {
    const res = htmlMod.errorPage('err');
    assert.equal(res.headers.get('X-Robots-Tag'), 'noindex,nofollow');
  });
});

// ─── buildLoginRedirect Tests ──────────────────────────────────────────────

describe('buildLoginRedirect', () => {
  /** @type {import('../server/login-redirect.ts')} */
  let mod;

  beforeEach(async () => {
    process.env.PUBLIC_COGNITO_APP_CLIENT_ID = 'test-client-id';
    process.env.COGNITO_CLIENT_SECRET = 'test-secret';
    process.env.COGNITO_DOMAIN = 'test.auth.us-east-1.amazoncognito.com';
    process.env.COGNITO_CALLBACK_URL = 'http://localhost:4321/auth/callback';
    process.env.COGNITO_LOGOUT_URL = 'http://localhost:4321';
    process.env.PUBLIC_COGNITO_REGION = 'us-east-1';
    process.env.PUBLIC_COGNITO_USER_POOL_ID = 'us-east-1_TestPool';

    const ts = Date.now() + Math.random();
    mod = await import(`../server/login-redirect.ts?t=${ts}`);
  });

  it('returns 302 with Location pointing to Cognito authorize URL', () => {
    const res = mod.buildLoginRedirect({ provider: 'Google', isProd: false });
    assert.equal(res.status, 302);
    const location = res.headers.get('Location');
    assert.ok(location);
    assert.ok(location.includes('/oauth2/authorize'));
  });

  it('Location URL contains identity_provider matching the provider arg', () => {
    const res = mod.buildLoginRedirect({ provider: 'Google', isProd: false });
    const location = res.headers.get('Location');
    assert.ok(location.includes('identity_provider=Google'));
  });

  it('sets eg_nonce cookie (HttpOnly, SameSite=Lax)', () => {
    const res = mod.buildLoginRedirect({ provider: 'Google', isProd: false });
    const cookies = res.headers.getSetCookie();
    const nonce = cookies.find(c => c.startsWith('eg_nonce='));
    assert.ok(nonce, 'eg_nonce cookie must be present');
    assert.ok(nonce.includes('HttpOnly'));
    assert.ok(nonce.includes('SameSite=Lax'));
  });

  it('sets eg_pkce cookie', () => {
    const res = mod.buildLoginRedirect({ provider: 'Discord', isProd: false });
    const cookies = res.headers.getSetCookie();
    const pkce = cookies.find(c => c.startsWith('eg_pkce='));
    assert.ok(pkce, 'eg_pkce cookie must be present');
  });

  it('passes extraParams (screen_hint) into Location URL', () => {
    const res = mod.buildLoginRedirect({
      provider: 'COGNITO',
      isProd: false,
      extraParams: { screen_hint: 'signup' },
    });
    const location = res.headers.get('Location');
    assert.ok(location.includes('screen_hint=signup'));
  });

  it('passes extraParams (prompt=select_account) into Location URL', () => {
    const res = mod.buildLoginRedirect({
      provider: 'Google',
      isProd: false,
      extraParams: { prompt: 'select_account' },
    });
    const location = res.headers.get('Location');
    assert.ok(location.includes('prompt=select_account'));
  });

  it('sets X-Robots-Tag to noindex,nofollow', () => {
    const res = mod.buildLoginRedirect({ provider: 'Google', isProd: false });
    assert.equal(res.headers.get('X-Robots-Tag'), 'noindex,nofollow');
  });
});
