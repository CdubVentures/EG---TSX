# src/pages/news

## Purpose

`src/pages/news/` owns news article route entrypoints.

## Public API (The Contract)

- `[...slug].astro`
  News route renderer.

## Dependencies

Allowed imports:

- `@core/*`
- `@shared/*`
- Public feature modules used by news pages
- Astro runtime APIs

## Mutation Boundaries

- Read-only route rendering.

## Domain Invariants

- News routes must resolve content and canonical URLs through shared core
  helpers.
