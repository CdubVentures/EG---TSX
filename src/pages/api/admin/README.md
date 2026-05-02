# src/pages/api/admin

## Purpose

`src/pages/api/admin/` contains admin-only database setup and sync endpoints.

## Public API (The Contract)

- `db-setup.ts`
  Admin database bootstrap endpoint.
- `db-sync.ts`
  Admin product/article sync endpoint.

## Dependencies

Allowed imports:

- `@core/*`
- Astro runtime APIs

## Mutation Boundaries

- May mutate the search database after explicit admin-token validation.

## Domain Invariants

- Admin routes stay `prerender = false` and must require the documented admin
  token before mutation.
