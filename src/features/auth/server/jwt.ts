/** JWT verification using jose — JWKS-based, caches keys in memory. */

import * as jose from 'jose';

export interface VerifiedClaims {
  uid: string;
  email: string | null;
  username: string | null;
}

/** Cached JWKS remote key set — created lazily per issuer. */
let _jwks: ReturnType<typeof jose.createRemoteJWKSet> | null = null;

function getJwks(): ReturnType<typeof jose.createRemoteJWKSet> {
  if (!_jwks) {
    const env = typeof import.meta !== 'undefined' && import.meta.env
      ? import.meta.env
      : process.env;

    const region = env.PUBLIC_COGNITO_REGION;
    const userPoolId = env.PUBLIC_COGNITO_USER_POOL_ID;
    const jwksUrl = new URL(
      `https://cognito-idp.${region}.amazonaws.com/${userPoolId}/.well-known/jwks.json`
    );
    _jwks = jose.createRemoteJWKSet(jwksUrl);
  }
  return _jwks;
}

/**
 * Decode JWT exp claim without signature verification.
 * Used by middleware to check if a token is near expiry before deciding to refresh.
 */
export function getTokenExpiry(token: string): number | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3 || !parts[1]) return null;
    const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString());
    return typeof payload.exp === 'number' ? payload.exp : null;
  } catch {
    return null;
  }
}

/**
 * Verify a Cognito id_token JWT.
 * Returns verified claims or null if invalid/expired.
 */
export async function verifyIdToken(token: string): Promise<VerifiedClaims | null> {
  try {
    const env = typeof import.meta !== 'undefined' && import.meta.env
      ? import.meta.env
      : process.env;

    const region = env.PUBLIC_COGNITO_REGION;
    const userPoolId = env.PUBLIC_COGNITO_USER_POOL_ID;
    const clientId = env.PUBLIC_COGNITO_APP_CLIENT_ID;

    const issuer = `https://cognito-idp.${region}.amazonaws.com/${userPoolId}`;

    const { payload } = await jose.jwtVerify(token, getJwks(), {
      issuer,
      audience: clientId,
    });

    return {
      uid: payload.sub ?? '',
      email: (payload.email as string) ?? null,
      username: (payload['cognito:username'] as string) ?? null,
    };
  } catch {
    return null;
  }
}
