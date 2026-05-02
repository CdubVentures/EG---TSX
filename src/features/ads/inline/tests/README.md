# src/features/ads/inline/tests

## Purpose

`src/features/ads/inline/tests/` locks down inline-ad cadence, config, word
counting, and rehype transform behavior.

## Public API (The Contract)

- `cadence-engine.test.mjs`
- `config.test.mjs`
- `rehype-inline-ads.test.mjs`
- `word-counter.test.mjs`

## Dependencies

Allowed imports:

- Public modules from `../`
- Node test APIs and content fixtures

## Mutation Boundaries

- Tests may use temporary in-memory AST/content fixtures only.

## Domain Invariants

- These tests characterize transform output before inline-ad refactors.
