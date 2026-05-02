/** Shared login redirect builder — DRYs the 3 login endpoints. */

import { withNoIndexHeaders } from '@core/seo/indexation-policy';
import { getCognitoConfig } from './cognito-config';
import { generateOidcState, generatePkceChallenge } from './oidc';
import { buildPkceCookie } from './cookies';

interface LoginRedirectOptions {
  provider: string;
  isProd: boolean;
  extraParams?: Record<string, string>;
}

export function buildLoginRedirect({ provider, isProd, extraParams }: LoginRedirectOptions): Response {
  const config = getCognitoConfig();
  const state = generateOidcState();
  const pkce = generatePkceChallenge();

  const params = new URLSearchParams({
    response_type: 'code',
    client_id: config.clientId,
    redirect_uri: config.callbackUrl,
    scope: 'openid email profile',
    state,
    identity_provider: provider,
    code_challenge: pkce.challenge,
    code_challenge_method: 'S256',
  });

  if (extraParams) {
    for (const [k, v] of Object.entries(extraParams)) {
      params.set(k, v);
    }
  }

  const authorizeUrl = `https://${config.domain}/oauth2/authorize?${params.toString()}`;

  let nonceCookie = `eg_nonce=${encodeURIComponent(state)}; Path=/; SameSite=Lax; Max-Age=300; HttpOnly`;
  if (isProd) nonceCookie += '; Secure';

  const headers = withNoIndexHeaders({ Location: authorizeUrl });
  headers.append('Set-Cookie', nonceCookie);
  headers.append('Set-Cookie', buildPkceCookie(pkce.verifier, isProd));

  return new Response(null, { status: 302, headers });
}
