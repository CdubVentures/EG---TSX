/**
 * OIDC state CSRF protection.
 *
 * If AUTH_STATE_SECRET (or COGNITO_CLIENT_SECRET) is set, generates HMAC-signed
 * state strings for self-validation. If neither is available, falls back to a
 * plain random nonce — the HttpOnly eg_nonce cookie comparison still provides
 * CSRF protection (attacker can't read the cookie to forge matching state).
 */

import { createHash, createHmac, randomBytes } from 'node:crypto';

function getSecret(): string | null {
  const env = typeof import.meta !== 'undefined' && import.meta.env
    ? import.meta.env
    : process.env;

  return env.AUTH_STATE_SECRET || env.COGNITO_CLIENT_SECRET || null;
}

/**
 * Generate a state string for OIDC authorization requests.
 * HMAC-signed if a server secret is available, plain nonce otherwise.
 */
export function generateOidcState(): string {
  const nonce = randomBytes(16).toString('hex');
  const secret = getSecret();

  if (secret) {
    const hmac = createHmac('sha256', secret).update(nonce).digest('hex');
    return `${nonce}.${hmac}`;
  }

  // WHY: plain nonce fallback — CSRF protection comes from the HttpOnly cookie
  // comparison in the callback handler (state param must match eg_nonce cookie).
  return nonce;
}

/**
 * Validate an OIDC state string returned from the authorization server.
 * If HMAC-signed, verifies signature. If plain nonce, always returns true
 * (the cookie comparison in the callback handler is the actual CSRF check).
 */
export function validateOidcState(state: string): boolean {
  if (!state) return false;

  const secret = getSecret();
  const dotIndex = state.indexOf('.');

  // Plain nonce (no dot) — valid if non-empty (cookie comparison is the CSRF gate)
  if (dotIndex === -1) {
    return state.length > 0;
  }

  // HMAC-signed: verify signature
  if (!secret) return false;

  const nonce = state.slice(0, dotIndex);
  const receivedHmac = state.slice(dotIndex + 1);
  if (!nonce || !receivedHmac) return false;

  const expectedHmac = createHmac('sha256', secret).update(nonce).digest('hex');

  // WHY: constant-time comparison to prevent timing attacks
  if (receivedHmac.length !== expectedHmac.length) return false;
  let mismatch = 0;
  for (let i = 0; i < expectedHmac.length; i++) {
    mismatch |= receivedHmac.charCodeAt(i) ^ expectedHmac.charCodeAt(i);
  }
  return mismatch === 0;
}

/**
 * Validate a return URL from the eg_return cookie.
 * Prevents open redirect attacks — only allows relative paths starting with /.
 */
export function validateReturnUrl(url: string | null | undefined): string {
  if (!url || typeof url !== 'string') return '/';
  const trimmed = url.trim();
  if (!trimmed || !trimmed.startsWith('/')) return '/';
  // WHY: reject protocol-relative URLs (//evil.com) and scheme injections
  if (trimmed.startsWith('//')) return '/';
  return trimmed;
}

/**
 * Generate PKCE code_verifier and code_challenge (RFC 7636).
 * verifier = 32 random bytes as base64url (43 chars).
 * challenge = SHA-256(verifier) as base64url.
 */
export function generatePkceChallenge(): { verifier: string; challenge: string } {
  const verifier = randomBytes(32).toString('base64url');
  const challenge = createHash('sha256').update(verifier).digest('base64url');
  return { verifier, challenge };
}
