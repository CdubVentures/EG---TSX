/** GET /auth/callback — OIDC callback handler. Exchanges code, sets cookies, notifies parent or redirects. */

import type { APIRoute } from 'astro';
import { validateOidcState, validateReturnUrl } from '@features/auth/server/oidc';
import { exchangeCodeForTokens } from '@features/auth/server/token-exchange';
import { verifyIdToken } from '@features/auth/server/jwt';
import { buildAuthCookieHeaders, buildClearPkceCookie } from '@features/auth/server/cookies';
import { readVaultRev } from '@features/vault/server/db';
import { errorPage, escapeHtml } from '@features/auth/server/html';

export const prerender = false;

export const GET: APIRoute = async ({ url, cookies }) => {
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const error = url.searchParams.get('error');

  if (error) return errorPage(`Login error: ${error}`);
  if (!code || !state) return errorPage('Missing authorization parameters.');

  // CSRF validation
  const storedState = cookies.get('eg_nonce')?.value;
  if (!storedState) {
    return errorPage('Security cookie missing — try clearing cookies and logging in again.');
  }
  if (!validateOidcState(state) || state !== storedState) {
    return errorPage('Security validation failed — please try again.');
  }

  // PKCE: read verifier from cookie (optional — gracefully handles in-flight auths without PKCE)
  const codeVerifier = cookies.get('eg_pkce')?.value;

  // Token exchange
  const tokens = await exchangeCodeForTokens(code, codeVerifier || undefined);
  if (!tokens) return errorPage('Token exchange failed — please try again.');

  // JWT verification
  const claims = await verifyIdToken(tokens.id_token);
  if (!claims) return errorPage('Token verification failed — please try again.');

  // First-signup detection: no DynamoDB record → first login → merge guest vault
  let isFirstSignup = false;
  try {
    const rev = await readVaultRev(claims.uid);
    isFirstSignup = rev === 0;
  } catch {
    // DynamoDB unreachable — safer to default to false (no merge, no data loss)
  }

  // Build raw Set-Cookie headers + clear nonce + clear PKCE
  const cookieHeaders = [
    'eg_nonce=; Path=/; Max-Age=0',
    buildClearPkceCookie(),
    ...buildAuthCookieHeaders({
      idToken: tokens.id_token,
      refreshToken: tokens.refresh_token,
      isFirstSignup,
    }),
  ];

  // WHY: detect popup vs mobile by checking eg_return cookie.
  // Mobile sets eg_return before redirecting to Cognito; desktop popup does not.
  const returnUrl = cookies.get('eg_return')?.value;

  if (returnUrl) {
    // Mobile: clear return cookie and 302 to the validated return URL
    cookieHeaders.push('eg_return=; Path=/; Max-Age=0');
    const destination = validateReturnUrl(returnUrl);
    const headers = new Headers({ Location: destination });
    for (const cookie of cookieHeaders) {
      headers.append('Set-Cookie', cookie);
    }
    return new Response(null, { status: 302, headers });
  }

  // Desktop popup: return HTML that notifies parent via postMessage and self-closes
  const origin = url.origin;
  const html = `<!DOCTYPE html>
<html><head><title>Signed In</title></head>
<body>
<script>
try{window.opener&&window.opener.postMessage('eg-auth-done','${escapeHtml(origin)}')}catch(e){}
setTimeout(function(){window.close()},150);
</script>
<p style="font-family:sans-serif;padding:2rem;color:#a3a3a3;">Signed in — you can close this window.</p>
</body></html>`;

  const headers = new Headers({ 'Content-Type': 'text/html' });
  for (const cookie of cookieHeaders) {
    headers.append('Set-Cookie', cookie);
  }
  return new Response(html, { status: 200, headers });
};

