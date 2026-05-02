# src/features/ads/components

## Purpose

`src/features/ads/components/` contains the feature-owned rendering primitives
for ad slots and inline ad markup.

## Public API (The Contract)

- `AdSlot.astro`
- `InlineAd.astro`

## Dependencies

Allowed imports:

- `@core/*`
- Public modules from `@features/ads/*`
- Astro runtime APIs

## Mutation Boundaries

- Render-only. No filesystem, database, or network writes.

## Domain Invariants

- Ad components render placements decided elsewhere; they do not own ad
  inventory policy.
