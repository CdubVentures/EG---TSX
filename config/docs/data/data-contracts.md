# Data Contracts

There is no database in the config subsystem. The live canonical stores are repository files.

## Store Classification

| Surface | Classification | Primary writer(s) | Primary reader(s) | Notes |
| --- | --- | --- | --- | --- |
| `config/data/categories.json` | Canonical | Categories panel, React Categories panel via FastAPI | `src/core/category-contract.ts`, `src/core/config.ts`, `src/core/content.ts`, `src/core/products.ts`, layout and nav code | Category IDs, labels, colors, product/content flags, site colors |
| `config/data/content.json` | Canonical, co-owned | Content panel and Index Heroes panel | `src/core/dashboard.ts`, `src/pages/index.astro`, `src/features/site-index/*` | Content owns `slots`, `pinned`, `badges`, `excluded`; Index Heroes owns `indexHeroes` |
| `config/data/hub-tools.json` | Canonical | Hub Tools panel | `src/core/hub-tools.ts`, home and hub surfaces | Includes per-category tool cards and `_index` dashboard grouping |
| `config/data/navbar-guide-sections.json` | Canonical | Navbar panel | `src/shared/layouts/GlobalNav.astro` | Section ordering only; Navbar also writes content frontmatter |
| `config/data/slideshow.json` | Canonical | Slideshow panel | `src/features/home/components/HomeSlideshow.astro` | Ordered queue plus `maxSlides` |
| `config/data/image-defaults.json` | Canonical | Image Defaults panel | `src/core/config.ts`, `src/core/image-defaults-resolver.mjs` | Global defaults plus per-category overrides |
| `config/data/ads-registry.json` | Canonical | Ads panel | `src/features/ads/config.ts` | Global ad settings plus named positions |
| `config/data/inline-ads-config.json` | Canonical | Ads panel | `src/features/ads/inline/config.ts`, `config.mjs` | Per-collection inline cadence settings |
| `config/data/cache-cdn.json` | Canonical | Cache / CDN panel | `src/core/cache-cdn-contract.ts`, `scripts/invalidation-core.mjs`, API handlers | Cache policy definitions, page types, route targets |
| `src/content` frontmatter for guides, brands, games | Canonical for navbar metadata | Navbar panel | Astro content collections, `GlobalNav.astro`, site-index flows | Mutated in place; not mirrored into JSON |
| `.env` `PUBLIC_ADS_ENABLED` | Canonical for ads on/off gate | Ads panel | `src/features/ads/resolve.ts`, `src/features/ads/bootstrap.ts` | Site-level env toggle, current value `false` |
| `public/images/navbar/*.svg` | Read-only dependency | Designer or repo author | Categories UI and site nav | Presence is read, not written |
| `config/data/direct-sponsors.json` | Live editor surface, no verified site runtime reader | Ads panel | No current `src/` import verified | Keep documented, but do not assume a live frontend dependency |

## Shared In-Memory State

These values matter to behavior but are not persisted directly:

| State | Owner | Purpose |
| --- | --- | --- |
| `ConfigStore.site_colors`, `site_accent`, `cat_colors`, `cat_labels`, `cat_ids`, `active_product_cats`, `active_content_cats` | `ConfigStore` | Derived category state rebuilt from `categories.json` |
| `ConfigStore.brand_categories` | Navbar panel via `ConfigStore` | Unsaved brand-category overrides for Index Heroes preview |
| `content_editorial` pseudo channel | Content panel | Unsaved pins, badges, and exclusions for Index Heroes preview |

## Read-Only Data Sources Scanned By The Editor

| Source | Read by | Purpose |
| --- | --- | --- |
| `src/content/reviews`, `guides`, `news` | Categories, Content, Index Heroes, DataCache | Category discovery, article counts, editorial pickers |
| `src/content/data-products` | Categories, Slideshow, Image Defaults, DataCache | Category discovery, product counts, slideshow pool, image view counts |
| `src/content/brands` and `src/content/games` | Navbar, Index Heroes, DataCache | Navbar inclusion and brand hero sources |

## Current Checked-In Snapshot

- `categories.json` currently defines 10 category IDs: `mouse`, `keyboard`, `monitor`, `headset`, `mousepad`, `controller`, `hardware`, `game`, `gpu`, `ai`.
- Product-active categories are currently `mouse`, `keyboard`, and `monitor`.
- `content.json` currently contains manual dashboard overrides for slots `1`, `2`, `5`, `8`, `9`, and `12`.
- `content.json` currently has empty `indexHeroes` maps for `reviews`, `news`, `guides`, and `brands`.
- `hub-tools.json` currently has top-level category entries for `mouse`, `keyboard`, and `monitor`.
- `navbar-guide-sections.json` currently has section ordering only for `mouse`, `keyboard`, and `monitor`.
- `slideshow.json` currently sets `maxSlides` to `10` and contains 9 queued slide IDs.
- `image-defaults.json` currently has a category override only for `mouse`.
- `ads-registry.json` currently defines the positions `sidebar`, `sidebar_sticky`, `in_content`, `hero_leaderboard`, and `hero_companion`.
- `inline-ads-config.json` is enabled for `reviews`, `guides`, and `news`, and disabled for `games`, `brands`, and `pages`.
- `cache-cdn.json` currently defines 8 route targets: `static-pages`, `hub-pages`, `static-assets`, `images`, `search-api`, `auth-and-session`, `user-data`, and `api-fallback`.

## Current Migration And Deprecation Status

- No database migrations exist for this subsystem.
- No secondary store mirrors were found for the JSON contracts above.
- `direct-sponsors.json` is the only audited surface that is still editable but lacks a verified site runtime reader.

## Cross-Links

- [System Map](../architecture/system-map.md)
- [Python Application](../runtime/python-application.md)
- [Routing and GUI](../frontend/routing-and-gui.md)
- [Categories](../panels/categories.md)
- [Content Dashboard](../panels/content-dashboard.md)
- [Navbar](../panels/navbar.md)
- [Ads](../panels/ads.md)

## Validated Against

- `config/lib/config_store.py`
- `config/lib/data_cache.py`
- `config/data/categories.json`
- `config/data/content.json`
- `config/data/hub-tools.json`
- `config/data/navbar-guide-sections.json`
- `config/data/slideshow.json`
- `config/data/image-defaults.json`
- `config/data/ads-registry.json`
- `config/data/inline-ads-config.json`
- `config/data/direct-sponsors.json`
- `config/data/cache-cdn.json`
- `config/panels/navbar.py`
- `config/panels/ads.py`
- `src/core/category-contract.ts`
- `src/core/dashboard.ts`
- `src/core/hub-tools.ts`
- `src/core/config.ts`
- `src/core/cache-cdn-contract.ts`
- `src/features/ads/config.ts`
- `src/features/ads/inline/config.ts`
- `src/shared/layouts/GlobalNav.astro`
- `scripts/invalidation-core.mjs`
