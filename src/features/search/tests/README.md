# src/features/search/tests

## Purpose

`src/features/search/tests/` verifies search API responses, image resolution,
and indexation behavior.

## Public API (The Contract)

- `search-api.test.mjs`
- `search-route-images.test.mjs`
- `search-route-indexation.test.mjs`

## Dependencies

Allowed imports:

- Public search feature modules and documented API contracts
- Node test APIs

## Mutation Boundaries

- Tests use fixtures and mocks only.

## Domain Invariants

- Search tests protect both relevance plumbing and SEO/noindex behavior.
