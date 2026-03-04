/** Cookie helpers for auth. */

import type { AstroCookies } from 'astro';

const SESSION_COOKIE = 'eg_session';
const REFRESH_COOKIE = 'eg_refresh';
const HINT_COOKIE = 'eg_hint';
const FIRST_COOKIE = 'eg_first';

const IS_PROD = typeof import.meta !== 'undefined' && import.meta.env
  ? import.meta.env.PROD
  : false;

interface CookieOpts {
  httpOnly: boolean;
  secure: boolean;
  maxAge: number;
}

const SESSION_OPTS: CookieOpts = {
  httpOnly: true,
  secure: IS_PROD,
  maxAge: 60 * 60 * 24 * 30, // 30 days
};

const HINT_OPTS: CookieOpts = {
  httpOnly: false,
  secure: IS_PROD,
  maxAge: 60 * 60 * 24 * 30,
};

/** Build a raw Set-Cookie header value. */
function buildSetCookie(name: string, value: string, opts: CookieOpts): string {
  let s = `${name}=${encodeURIComponent(value)}; Path=/; SameSite=Lax; Max-Age=${opts.maxAge}`;
  if (opts.httpOnly) s += '; HttpOnly';
  if (opts.secure) s += '; Secure';
  return s;
}

/** Build a Set-Cookie header that expires a cookie. */
function buildDeleteCookie(name: string): string {
  return `${name}=; Path=/; Max-Age=0`;
}

/**
 * Returns raw Set-Cookie header strings for all auth cookies.
 * Use with Response headers directly — avoids Astro cookies.set() issues.
 */
export function buildAuthCookieHeaders(
  opts: { idToken: string; refreshToken: string; isFirstSignup?: boolean }
): string[] {
  const headers = [
    buildSetCookie(SESSION_COOKIE, opts.idToken, SESSION_OPTS),
    buildSetCookie(REFRESH_COOKIE, opts.refreshToken, SESSION_OPTS),
    buildSetCookie(HINT_COOKIE, '1', HINT_OPTS),
  ];
  if (opts.isFirstSignup) {
    headers.push(buildSetCookie(FIRST_COOKIE, '1', { ...HINT_OPTS, maxAge: 60 * 5 }));
  }
  return headers;
}

/** Returns raw Set-Cookie headers that clear all auth cookies. */
export function buildClearCookieHeaders(): string[] {
  return [
    buildDeleteCookie(SESSION_COOKIE),
    buildDeleteCookie(REFRESH_COOKIE),
    buildDeleteCookie(HINT_COOKIE),
    buildDeleteCookie(FIRST_COOKIE),
  ];
}

/** Set all auth cookies via Astro's API (for middleware/non-callback routes). */
export function setAuthCookies(
  cookies: AstroCookies,
  opts: { idToken: string; refreshToken: string; isFirstSignup?: boolean }
): void {
  cookies.set(SESSION_COOKIE, opts.idToken, { path: '/', httpOnly: true, secure: IS_PROD, sameSite: 'lax', maxAge: SESSION_OPTS.maxAge });
  cookies.set(REFRESH_COOKIE, opts.refreshToken, { path: '/', httpOnly: true, secure: IS_PROD, sameSite: 'lax', maxAge: SESSION_OPTS.maxAge });
  cookies.set(HINT_COOKIE, '1', { path: '/', httpOnly: false, secure: IS_PROD, sameSite: 'lax', maxAge: HINT_OPTS.maxAge });
  if (opts.isFirstSignup) {
    cookies.set(FIRST_COOKIE, '1', { path: '/', httpOnly: false, secure: IS_PROD, sameSite: 'lax', maxAge: 60 * 5 });
  }
}

/** Clear all auth cookies via Astro's API. */
export function clearAuthCookies(cookies: AstroCookies): void {
  const expired = { path: '/', maxAge: 0 };
  cookies.set(SESSION_COOKIE, '', expired);
  cookies.set(REFRESH_COOKIE, '', expired);
  cookies.set(HINT_COOKIE, '', expired);
  cookies.set(FIRST_COOKIE, '', expired);
}

/** Read the session JWT from HttpOnly cookie. */
export function readSessionToken(cookies: AstroCookies): string | undefined {
  return cookies.get(SESSION_COOKIE)?.value;
}

/** Read the refresh token from HttpOnly cookie. */
export function readRefreshToken(cookies: AstroCookies): string | undefined {
  return cookies.get(REFRESH_COOKIE)?.value;
}

const PKCE_COOKIE = 'eg_pkce';

/** Build a raw Set-Cookie header for the PKCE verifier. */
export function buildPkceCookie(verifier: string, isProd: boolean): string {
  let s = `${PKCE_COOKIE}=${encodeURIComponent(verifier)}; Path=/; SameSite=Lax; Max-Age=300; HttpOnly`;
  if (isProd) s += '; Secure';
  return s;
}

/** Build a Set-Cookie header that clears the PKCE cookie. */
export function buildClearPkceCookie(): string {
  return buildDeleteCookie(PKCE_COOKIE);
}
