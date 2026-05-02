# src/pages/brands

## Purpose

`src/pages/brands/` owns brand landing-page route entrypoints.

## Public API (The Contract)

- `[...slug].astro`
  Brand route renderer.

## Dependencies

Allowed imports:

- `@core/*`
- `@shared/*`
- Public feature modules for brand/index composition
- Astro runtime APIs

## Mutation Boundaries

- Read-only route rendering.

## Domain Invariants

- Brand routing must stay aligned with the canonical slug/content helpers.
