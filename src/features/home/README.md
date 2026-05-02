# src/features/home

## Purpose

Owns the landing-page composition for `/`, including the hero, slideshow,
dashboard, scrollers, and latest-news sections rendered by `src/pages/index.astro`.

## Public API (The Contract)

- Page-only components consumed by `src/pages/index.astro`:
  `HomeHero.astro`, `TopProducts.astro`, `HomeSlideshow.astro`,
  `Dashboard.astro`, `DashboardHeroCard.astro`, `DashboardCard.astro`,
  `DashboardLargeTile.astro`, `NewsFeed.astro`, `GamesScroller.astro`,
  `FeaturedScroller.astro`, `FeaturedPanel.astro`, `LatestNews.astro`,
  and `CategoryDropdown.tsx`.
- Utilities:
  `featured-scroller-utils.ts`, `latest-news-utils.ts`, `slider-utils.ts`,
  `slideshow-autoplay.ts`, `slideshow-carousel.ts`, and `slideshow-deal.ts`.

## Dependencies

Allowed imports:

- `@core/*`
- `@shared/*`
- `@features/ads/components/AdSlot.astro`
- Astro/React/browser libraries used by the home page

Forbidden imports:

- Other feature internals beyond the documented ad-slot component
- Raw content collection access when a core gateway exists

## Mutation Boundaries

- Read-only feature.
- May read site/config data through core gateways and checked-in JSON imports.
- Must not write files, storage, or remote state.

## Domain Invariants

- `src/pages/index.astro` is the composition root; this folder does not own a
  cross-app public barrel.
- Home data must come from core gateways rather than direct collection calls.
- Slideshow ordering honors the shared slideshow config when present.
- Editorial dashboard and feed ordering preserve pinned-first, then newest-date
  behavior.

## Local Sub-Boundaries

- [components/README.md](components/README.md)
- [tests/README.md](tests/README.md)
