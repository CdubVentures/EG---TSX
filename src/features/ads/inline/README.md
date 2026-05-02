# src/features/ads/inline

## Purpose

`src/features/ads/inline/` owns the inline-ad placement logic used in article
content transforms.

## Public API (The Contract)

- `cadence-engine.{mjs,ts}`
  Placement cadence rules.
- `config.{mjs,ts}`
  Inline ad config readers and normalization.
- `rehype-inline-ads.{mjs,ts}`
  Content transform that injects inline ads.
- `word-counter.{mjs,ts}`
  Article word-count helpers.

## Dependencies

Allowed imports:

- `@core/*`
- Unified/rehype-compatible content tooling
- Public ads feature contracts

## Mutation Boundaries

- May transform in-memory article AST/content only.

## Domain Invariants

- Inline-ad cadence is deterministic for the same config and content.
- This boundary owns transform logic; rendering stays in components.
