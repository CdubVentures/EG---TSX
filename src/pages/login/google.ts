/** GET /login/google — Redirects to Cognito Hosted UI with Google identity provider. */

import type { APIRoute } from 'astro';
import { buildLoginRedirect } from '@features/auth/server/login-redirect';

export const prerender = false;

export const GET: APIRoute = () =>
  buildLoginRedirect({
    provider: 'Google',
    isProd: import.meta.env.PROD,
    extraParams: { prompt: 'select_account' },
  });
