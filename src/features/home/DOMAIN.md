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
| `TopProducts.astro` | Section divider, slideshow placeholder, tools sidebar shell | Done (Phase 4.3) |
| Dashboard | News, featured, games, scrollers | Not started (Phase 4.4+) |

## Data Dependencies

- `dataProducts` collection — count only (passed as `productCount` prop)
- `CONFIG.categories` — dropdown category list

## Dependencies

- `@shared/ui/AnnouncementBar.astro` — top promo strip
- `@shared/ui/SectionDivider.astro` — heading + subtitle + actions
- `@core/config` — category IDs, site name
- `astro:content` — `getCollection('dataProducts')`

## Out of Scope

- Slideshow carousel internals (placeholder only)
- Tools sidebar content (shell only — config deferred to hub page build)
- Dashboard section and everything below the hero area
- Category dropdown JS (CSS hover works for desktop)
- Ad slot content (empty structural shell)
