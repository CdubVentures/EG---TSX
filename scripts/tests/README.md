# scripts/tests

## Purpose

`scripts/tests/` verifies the root operator scripts without going through the
full site runtime.

## Public API (The Contract)

- Script contract tests for `aws-operator`, `deploy-aws`, `run-astro-build`,
  `invalidation-core`, `validate-image-links`, `validate-seo-sitemap`, and
  related operator entrypoints.

## Dependencies

Allowed imports:

- Public modules from `../`
- `../lib/*`
- Node test APIs and fixtures

## Mutation Boundaries

- Tests may use mocks and temporary fixtures only.

## Domain Invariants

- Script tests validate orchestration contracts, not UI behavior.
