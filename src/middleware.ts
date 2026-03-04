/** Middleware — Reads HttpOnly cookie on every SSR request, populates Astro.locals.user. Auto-refreshes near-expiry tokens. */

import { defineMiddleware } from 'astro:middleware';
import { readSessionToken, readRefreshToken, setAuthCookies, clearAuthCookies } from '@features/auth/server/cookies';
import { verifyIdToken, getTokenExpiry } from '@features/auth/server/jwt';
import { refreshTokens } from '@features/auth/server/refresh';

const REFRESH_THRESHOLD_SECS = 5 * 60;

export const onRequest = defineMiddleware(async (context, next) => {
  context.locals.user = null;

  // Skip cookie reading on prerendered pages (headers not available during build)
  if (context.isPrerendered) return next();

  const token = readSessionToken(context.cookies);
  if (!token) return next();

  // Check if token is near expiry but NOT already expired
  const exp = getTokenExpiry(token);
  const now = Math.floor(Date.now() / 1000);
  const isExpired = exp !== null && exp <= now;
  const needsRefresh = exp !== null && !isExpired && (exp - now) <= REFRESH_THRESHOLD_SECS;

  if (needsRefresh) {
    const refresh = readRefreshToken(context.cookies);
    if (refresh) {
      const newTokens = await refreshTokens(refresh);
      if (newTokens) {
        // WHY: refresh_token is not returned by Cognito refresh grant — reuse existing
        setAuthCookies(context.cookies, {
          idToken: newTokens.id_token,
          refreshToken: refresh,
        });

        const claims = await verifyIdToken(newTokens.id_token);
        if (claims) {
          context.locals.user = {
            uid: claims.uid,
            email: claims.email,
            username: claims.username,
          };
        }
        return next();
      }

      // WHY: refresh failed but token might still be valid (up to 5 min left).
      // Fall through to normal verification instead of clearing cookies.
    }
  }

  if (isExpired) {
    // Token fully expired — clear stale cookies so client gets a clean guest state
    clearAuthCookies(context.cookies);
    return next();
  }

  // Token valid (or near-expiry with failed refresh) — verify normally
  const claims = await verifyIdToken(token);
  if (claims) {
    context.locals.user = {
      uid: claims.uid,
      email: claims.email,
      username: claims.username,
    };
  }

  return next();
});
