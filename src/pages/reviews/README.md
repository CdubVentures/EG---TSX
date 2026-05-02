# src/pages/reviews

## Purpose

`src/pages/reviews/` owns review article route entrypoints.

## Public API (The Contract)

- `[...slug].astro`
  Review route renderer.

## Dependencies

Allowed imports:

- `@core/*`
- `@shared/*`
- Public feature modules used by review pages
- Astro runtime APIs

## Mutation Boundaries

- Read-only route rendering.

## Domain Invariants

- Review routes must resolve content and canonical URLs through shared core
  helpers.
