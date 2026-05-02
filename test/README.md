# test

## Purpose

`test/` holds cross-cutting contract, integration, characterization, and smoke
tests that span multiple boundaries in EG - TSX.

## Public API (The Contract)

- Root `*.test.mjs` and `*.characterization.test.mjs` files in this directory
  are the supported repo-wide test entrypoints.
- Typical coverage areas here include core data contracts, build/deploy gates,
  route/SEO validation, config wiring, and cross-feature runtime behavior.

## Dependencies

Allowed imports:

- Public APIs from `src/core/*`, `src/shared/*`, `src/features/*`, and
  `scripts/*`
- Test fixtures and standard Node test APIs

Forbidden imports:

- Private internals when a public contract exists
- Browser-only code paths that cannot run under `node --test`

## Mutation Boundaries

- Tests may create ephemeral in-memory mocks and temporary local fixtures.
- Tests must not mutate canonical content/config state unless they fully own and
  clean up a temporary fixture.

## Domain Invariants

- Root tests stay integration or contract oriented; feature-private unit tests
  belong with the feature.
- New tests here should explain a cross-boundary risk, not act as a junk drawer.
