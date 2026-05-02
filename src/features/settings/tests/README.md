# src/features/settings/tests

## Purpose

`src/features/settings/tests/` verifies the settings store contract.

## Public API (The Contract)

- `settings-store.test.mjs`

## Dependencies

Allowed imports:

- Public settings modules
- Node test APIs

## Mutation Boundaries

- Tests use isolated mocks and local state only.

## Domain Invariants

- This suite locks down the settings store as the feature SSOT.
