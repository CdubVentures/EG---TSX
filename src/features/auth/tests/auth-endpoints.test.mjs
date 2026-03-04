import { describe, it, beforeEach, afterEach, mock } from 'node:test';
import assert from 'node:assert/strict';

/**
 * Auth API endpoints — unit tests
 *
 * Tests the 6 POST endpoints: sign-in, sign-up, confirm-sign-up,
 * forgot-password, confirm-forgot-password, resend-code.
 *
 * Strategy: each endpoint file exports a POST handler that takes an
 * Astro APIContext-like object. We mock the cognito-api module functions
 * and verify JSON responses + Set-Cookie headers.
 */

// ─── Shared test helpers ─────────────────────────────────────────────────────

/** Build a minimal Astro APIContext-like object for POST endpoints. */
function makeContext(body) {
  return {
    request: new Request('http://localhost:4321/api/auth/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  };
}

/** Build a context with non-JSON body. */
function makeNonJsonContext() {
  return {
    request: new Request('http://localhost:4321/api/auth/test', {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: 'not json',
    }),
  };
}

// ─── Sign-In Endpoint ────────────────────────────────────────────────────────

describe('POST /api/auth/sign-in', () => {
  /** @type {import('../../../pages/api/auth/sign-in.ts')} */
  let mod;

  beforeEach(async () => {
    process.env.PUBLIC_COGNITO_REGION = 'us-east-2';
    process.env.PUBLIC_COGNITO_APP_CLIENT_ID = 'test-client-id';
    process.env.PUBLIC_COGNITO_USER_POOL_ID = 'us-east-2_TestPool';

    // Mock cognitoSignIn — default to success
    globalThis.__mockCognitoSignIn = async () => ({
      ok: true,
      data: {
        idToken: 'mock-id-token',
        accessToken: 'mock-access-token',
        refreshToken: 'mock-refresh-token',
        expiresIn: 3600,
      },
    });

    // Mock verifyIdToken — default to valid claims
    globalThis.__mockVerifyIdToken = async () => ({
      uid: 'user-123',
      email: 'user@example.com',
      username: 'testuser',
    });

    // Mock readVaultRev — default to existing user (rev > 0)
    globalThis.__mockReadVaultRev = async () => 1;

    const ts = Date.now() + Math.random();
    mod = await import(`../../../pages/api/auth/sign-in.ts?t=${ts}`);
  });

  it('returns 200 with authenticated status on success', async () => {
    const ctx = makeContext({ email: 'user@example.com', password: 'Pass1!' });
    const res = await mod.POST(ctx);
    assert.equal(res.status, 200);
    const json = await res.json();
    assert.equal(json.status, 'authenticated');
    assert.equal(json.uid, 'user-123');
    assert.equal(json.email, 'user@example.com');
    assert.equal(json.username, 'testuser');
  });

  it('sets auth cookies on successful sign-in', async () => {
    const ctx = makeContext({ email: 'user@example.com', password: 'Pass1!' });
    const res = await mod.POST(ctx);
    const cookies = res.headers.getSetCookie();
    assert.ok(cookies.some(c => c.startsWith('eg_session=')), 'must set eg_session');
    assert.ok(cookies.some(c => c.startsWith('eg_refresh=')), 'must set eg_refresh');
    assert.ok(cookies.some(c => c.startsWith('eg_hint=')), 'must set eg_hint');
  });

  it('sets eg_first cookie for first-time signup (rev === 0)', async () => {
    globalThis.__mockReadVaultRev = async () => 0;
    const ctx = makeContext({ email: 'new@example.com', password: 'Pass1!' });
    const res = await mod.POST(ctx);
    const cookies = res.headers.getSetCookie();
    assert.ok(cookies.some(c => c.startsWith('eg_first=')), 'must set eg_first for first signup');
  });

  it('does not set eg_first for returning user', async () => {
    globalThis.__mockReadVaultRev = async () => 5;
    const ctx = makeContext({ email: 'user@example.com', password: 'Pass1!' });
    const res = await mod.POST(ctx);
    const cookies = res.headers.getSetCookie();
    assert.ok(!cookies.some(c => c.startsWith('eg_first=')));
  });

  it('returns 400 with error for Cognito error', async () => {
    globalThis.__mockCognitoSignIn = async () => ({
      ok: false,
      error: { code: 'NotAuthorizedException', message: 'Incorrect email or password' },
    });
    const ctx = makeContext({ email: 'user@example.com', password: 'wrong' });
    const res = await mod.POST(ctx);
    assert.equal(res.status, 400);
    const json = await res.json();
    assert.equal(json.error.code, 'NotAuthorizedException');
  });

  it('returns 400 for missing email', async () => {
    const ctx = makeContext({ password: 'Pass1!' });
    const res = await mod.POST(ctx);
    assert.equal(res.status, 400);
  });

  it('returns 400 for missing password', async () => {
    const ctx = makeContext({ email: 'user@example.com' });
    const res = await mod.POST(ctx);
    assert.equal(res.status, 400);
  });

  it('returns 400 for non-JSON body', async () => {
    const ctx = makeNonJsonContext();
    const res = await mod.POST(ctx);
    assert.equal(res.status, 400);
  });
});

// ─── Sign-Up Endpoint ────────────────────────────────────────────────────────

describe('POST /api/auth/sign-up', () => {
  /** @type {import('../../../pages/api/auth/sign-up.ts')} */
  let mod;

  beforeEach(async () => {
    process.env.PUBLIC_COGNITO_REGION = 'us-east-2';
    process.env.PUBLIC_COGNITO_APP_CLIENT_ID = 'test-client-id';

    globalThis.__mockCognitoSignUp = async () => ({
      ok: true,
      data: { userSub: 'sub-123', codeDelivery: 'u***@example.com' },
    });

    const ts = Date.now() + Math.random();
    mod = await import(`../../../pages/api/auth/sign-up.ts?t=${ts}`);
  });

  it('returns 200 with confirm-required on success', async () => {
    const ctx = makeContext({ email: 'new@example.com', password: 'Pass1!' });
    const res = await mod.POST(ctx);
    assert.equal(res.status, 200);
    const json = await res.json();
    assert.equal(json.status, 'confirm-required');
    assert.equal(json.email, 'new@example.com');
  });

  it('returns 400 for Cognito error', async () => {
    globalThis.__mockCognitoSignUp = async () => ({
      ok: false,
      error: { code: 'UsernameExistsException', message: 'An account with this email already exists' },
    });
    const ctx = makeContext({ email: 'taken@example.com', password: 'Pass1!' });
    const res = await mod.POST(ctx);
    assert.equal(res.status, 400);
    const json = await res.json();
    assert.equal(json.error.code, 'UsernameExistsException');
  });

  it('returns 400 for missing fields', async () => {
    const ctx = makeContext({ email: 'a@b.com' });
    const res = await mod.POST(ctx);
    assert.equal(res.status, 400);
  });
});

// ─── Confirm Sign-Up Endpoint ────────────────────────────────────────────────

describe('POST /api/auth/confirm-sign-up', () => {
  /** @type {import('../../../pages/api/auth/confirm-sign-up.ts')} */
  let mod;

  beforeEach(async () => {
    process.env.PUBLIC_COGNITO_REGION = 'us-east-2';
    process.env.PUBLIC_COGNITO_APP_CLIENT_ID = 'test-client-id';

    globalThis.__mockCognitoConfirmSignUp = async () => ({ ok: true, data: undefined });

    const ts = Date.now() + Math.random();
    mod = await import(`../../../pages/api/auth/confirm-sign-up.ts?t=${ts}`);
  });

  it('returns 200 with confirmed status on success', async () => {
    const ctx = makeContext({ email: 'user@example.com', code: '123456' });
    const res = await mod.POST(ctx);
    assert.equal(res.status, 200);
    const json = await res.json();
    assert.equal(json.status, 'confirmed');
  });

  it('returns 400 for invalid code', async () => {
    globalThis.__mockCognitoConfirmSignUp = async () => ({
      ok: false,
      error: { code: 'CodeMismatchException', message: 'Invalid verification code' },
    });
    const ctx = makeContext({ email: 'user@example.com', code: '000000' });
    const res = await mod.POST(ctx);
    assert.equal(res.status, 400);
  });
});

// ─── Forgot Password Endpoint ───────────────────────────────────────────────

describe('POST /api/auth/forgot-password', () => {
  /** @type {import('../../../pages/api/auth/forgot-password.ts')} */
  let mod;

  beforeEach(async () => {
    process.env.PUBLIC_COGNITO_REGION = 'us-east-2';
    process.env.PUBLIC_COGNITO_APP_CLIENT_ID = 'test-client-id';

    globalThis.__mockCognitoForgotPassword = async () => ({
      ok: true,
      data: { codeDelivery: 'u***@example.com' },
    });

    const ts = Date.now() + Math.random();
    mod = await import(`../../../pages/api/auth/forgot-password.ts?t=${ts}`);
  });

  it('returns 200 with code-sent on success', async () => {
    const ctx = makeContext({ email: 'user@example.com' });
    const res = await mod.POST(ctx);
    assert.equal(res.status, 200);
    const json = await res.json();
    assert.equal(json.status, 'code-sent');
    assert.equal(json.email, 'user@example.com');
  });

  it('returns 400 for Cognito error', async () => {
    globalThis.__mockCognitoForgotPassword = async () => ({
      ok: false,
      error: { code: 'UserNotFoundException', message: 'Incorrect email or password' },
    });
    const ctx = makeContext({ email: 'nobody@example.com' });
    const res = await mod.POST(ctx);
    assert.equal(res.status, 400);
  });
});

// ─── Confirm Forgot Password Endpoint ───────────────────────────────────────

describe('POST /api/auth/confirm-forgot-password', () => {
  /** @type {import('../../../pages/api/auth/confirm-forgot-password.ts')} */
  let mod;

  beforeEach(async () => {
    process.env.PUBLIC_COGNITO_REGION = 'us-east-2';
    process.env.PUBLIC_COGNITO_APP_CLIENT_ID = 'test-client-id';

    globalThis.__mockCognitoConfirmForgotPassword = async () => ({ ok: true, data: undefined });

    const ts = Date.now() + Math.random();
    mod = await import(`../../../pages/api/auth/confirm-forgot-password.ts?t=${ts}`);
  });

  it('returns 200 with password-reset on success', async () => {
    const ctx = makeContext({ email: 'user@example.com', code: '123456', newPassword: 'NewPass1!' });
    const res = await mod.POST(ctx);
    assert.equal(res.status, 200);
    const json = await res.json();
    assert.equal(json.status, 'password-reset');
  });

  it('returns 400 for missing newPassword', async () => {
    const ctx = makeContext({ email: 'user@example.com', code: '123456' });
    const res = await mod.POST(ctx);
    assert.equal(res.status, 400);
  });

  it('returns 400 for Cognito error', async () => {
    globalThis.__mockCognitoConfirmForgotPassword = async () => ({
      ok: false,
      error: { code: 'CodeMismatchException', message: 'Invalid verification code' },
    });
    const ctx = makeContext({ email: 'user@example.com', code: '000000', newPassword: 'NewPass1!' });
    const res = await mod.POST(ctx);
    assert.equal(res.status, 400);
  });
});

// ─── Resend Code Endpoint ────────────────────────────────────────────────────

describe('POST /api/auth/resend-code', () => {
  /** @type {import('../../../pages/api/auth/resend-code.ts')} */
  let mod;

  beforeEach(async () => {
    process.env.PUBLIC_COGNITO_REGION = 'us-east-2';
    process.env.PUBLIC_COGNITO_APP_CLIENT_ID = 'test-client-id';

    globalThis.__mockCognitoResendCode = async () => ({
      ok: true,
      data: { codeDelivery: 'u***@example.com' },
    });

    const ts = Date.now() + Math.random();
    mod = await import(`../../../pages/api/auth/resend-code.ts?t=${ts}`);
  });

  it('returns 200 with code-sent on success', async () => {
    const ctx = makeContext({ email: 'user@example.com' });
    const res = await mod.POST(ctx);
    assert.equal(res.status, 200);
    const json = await res.json();
    assert.equal(json.status, 'code-sent');
  });

  it('returns 400 for missing email', async () => {
    const ctx = makeContext({});
    const res = await mod.POST(ctx);
    assert.equal(res.status, 400);
  });

  it('returns 400 for Cognito error', async () => {
    globalThis.__mockCognitoResendCode = async () => ({
      ok: false,
      error: { code: 'LimitExceededException', message: 'Too many attempts — please wait and try again' },
    });
    const ctx = makeContext({ email: 'user@example.com' });
    const res = await mod.POST(ctx);
    assert.equal(res.status, 400);
    const json = await res.json();
    assert.equal(json.error.code, 'LimitExceededException');
  });
});
