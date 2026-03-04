/** GET /login — Redirects to Cognito Hosted UI for email/password login. */

import type { APIRoute } from 'astro';
import { buildLoginRedirect } from '@features/auth/server/login-redirect';

export const prerender = false;

export const GET: APIRoute = ({ url }) => {
  const screenHint = url.searchParams.get('screen_hint');
  return buildLoginRedirect({
    provider: 'COGNITO',
    isProd: import.meta.env.PROD,
    extraParams: screenHint ? { screen_hint: screenHint } : undefined,
  });
};
