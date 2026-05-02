# src/pages/auth

## Purpose

`src/pages/auth/` contains request-time auth callback routes.

## Public API (The Contract)

- `callback.ts`
  OIDC/Cognito callback endpoint.

## Dependencies

Allowed imports:

- `@core/*`
- `@features/auth/*`
- Astro runtime APIs

## Mutation Boundaries

- May complete auth redirects and write session cookies through the documented
  auth server helpers.

## Domain Invariants

- Callback handling must preserve PKCE, nonce, and internal-return-path rules.
