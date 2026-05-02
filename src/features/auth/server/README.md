# src/features/auth/server

## Purpose

`src/features/auth/server/` owns the server-side authentication protocol:
Cognito API calls, token exchange, JWT verification, cookies, and OIDC helpers.

## Public API (The Contract)

- `cognito-config.ts`
- `cognito-api.ts`
- `cookies.ts`
- `html.ts`
- `jwt.ts`
- `login-redirect.ts`
- `oidc.ts`
- `refresh.ts`
- `token-exchange.ts`

## Dependencies

Allowed imports:

- `@core/*`
- `jose`
- `zod`
- Node/web crypto and cookie APIs

## Mutation Boundaries

- May call Cognito/OIDC endpoints and write auth cookies.

## Domain Invariants

- PKCE, nonce, and internal-return-path rules must be enforced here.
- User-controlled content rendered into HTML must be escaped.
