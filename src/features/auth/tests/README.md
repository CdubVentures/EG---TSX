# src/features/auth/tests

## Purpose

`src/features/auth/tests/` locks down auth dialog state, auth routes, schemas,
client hydration, and Cognito-server behavior.

## Public API (The Contract)

- Root auth feature tests in this folder are the supported auth regression
  suites.

## Dependencies

Allowed imports:

- Public auth modules from `../`
- `../server/*` when a test is explicitly exercising a documented server helper
- Node test APIs and mocks

## Mutation Boundaries

- Tests may mock Cognito, cookies, and browser state; no live auth mutation.

## Domain Invariants

- Auth tests must preserve the client/server contract split while covering both
  sides of the flow.
