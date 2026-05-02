# src/features/ads/tests

## Purpose

`src/features/ads/tests/` verifies ad placement, markup, bootstrap behavior, and
sample asset coverage for the ads feature.

## Public API (The Contract)

- Root ads feature tests under this directory are the supported ads feature test
  entrypoints.

## Dependencies

Allowed imports:

- Public modules from `../`
- Shared/core contracts used by ads

## Mutation Boundaries

- Tests may use fixtures and mocks only.

## Domain Invariants

- Ads tests validate published placement behavior, not private implementation
  details.
