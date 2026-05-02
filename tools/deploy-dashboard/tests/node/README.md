# tools/deploy-dashboard/tests/node

## Purpose

`tools/deploy-dashboard/tests/node/` covers the TypeScript helper and client-side
state modules used by the deploy dashboard.

## Public API (The Contract)

- `cdn-path-status.test.ts`
- `publish-cdn-plan.test.ts`
- `queued-cdn-state.test.ts`
- `site-stage-progress.test.ts`

## Dependencies

Allowed imports:

- Public modules under `../../ui/*`
- Node test APIs

## Mutation Boundaries

- Tests use isolated fixtures and mocks only.

## Domain Invariants

- Node tests in this folder validate local dashboard helper logic, not live
  deployment effects.
