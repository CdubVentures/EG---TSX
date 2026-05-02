# src/features/home/components

## Purpose

`src/features/home/components/` contains the home-page dashboards, hero cards,
feeds, slideshow, and category-driven merchandising blocks.

## Public API (The Contract)

- Home/dashboard entrypoints such as `Dashboard.astro`, `HomeHero.astro`,
  `HomeSlideshow.astro`, `FeaturedPanel.astro`, `LatestNews.astro`,
  `NewsFeed.astro`, `TopProducts.astro`, and their supporting card/scroller
  components.

## Dependencies

Allowed imports:

- `@core/*`
- `@shared/*`
- Public modules from `@features/*`
- Astro and React/browser APIs where needed

## Mutation Boundaries

- Render-only apart from local UI interaction.

## Domain Invariants

- Home components compose curated data; canonical content/category rules stay in
  core and config contracts.
