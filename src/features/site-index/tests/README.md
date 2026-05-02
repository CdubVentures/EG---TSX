# src/features/site-index/tests

## Purpose

`src/features/site-index/tests/` covers brand/index page builders, feed markup,
structured data, and routing-related UI behavior.

## Public API (The Contract)

- Root site-index feature tests in this folder are the supported regression
  suites for index and brand surfaces.

## Dependencies

Allowed imports:

- Public site-index modules
- Node test APIs and fixtures

## Mutation Boundaries

- Tests may use isolated fixtures only.

## Domain Invariants

- These tests protect high-surface routing and feed composition behavior.
