/** GET /login/discord — Redirects to Cognito Hosted UI with Discord identity provider. */

import type { APIRoute } from 'astro';
import { buildLoginRedirect } from '@features/auth/server/login-redirect';

export const prerender = false;

export const GET: APIRoute = () =>
  buildLoginRedirect({
    provider: 'Discord',
    isProd: import.meta.env.PROD,
    extraParams: { prompt: 'login' },
  });
