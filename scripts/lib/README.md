# scripts/lib

## Purpose

`scripts/lib/` contains helper modules shared by operator scripts.

## Public API (The Contract)

- `seo-io.mjs`
  Exports `routePathFromHtmlFile()`, `collectBuiltHtmlPages()`, and
  `readSitemapUrls()`.

## Dependencies

Allowed imports:

- `src/core/seo/*`
- TypeScript/Node standard library APIs

Forbidden imports:

- `src/shared/*`
- Feature UI or server modules

## Mutation Boundaries

- Read-only. These helpers inspect files and build artifacts.

## Domain Invariants

- Helper modules stay generic to operator flows and should not become alternate
  orchestration roots.
