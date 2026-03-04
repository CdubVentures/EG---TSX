import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';

/**
 * cognito-api.ts — Cognito User Pool API wrapper tests
 *
 * Contract:
 *   Each function POSTs to https://cognito-idp.{region}.amazonaws.com/
 *   with X-Amz-Target header specifying the Cognito action.
 *   Returns { ok: true, data } on success or { ok: false, error: { code, message } } on failure.
 *   Error mapping translates Cognito error types to user-friendly messages.
 */

/** @type {typeof globalThis.fetch} */
let originalFetch;

/** @type {import('../server/cognito-api.ts')} */
let mod;

/**
 * Helper: mock fetch to return a Cognito-style response.
 * @param {number} status
 * @param {object} body
 * @param {(url: string, opts: RequestInit) => void} [onCall] - optional spy
 */
function mockFetch(status, body, onCall) {
  globalThis.fetch = async (url, opts) => {
    if (onCall) onCall(typeof url === 'string' ? url : url.toString(), opts);
    return new Response(JSON.stringify(body), {
      status,
      headers: { 'Content-Type': 'application/x-amz-json-1.1' },
    });
  };
}

/** Mock fetch that throws (network failure). */
function mockFetchThrows() {
  globalThis.fetch = async () => { throw new Error('Network failure'); };
}

/** Mock fetch that returns non-JSON. */
function mockFetchNonJson() {
  globalThis.fetch = async () => new Response('Internal Server Error', { status: 500 });
}

// ─── Setup / Teardown ────────────────────────────────────────────────────────

beforeEach(async () => {
  originalFetch = globalThis.fetch;
  process.env.PUBLIC_COGNITO_REGION = 'us-east-2';
  process.env.PUBLIC_COGNITO_APP_CLIENT_ID = 'test-client-id';
  const ts = Date.now() + Math.random();
  mod = await import(`../server/cognito-api.ts?t=${ts}`);
});

afterEach(() => {
  globalThis.fetch = originalFetch;
});

// ─── cognitoSignIn ───────────────────────────────────────────────────────────

describe('cognitoSignIn', () => {
  it('returns AuthResult on successful sign-in', async () => {
    mockFetch(200, {
      AuthenticationResult: {
        IdToken: 'id-tok-123',
        AccessToken: 'access-tok-123',
        RefreshToken: 'refresh-tok-123',
        ExpiresIn: 3600,
      },
    });

    const result = await mod.cognitoSignIn('user@example.com', 'Password1!');
    assert.equal(result.ok, true);
    assert.equal(result.data.idToken, 'id-tok-123');
    assert.equal(result.data.accessToken, 'access-tok-123');
    assert.equal(result.data.refreshToken, 'refresh-tok-123');
    assert.equal(result.data.expiresIn, 3600);
  });

  it('sends correct Cognito action and body', async () => {
    let capturedUrl = '';
    let capturedOpts = {};
    mockFetch(200, {
      AuthenticationResult: {
        IdToken: 't', AccessToken: 't', RefreshToken: 't', ExpiresIn: 3600,
      },
    }, (url, opts) => { capturedUrl = url; capturedOpts = opts; });

    await mod.cognitoSignIn('user@example.com', 'Pass1!');

    assert.ok(capturedUrl.includes('cognito-idp.us-east-2.amazonaws.com'));
    assert.equal(capturedOpts.method, 'POST');
    const headers = capturedOpts.headers;
    assert.equal(headers['X-Amz-Target'], 'AWSCognitoIdentityProviderService.InitiateAuth');
    assert.equal(headers['Content-Type'], 'application/x-amz-json-1.1');

    const body = JSON.parse(capturedOpts.body);
    assert.equal(body.AuthFlow, 'USER_PASSWORD_AUTH');
    assert.equal(body.ClientId, 'test-client-id');
    assert.equal(body.AuthParameters.USERNAME, 'user@example.com');
    assert.equal(body.AuthParameters.PASSWORD, 'Pass1!');
  });

  it('returns generic error for NotAuthorizedException (wrong password)', async () => {
    mockFetch(400, {
      __type: 'NotAuthorizedException',
      message: 'Incorrect username or password.',
    });

    const result = await mod.cognitoSignIn('user@example.com', 'wrong');
    assert.equal(result.ok, false);
    assert.equal(result.error.code, 'NotAuthorizedException');
    assert.equal(result.error.message, 'Incorrect email or password');
  });

  it('returns same generic error for UserNotFoundException (no user enumeration)', async () => {
    mockFetch(400, {
      __type: 'UserNotFoundException',
      message: 'User does not exist.',
    });

    const result = await mod.cognitoSignIn('nobody@example.com', 'pass');
    assert.equal(result.ok, false);
    assert.equal(result.error.code, 'UserNotFoundException');
    assert.equal(result.error.message, 'Incorrect email or password');
  });

  it('returns UserNotConfirmedException when user is not confirmed', async () => {
    mockFetch(400, {
      __type: 'UserNotConfirmedException',
      message: 'User is not confirmed.',
    });

    const result = await mod.cognitoSignIn('unconfirmed@example.com', 'pass');
    assert.equal(result.ok, false);
    assert.equal(result.error.code, 'UserNotConfirmedException');
  });

  it('returns error for LimitExceededException (rate limited)', async () => {
    mockFetch(400, {
      __type: 'LimitExceededException',
      message: 'Attempt limit exceeded, please try after some time.',
    });

    const result = await mod.cognitoSignIn('user@example.com', 'pass');
    assert.equal(result.ok, false);
    assert.equal(result.error.code, 'LimitExceededException');
    assert.equal(result.error.message, 'Too many attempts — please wait and try again');
  });

  it('handles network failure gracefully', async () => {
    mockFetchThrows();
    const result = await mod.cognitoSignIn('user@example.com', 'pass');
    assert.equal(result.ok, false);
    assert.equal(result.error.code, 'NetworkError');
  });

  it('handles non-JSON response gracefully', async () => {
    mockFetchNonJson();
    const result = await mod.cognitoSignIn('user@example.com', 'pass');
    assert.equal(result.ok, false);
  });
});

// ─── cognitoSignUp ───────────────────────────────────────────────────────────

describe('cognitoSignUp', () => {
  it('returns userSub and codeDelivery on success', async () => {
    mockFetch(200, {
      UserSub: 'sub-abc-123',
      CodeDeliveryDetails: {
        Destination: 'u***@example.com',
        DeliveryMedium: 'EMAIL',
        AttributeName: 'email',
      },
    });

    const result = await mod.cognitoSignUp('new@example.com', 'StrongPass1!');
    assert.equal(result.ok, true);
    assert.equal(result.data.userSub, 'sub-abc-123');
    assert.equal(result.data.codeDelivery, 'u***@example.com');
  });

  it('sends correct Cognito action with email attribute', async () => {
    let capturedBody;
    mockFetch(200, { UserSub: 's', CodeDeliveryDetails: { Destination: 'd' } },
      (_url, opts) => { capturedBody = JSON.parse(opts.body); });

    await mod.cognitoSignUp('new@example.com', 'Pass1!');

    assert.equal(capturedBody.ClientId, 'test-client-id');
    assert.equal(capturedBody.Username, 'new@example.com');
    assert.equal(capturedBody.Password, 'Pass1!');
    const emailAttr = capturedBody.UserAttributes.find(a => a.Name === 'email');
    assert.ok(emailAttr);
    assert.equal(emailAttr.Value, 'new@example.com');
  });

  it('returns error for UsernameExistsException (duplicate email)', async () => {
    mockFetch(400, {
      __type: 'UsernameExistsException',
      message: 'An account with the given email already exists.',
    });

    const result = await mod.cognitoSignUp('taken@example.com', 'Pass1!');
    assert.equal(result.ok, false);
    assert.equal(result.error.code, 'UsernameExistsException');
    assert.equal(result.error.message, 'An account with this email already exists');
  });

  it('returns error for InvalidPasswordException (weak password)', async () => {
    mockFetch(400, {
      __type: 'InvalidPasswordException',
      message: 'Password did not conform with policy: Password must have uppercase characters',
    });

    const result = await mod.cognitoSignUp('new@example.com', 'weak');
    assert.equal(result.ok, false);
    assert.equal(result.error.code, 'InvalidPasswordException');
    assert.ok(result.error.message.includes('Password'));
  });
});

// ─── cognitoConfirmSignUp ────────────────────────────────────────────────────

describe('cognitoConfirmSignUp', () => {
  it('returns success on valid code', async () => {
    mockFetch(200, {});

    const result = await mod.cognitoConfirmSignUp('user@example.com', '123456');
    assert.equal(result.ok, true);
  });

  it('sends correct Cognito action', async () => {
    let capturedHeaders;
    mockFetch(200, {}, (_url, opts) => { capturedHeaders = opts.headers; });

    await mod.cognitoConfirmSignUp('user@example.com', '123456');
    assert.equal(capturedHeaders['X-Amz-Target'], 'AWSCognitoIdentityProviderService.ConfirmSignUp');
  });

  it('returns error for CodeMismatchException', async () => {
    mockFetch(400, {
      __type: 'CodeMismatchException',
      message: 'Invalid verification code provided.',
    });

    const result = await mod.cognitoConfirmSignUp('user@example.com', '000000');
    assert.equal(result.ok, false);
    assert.equal(result.error.code, 'CodeMismatchException');
    assert.equal(result.error.message, 'Invalid verification code');
  });

  it('returns error for ExpiredCodeException', async () => {
    mockFetch(400, {
      __type: 'ExpiredCodeException',
      message: 'Code has expired.',
    });

    const result = await mod.cognitoConfirmSignUp('user@example.com', '111111');
    assert.equal(result.ok, false);
    assert.equal(result.error.code, 'ExpiredCodeException');
    assert.equal(result.error.message, 'Verification code expired — request a new one');
  });
});

// ─── cognitoForgotPassword ───────────────────────────────────────────────────

describe('cognitoForgotPassword', () => {
  it('returns codeDelivery on success', async () => {
    mockFetch(200, {
      CodeDeliveryDetails: {
        Destination: 'u***@example.com',
        DeliveryMedium: 'EMAIL',
      },
    });

    const result = await mod.cognitoForgotPassword('user@example.com');
    assert.equal(result.ok, true);
    assert.equal(result.data.codeDelivery, 'u***@example.com');
  });

  it('returns error for UserNotFoundException', async () => {
    mockFetch(400, {
      __type: 'UserNotFoundException',
      message: 'User does not exist.',
    });

    const result = await mod.cognitoForgotPassword('nobody@example.com');
    assert.equal(result.ok, false);
    assert.equal(result.error.code, 'UserNotFoundException');
  });

  it('returns error for LimitExceededException', async () => {
    mockFetch(400, {
      __type: 'LimitExceededException',
      message: 'Attempt limit exceeded.',
    });

    const result = await mod.cognitoForgotPassword('user@example.com');
    assert.equal(result.ok, false);
    assert.equal(result.error.code, 'LimitExceededException');
    assert.equal(result.error.message, 'Too many attempts — please wait and try again');
  });
});

// ─── cognitoConfirmForgotPassword ────────────────────────────────────────────

describe('cognitoConfirmForgotPassword', () => {
  it('returns success on valid code and password', async () => {
    mockFetch(200, {});

    const result = await mod.cognitoConfirmForgotPassword('user@example.com', '123456', 'NewPass1!');
    assert.equal(result.ok, true);
  });

  it('returns error for CodeMismatchException', async () => {
    mockFetch(400, {
      __type: 'CodeMismatchException',
      message: 'Invalid code.',
    });

    const result = await mod.cognitoConfirmForgotPassword('user@example.com', '000000', 'NewPass1!');
    assert.equal(result.ok, false);
    assert.equal(result.error.code, 'CodeMismatchException');
    assert.equal(result.error.message, 'Invalid verification code');
  });

  it('returns error for InvalidPasswordException', async () => {
    mockFetch(400, {
      __type: 'InvalidPasswordException',
      message: 'Password did not conform with policy: Password must have numeric characters',
    });

    const result = await mod.cognitoConfirmForgotPassword('user@example.com', '123456', 'weak');
    assert.equal(result.ok, false);
    assert.equal(result.error.code, 'InvalidPasswordException');
    assert.ok(result.error.message.includes('Password'));
  });
});

// ─── cognitoResendCode ───────────────────────────────────────────────────────

describe('cognitoResendCode', () => {
  it('returns codeDelivery on success', async () => {
    mockFetch(200, {
      CodeDeliveryDetails: {
        Destination: 'u***@example.com',
        DeliveryMedium: 'EMAIL',
      },
    });

    const result = await mod.cognitoResendCode('user@example.com');
    assert.equal(result.ok, true);
    assert.equal(result.data.codeDelivery, 'u***@example.com');
  });

  it('returns error for LimitExceededException', async () => {
    mockFetch(400, {
      __type: 'LimitExceededException',
      message: 'Attempt limit exceeded.',
    });

    const result = await mod.cognitoResendCode('user@example.com');
    assert.equal(result.ok, false);
    assert.equal(result.error.code, 'LimitExceededException');
    assert.equal(result.error.message, 'Too many attempts — please wait and try again');
  });
});

// ─── Cross-cutting: network + non-JSON errors ───────────────────────────────

describe('cross-cutting error handling', () => {
  it('all functions handle network failure', async () => {
    mockFetchThrows();

    const fns = [
      () => mod.cognitoSignIn('a@b.com', 'p'),
      () => mod.cognitoSignUp('a@b.com', 'p'),
      () => mod.cognitoConfirmSignUp('a@b.com', '1'),
      () => mod.cognitoForgotPassword('a@b.com'),
      () => mod.cognitoConfirmForgotPassword('a@b.com', '1', 'p'),
      () => mod.cognitoResendCode('a@b.com'),
    ];

    for (const fn of fns) {
      const result = await fn();
      assert.equal(result.ok, false, `${fn.toString()} should return ok: false on network error`);
      assert.equal(result.error.code, 'NetworkError');
    }
  });

  it('all functions handle non-JSON response', async () => {
    mockFetchNonJson();

    const fns = [
      () => mod.cognitoSignIn('a@b.com', 'p'),
      () => mod.cognitoSignUp('a@b.com', 'p'),
      () => mod.cognitoConfirmSignUp('a@b.com', '1'),
      () => mod.cognitoForgotPassword('a@b.com'),
      () => mod.cognitoConfirmForgotPassword('a@b.com', '1', 'p'),
      () => mod.cognitoResendCode('a@b.com'),
    ];

    for (const fn of fns) {
      const result = await fn();
      assert.equal(result.ok, false, `${fn.toString()} should return ok: false on non-JSON response`);
    }
  });

  it('unknown Cognito error types pass through with original message', async () => {
    mockFetch(400, {
      __type: 'InternalErrorException',
      message: 'Something went wrong on our end.',
    });

    const result = await mod.cognitoSignIn('a@b.com', 'p');
    assert.equal(result.ok, false);
    assert.equal(result.error.code, 'InternalErrorException');
    assert.equal(result.error.message, 'Something went wrong on our end.');
  });
});
