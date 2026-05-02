# src/pages/api/vault

## Purpose

`src/pages/api/vault/` contains vault-support endpoints that are separate from
the main authenticated vault CRUD route.

## Public API (The Contract)

- `thumbs.ts`
  Thumbnail-resolution endpoint for vault items.

## Dependencies

Allowed imports:

- `@core/*`
- `@features/vault/server/*`
- Astro runtime APIs

## Mutation Boundaries

- Read-only endpoint; resolves canonical thumbnail data from product content.

## Domain Invariants

- Thumbnail resolution must derive from canonical product media, not ad hoc UI
  metadata.
