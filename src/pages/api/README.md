# src/pages/api

## Purpose

`src/pages/api/` is the server API trust boundary for EG - TSX. It exposes
search, auth/session, vault, and admin endpoints to the browser and operator
tools.

## Public API (The Contract)

- `search.ts`
  `GET /api/search`.
- `auth/me.ts`
  `GET /api/auth/me`.
- `auth/sign-in.ts`, `auth/sign-up.ts`, `auth/confirm-sign-up.ts`,
  `auth/forgot-password.ts`, `auth/confirm-forgot-password.ts`,
  `auth/resend-code.ts`
  Auth mutation endpoints.
- `user/vault.ts`
  `GET` and `PUT /api/user/vault`.
- `vault/thumbs.ts`
  `POST /api/vault/thumbs`.
- `admin/db-setup.ts`, `admin/db-sync.ts`
  Admin-only database setup and sync endpoints.

## Dependencies

Allowed imports:

- `@core/*`
- `@features/auth/server/*`
- `@features/vault/server/*`
- Feature schemas and public server-side types
- Astro runtime APIs

Forbidden imports:

- Client-only UI modules
- `config/app/*`
- `tools/deploy-dashboard/*`

## Mutation Boundaries

- Auth endpoints may call Cognito/OIDC helpers and write auth cookies.
- Vault endpoints may read/write DynamoDB through `@features/vault/server/*`.
- Admin endpoints may mutate the search database.
- Search is read-only apart from logging and response headers.

## Domain Invariants

- Every route in this boundary must stay `prerender = false`.
- Cache and robots/indexation headers come from `@core/cache-cdn-contract` and
  `@core/seo/indexation-policy`, not ad hoc strings.
- Authenticated identity comes from validated cookies or explicit admin tokens,
  never from client-submitted identity fields.

## Local Sub-Boundaries

- [admin/README.md](admin/README.md)
- [auth/README.md](auth/README.md)
- [user/README.md](user/README.md)
- [vault/README.md](vault/README.md)
