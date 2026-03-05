# Home Feature Domain

## Boundary

Page-level orchestration for the home page (`/`). Components compose shared UI
primitives and core data to build the landing experience.

## Public API

No exported modules — all components are consumed exclusively by `src/pages/index.astro`.

## Components

| Component | Purpose | Status |
|-----------|---------|--------|
| `HomeHero.astro` | h1, subtitle with product count, 6 stat buttons | Done (Phase 4.3) |
| `TopProducts.astro` | Section divider, slideshow, category dropdown, tools sidebar shell | Done (Phase 4.3) |
| `HomeSlideshow.astro` | Full product carousel (Embla) — top products by score | Done |
| `CategoryDropdown` | React island — category filter for slideshow | Done |
| Dashboard | News, featured, games, scrollers | Not started (Phase 4.4+) |

## Data Dependencies

- `getProducts()` from `@core/products` — filtered by active categories (count + slideshow data)
- `getArticles()` from `@core/content` — filtered article collections for dashboard (news, reviews, guides, games)
- `CONFIG.categories` — dropdown category list, hub links

## Dependencies

- `@shared/ui/AnnouncementBar.astro` — top promo strip
- `@shared/ui/SectionDivider.astro` — heading + subtitle + actions
- `@core/config` — category IDs, site name, plural()
- `@core/products` — product gateway (never raw `getCollection('dataProducts')`)
- `@core/content` — content gateway (never raw `getCollection('reviews'|'guides'|...)`)
- `@core/categories` — color derivation for category UI
- `@core/media` — carousel image resolution

## Out of Scope

- Tools sidebar content (shell only — config deferred to hub page build)
- Dashboard section and everything below the hero area
- Ad slot content (empty structural shell)
