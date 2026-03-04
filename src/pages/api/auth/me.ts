/** GET /api/auth/me — Returns current user from HttpOnly session cookie. */

import type { APIRoute } from 'astro';
import { readSessionToken } from '@features/auth/server/cookies';
import { verifyIdToken } from '@features/auth/server/jwt';

export const prerender = false;

const NO_CACHE = { 'Cache-Control': 'no-store' };

export const GET: APIRoute = async ({ cookies }) => {
  const token = readSessionToken(cookies);
  if (!token) {
    return Response.json({ status: 'guest' }, { headers: NO_CACHE });
  }

  const claims = await verifyIdToken(token);
  if (!claims) {
    return Response.json({ status: 'guest' }, { headers: NO_CACHE });
  }

  return Response.json({
    status: 'authenticated',
    uid: claims.uid,
    email: claims.email,
    username: claims.username,
  }, { headers: NO_CACHE });
};
