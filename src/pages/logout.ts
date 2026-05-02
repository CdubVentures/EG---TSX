/** GET /logout — Clears auth cookies and redirects to Cognito logout. */

import type { APIRoute } from 'astro';
import { withNoIndexHeaders } from '@core/seo/indexation-policy';
import { buildClearCookieHeaders } from '@features/auth/server/cookies';
import { getCognitoConfig } from '@features/auth/server/cognito-config';

export const prerender = false;

export const GET: APIRoute = () => {
  const config = getCognitoConfig();
  const params = new URLSearchParams({
    client_id: config.clientId,
    logout_uri: config.logoutUrl,
  });

  const logoutUrl = `https://${config.domain}/logout?${params.toString()}`;

  const headers = withNoIndexHeaders({ Location: logoutUrl });
  for (const cookie of buildClearCookieHeaders()) {
    headers.append('Set-Cookie', cookie);
  }

  return new Response(null, { status: 302, headers });
};
