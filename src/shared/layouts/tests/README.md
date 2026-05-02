# src/shared/layouts/tests

## Purpose

`src/shared/layouts/tests/` verifies shared layout metadata, robots, auth
bootstrap, and nav rendering behavior.

## Public API (The Contract)

- Root shared-layout tests in this folder are the supported layout regression
  suites.

## Dependencies

Allowed imports:

- Public layout modules from `../`
- Node test APIs and fixtures

## Mutation Boundaries

- Tests are read-only apart from mocks and temporary fixtures.

## Domain Invariants

- Layout tests protect the shared shell contract used by every page.
