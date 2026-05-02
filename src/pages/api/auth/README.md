# src/pages/api/auth

## Purpose

`src/pages/api/auth/` exposes the auth/session HTTP endpoints used by the client
auth flow.

## Public API (The Contract)

- `me.ts`
- `sign-in.ts`
- `sign-up.ts`
- `confirm-sign-up.ts`
- `forgot-password.ts`
- `confirm-forgot-password.ts`
- `resend-code.ts`

## Dependencies

Allowed imports:

- `@core/*`
- `@features/auth/server/*`
- `@features/vault/server/*` only for the documented first-signup/vault path
- Astro runtime APIs

## Mutation Boundaries

- May call Cognito/OIDC helpers and write auth cookies.

## Domain Invariants

- Identity comes from validated tokens/cookies, never client-declared user data.
- Auth routes stay `prerender = false`.
