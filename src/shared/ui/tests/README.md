# src/shared/ui/tests

## Purpose

`src/shared/ui/tests/` covers shared UI markup contracts.

## Public API (The Contract)

- `breadcrumbs-markup.test.mjs`
- `section-divider-markup.test.mjs`

## Dependencies

Allowed imports:

- Public UI modules from `../`
- Node test APIs

## Mutation Boundaries

- Tests are read-only apart from fixtures.

## Domain Invariants

- Shared UI tests protect generic markup contracts used across features.
