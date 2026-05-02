# src/core/tests

## Purpose

`src/core/tests/` covers the shared-kernel contracts for content, images, SEO,
media, and URL generation.

## Public API (The Contract)

- Contract tests for `content-filter`, `images`, `media`, `indexation-policy`,
  `route-graph`, `route-graph-log`, `sitemap-manifest`, and `url-contract`.

## Dependencies

Allowed imports:

- Public modules from `../`
- Node test APIs and checked-in fixtures

## Mutation Boundaries

- Tests are read-only apart from local mocks and temporary fixtures.

## Domain Invariants

- Core tests assert behavior through exported helpers, not private internals.
