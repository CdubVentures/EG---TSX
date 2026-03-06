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
| `TopProducts.astro` | Section divider, slideshow, category dropdown, tools sidebar with live hub-tools data | Done (Phase 4.3) |
| `HomeSlideshow.astro` | Full product carousel (Embla) — top products by score | Done |
| `slideshow-carousel.ts` | Client-side carousel logic (Embla init, autoplay, lazy load, vault hydration) | Done |
| `CategoryDropdown` | React island — category filter for slideshow | Done |
| `Dashboard.astro` | Orchestrator: 15-item editorial grid + news sidebar | Done (Phase 4.4) |
| `DashboardHeroCard.astro` | Row 1 hero card (large 16:9 image + content) | Done (Phase 4.4) |
| `DashboardCard.astro` | Rows 2–5 reusable card (variant prop controls sizing) | Done (Phase 4.4) |
| `DashboardLargeTile.astro` | Full-width cinematic tile (slot index 4) | Done (Phase 4.4) |
| `NewsFeed.astro` | Right sidebar: "News Feed" title + 3 news items with thumbnails | Done (Phase 4.4) |

## Data Dependencies

- `getProducts()` from `@core/products` — filtered by active categories (count + slideshow data)
- `getReviews()`, `getGuides()`, `getNews()` from `@core/content` — filtered, date-sorted article collections
- `CONFIG.categories` — dropdown category list, hub links
- `config/data/slideshow.json` — ordered slide list from Slideshow Manager (falls back to algorithmic if empty)

## Dependencies

- `@shared/ui/AnnouncementBar.astro` — top promo strip
- `@shared/ui/SectionDivider.astro` — heading + subtitle + actions
- `@shared/ui/SubSectionDivider.astro` — "Latest Updates" horizontal rule with centered text
- `@core/config` — category IDs, site name, plural(), categoryColor()
- `@core/products` — product gateway (never raw `getCollection('dataProducts')`)
- `@core/content` — content gateway (never raw `getCollection('reviews'|'guides'|...)`)
- `@core/article-helpers` — articleUrl(), resolveHeroImg(), articleSrcSet(), formatArticleDate(), DashboardEntry type
- `@core/hub-tools` — hub tools gateway (`getDesktopTools()`, `getMobileTools()` — never read hub-tools.json directly)
- `@core/categories` — color derivation for category UI
- `@core/media` — carousel image resolution

## Out of Scope

- Sections below the dashboard (games, more scrollers, etc.)
- Badge system (`editors-choice-badge`) and pin system (`pinned-tag`) — future
- Ad slot content (empty structural shell)
