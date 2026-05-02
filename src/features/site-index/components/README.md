# src/features/site-index/components

## Purpose

`src/features/site-index/components/` contains the category, brand, and index
page composition pieces used by the site-index feature.

## Public API (The Contract)

- Index/brand page building blocks such as `SiteIndexPage.astro`,
  `IndexDashboard.astro`, `IndexBody.astro`, `BrandDashboard.astro`,
  `BrandBody.astro`, `FeedItem.astro`, `FilterDropdown.astro`, and supporting
  hero/sidebar/card components.

## Dependencies

Allowed imports:

- `@core/*`
- `@shared/*`
- Public modules from `@features/*`
- Astro runtime APIs

## Mutation Boundaries

- Render-only apart from local UI interaction.

## Domain Invariants

- Site-index components compose routing/content data but do not redefine slug,
  category, or SEO contracts.
