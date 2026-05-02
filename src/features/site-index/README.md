# src/features/site-index

## Purpose

Owns the shared builders, structured data, and UI components for article and
brand index routes such as `/reviews/`, `/guides/`, `/news/`, and `/brands/`.

## Public API (The Contract)

- `page-builder.ts`
  Exports `buildSiteIndexStaticPaths()`, `buildSiteIndexPageVm()`,
  and `enrichReviewItemsWithScores()`.
- `build-pagination.ts`
  Exports `buildPagination()`.
- `structured-data.ts`
  Exports `buildSiteIndexStructuredData()`.
- `select-dashboard.ts`
  Exports `selectDashboard()`.
- `brand-helpers.ts`
  Exports `packBrand()` and `brandLogoSrcSet()`.
- `select-brand-dashboard.ts`
  Exports `selectBrandDashboard()`.
- `brand-page-builder.ts`
  Exports `buildBrandStaticPaths()` and `buildBrandBleedVm()`.
- `definitions.ts`
  Exports `reviewsIndexDefinition`, `guidesIndexDefinition`,
  `newsIndexDefinition`, `getBrandStaticPaths()`, and `buildBrandPageVm()`.
- `brand-types.ts`
  Exports brand index view-model types.
- `components/`
  Exports the route-facing Astro components used by the four site-index pages.

## Dependencies

Allowed imports:

- `@core/*`
- `@shared/*`
- `@features/home/featured-scroller-utils`
- `@features/ads/components/AdSlot.astro`

Forbidden imports:

- Other feature internals
- Direct route/page mutations

## Mutation Boundaries

- Read-only feature.
- May build view models and structured data for route files.
- Must not write storage, files, or remote state.

## Domain Invariants

- Route files stay thin; index composition logic belongs in this feature.
- Brand index behavior stays separate from article-index behavior where the
  contracts differ.
- Pagination and structured data are shared builders, not ad hoc route logic.

## Local Sub-Boundaries

- [components/README.md](components/README.md)
- [tests/README.md](tests/README.md)
