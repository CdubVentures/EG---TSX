# src/core/routing

## Purpose

`src/core/routing/` owns stable slug normalization and route-segment helpers used
across content, pages, and operator scripts.

## Public API (The Contract)

- `slugs.ts`
  Exports `fileNameToSlug()`, `productToSlug()`, `toSlug()`,
  `brandNameToSlug()`, and `gameNameToSlug()`.

## Dependencies

Allowed imports:

- TypeScript/Node standard library APIs

Forbidden imports:

- `@features/*`
- `@shared/*`
- `src/pages/*`

## Mutation Boundaries

- Read-only. This boundary computes strings only.

## Domain Invariants

- Slug generation must be deterministic for identical input.
- Helpers here normalize names and paths but do not decide route ownership or
  page composition.
