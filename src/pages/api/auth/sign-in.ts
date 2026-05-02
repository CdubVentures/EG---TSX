/** POST /api/auth/sign-in — Email/password sign-in via Cognito User Pool API. */

import type { APIRoute } from 'astro';
import { withCachePolicyHeaders } from '@core/cache-cdn-contract';
import { jsonNoIndex, withNoIndexHeaders } from '@core/seo/indexation-policy';
import { cognitoSignIn } from '@features/auth/server/cognito-api';
import { verifyIdToken } from '@features/auth/server/jwt';
import { buildAuthCookieHeaders } from '@features/auth/server/cookies';
import { readVaultRev } from '@features/vault/server/db';

export const prerender = false;

const NO_CACHE_HEADERS = withCachePolicyHeaders('dynamicApis');

export const POST: APIRoute = async ({ request }) => {
  let body: { email?: string; password?: string };
  try {
    body = await request.json();
  } catch {
    return jsonNoIndex(
      { error: { code: 'InvalidRequest', message: 'Invalid JSON body' } },
      { status: 400, headers: NO_CACHE_HEADERS },
    );
  }

  const { email, password } = body;
  if (!email || !password) {
    return jsonNoIndex(
      { error: { code: 'InvalidRequest', message: 'Email and password are required' } },
      { status: 400, headers: NO_CACHE_HEADERS },
    );
  }

  const signIn = globalThis.__mockCognitoSignIn ?? cognitoSignIn;
  const result = await signIn(email, password);

  if (!result.ok) {
    return jsonNoIndex({ error: result.error }, { status: 400, headers: NO_CACHE_HEADERS });
  }

  const verify = globalThis.__mockVerifyIdToken ?? verifyIdToken;
  const claims = await verify(result.data.idToken);
  if (!claims) {
    return jsonNoIndex(
      { error: { code: 'TokenError', message: 'Token verification failed' } },
      { status: 400, headers: NO_CACHE_HEADERS },
    );
  }

  // First-signup detection
  let isFirstSignup = false;
  try {
    const vaultRev = globalThis.__mockReadVaultRev ?? readVaultRev;
    const rev = await vaultRev(claims.uid);
    isFirstSignup = rev === 0;
  } catch {
    // DynamoDB unreachable — default to false (no merge, no data loss)
  }

  const cookieHeaders = buildAuthCookieHeaders({
    idToken: result.data.idToken,
    refreshToken: result.data.refreshToken,
    isFirstSignup,
  });

  const headers = withNoIndexHeaders(
    withCachePolicyHeaders('dynamicApis', { 'Content-Type': 'application/json' }),
  );
  for (const cookie of cookieHeaders) {
    headers.append('Set-Cookie', cookie);
  }

  return new Response(
    JSON.stringify({
      status: 'authenticated',
      uid: claims.uid,
      email: claims.email,
      username: claims.username,
    }),
    { status: 200, headers },
  );
};
