# src/pages/guides

## Purpose

`src/pages/guides/` owns guide article route entrypoints.

## Public API (The Contract)

- `[...slug].astro`
  Guide route renderer.

## Dependencies

Allowed imports:

- `@core/*`
- `@shared/*`
- Public feature modules used by guide pages
- Astro runtime APIs

## Mutation Boundaries

- Read-only route rendering.

## Domain Invariants

- Guide routes must resolve content and canonical URLs through shared core
  helpers.
