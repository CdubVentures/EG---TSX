# src/features/ads

## Purpose

Owns ad-slot rendering, sample creative support, inline-ad insertion, and the
shared config/runtime contract for site ad behavior.

## Public API (The Contract)

- `index.ts`
  Exports `AD_POSITIONS`, `ADSENSE_CLIENT`, `AD_LABEL`,
  `SHOW_PRODUCTION_PLACEHOLDERS`, `LOAD_SAMPLE_ADS`, `AdSlotConfig`,
  `AdProvider`, `ParsedSize`, `resolveAd()`, `getAdsenseClient()`,
  `isAdsEnabled()`, `parseSize()`, `parseFirstSize()`, `parseAllSizes()`,
  `parseLargestSize()`, and `parseSmallestSize()`.
- `components/AdSlot.astro`
- `components/InlineAd.astro`
- `bootstrap.ts`
  Client bootstrap mounted by `MainLayout`.
- `inline/`
  Shared inline-ad cadence and rehype plugin modules.
- Sample/dev helpers:
  `sample-assets.ts`, `sample-images.ts`, `sample-slot-plan.ts`,
  and `sample-ad-presentation.ts`.

## Dependencies

Allowed imports:

- `config/data/ads-*.json`
- `.env` values consumed through the documented config contract
- `zod`
- Browser APIs and Astro build hooks

Forbidden imports:

- Other feature internals
- Direct writes to content or runtime data

## Mutation Boundaries

- Read-only against checked-in config and sample media.
- May mount third-party ad scripts in the browser.
- Must not write project files.

## Domain Invariants

- Sample ads are never treated as production live ads.
- Slot and provider behavior flows through the shared config contract.
- `bootstrap.ts` is the only client mount point for live provider hydration.
- Inline-ad insertion must remain deterministic and testable through the
  Node-safe `.mjs` helpers.

## Local Sub-Boundaries

- [components/README.md](components/README.md)
- [inline/README.md](inline/README.md)
- [tests/README.md](tests/README.md)
