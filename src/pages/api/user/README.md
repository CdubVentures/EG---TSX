# src/pages/api/user

## Purpose

`src/pages/api/user/` contains authenticated user endpoints.

## Public API (The Contract)

- `vault.ts`
  Authenticated vault read/write endpoint.

## Dependencies

Allowed imports:

- `@core/*`
- `@features/auth/server/*`
- `@features/vault/server/*`
- Astro runtime APIs

## Mutation Boundaries

- May read/write the authenticated vault store after cookie-based identity
  validation.

## Domain Invariants

- This boundary must reject unauthenticated requests and preserve rev-based vault
  sync semantics.
