# src/features/vault/tests

## Purpose

`src/features/vault/tests/` locks down vault state, routes, schema validation,
sync behavior, thumbnails, and UI toggles.

## Public API (The Contract)

- Root vault feature tests in this folder are the supported vault regression
  suites.

## Dependencies

Allowed imports:

- Public vault modules
- `../server/*` when a test is explicitly exercising a documented server helper
- Node test APIs and fixtures

## Mutation Boundaries

- Tests may use mocks and temporary fixtures only.

## Domain Invariants

- Vault tests preserve the guest/auth sync contract and max-item/category rules.
