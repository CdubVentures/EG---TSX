# Config Interdependency Matrix

Status: current-state audit
Audited: 2026-03-11
Updated: 2026-03-11 — nine-panel mega-app wording, cache/CDN independence, cross-panel pseudo-keys
Scope:
- `config/data/*.json`
- manager-written frontmatter in `src/content/**`
- product JSON in `src/content/data-products/**`
- build/runtime consumers in `src/**`

This document is not a design ideal. It maps the repo as it works today, from
top-level ownership down into the places where config and content state
intertwine.

## Top-down map

```text
categories.json
  -> src/core/category-contract.ts
    -> src/core/config.ts
      -> products gateway
      -> content gateway
      -> hub tools gateway
      -> GlobalNav hubs menu
      -> MainLayout/category color CSS
      -> image defaults consumers (category-scoped)
      -> config tool accent/colors

content frontmatter (publish, draft, category, categories, navbar, hero, title, dates, etc.)
  -> src/content.config.ts validation
  -> src/core/content.ts / content-filter.mjs
    -> index/home sections
    -> article pages
    -> GlobalNav guides/brands/games
  -> Navbar panel (eg-config.pyw) writes `categories` + `navbar`
  -> Content panel (eg-config.pyw) reads publish/draft/category/hero/date state

product JSON (category, media, overall, release_date, imagePath, etc.)
  -> src/content.config.ts validation
  -> src/core/products.ts
    -> hubs
    -> slideshow
    -> search
    -> vault thumbs
  -> Slideshow panel (eg-config.pyw) reads raw product data
  -> Image Defaults panel (eg-config.pyw) scans media view usage

secondary config files
  -> navbar-guide-sections.json -> GlobalNav guide section order
  -> content.json -> dashboard slots, pins, badges, exclusions
  -> hub-tools.json -> tool inventory for home/hubs/mobile/nav tooltips
  -> slideshow.json -> home slideshow queue
  -> image-defaults.json -> product image fallback chains and object-fit labels
  -> ads-registry.json -> ad positions and global ad behavior
  -> inline-ads-config.json -> per-collection inline ad cadence
  -> direct-sponsors.json -> edited by Ads Manager, not currently used by runtime
```

## Ownership matrix

| Layer | Surface | Canonical owner today | Edited by | Read by | Depends on | Current note |
|---|---|---|---|---|---|---|
| 0 | `config/data/categories.json` | Category identity, route flags, collection capability, site colors | `Categories panel (eg-config.pyw)`, manual edits | `src/core/category-contract.ts`, all managers that read colors/accent, `MainLayout.astro` via core, nav/hub/content/product flows via core | none | True root config for categories |
| 0 | content frontmatter in `src/content/**` | Article/game/brand truth: `publish`, `draft`, `category`, `categories`, `navbar`, dates, hero, labels | manual content edits, `Navbar panel (eg-config.pyw)` writes `categories` + `navbar` | `src/content.config.ts`, `src/core/content.ts`, `GlobalNav.astro`, article pages, `Content panel (eg-config.pyw)` | category IDs and collection rules from `categories.json` | First-class config-like source, not just content |
| 0 | product JSON in `src/content/data-products/**` | Product truth: category, media, overall, image path, release date | manual/product pipeline edits | `src/content.config.ts`, `src/core/products.ts`, slideshow/search/vault/media | category IDs and collection rules from `categories.json`; image fallback behavior from `image-defaults.json` | First-class config-like source, not just data |
| 1 | `config/data/navbar-guide-sections.json` | Ordered guide sections per category for navbar | `Navbar panel (eg-config.pyw)` | `GlobalNav.astro` | guide frontmatter `navbar` arrays, category IDs from `categories.json` | Separate from guide membership itself |
| 1 | `config/data/content.json` | Home editorial overlay + index hero overrides | `Content panel` (slots/pins/badges/excluded), `Index Heroes panel` (indexHeroes) | `src/core/dashboard.ts`, home page, review/guide/news/brands index pages via `pinnedSet`/`badgesMap`/`indexHeroes` | content entries existing under `{collection}:{id}` keys; brand slugs for indexHeroes.brands | Shared ownership — both panels use `existing.update()` merge pattern to preserve each other's data on save |
| 1 | `config/data/hub-tools.json` | Hub tool inventory keyed by category | `Hub Tools panel (eg-config.pyw)` | `src/core/hub-tools.ts` | category IDs/activation from `categories.json` | Runtime filters stale keys out if category is inactive |
| 1 | `config/data/slideshow.json` | Home slideshow queue and max size | `Slideshow panel (eg-config.pyw)` | `HomeSlideshow.astro` | product entry IDs from product JSON; effective visibility from `getProducts()` | Queue can hold items later hidden by product gateway |
| 1 | `config/data/image-defaults.json` | Global and per-category image fallback rules | `Image Defaults panel (eg-config.pyw)` | `src/core/config.ts`, `src/core/images.ts`, `src/core/media.ts`, slideshow/search/vault | real media view names in product JSON; categories for per-category overrides | Contract is good, but only as correct as scanned media |
| 1 | `config/data/ads-registry.json` | Ad positions and global ad behavior | `Ads panel (eg-config.pyw)` | `src/features/ads/config.ts`, `AdSlot.astro`, `bootstrap.ts` | none | Runtime ad source of truth today |
| 1 | `config/data/inline-ads-config.json` | Inline ad cadence per collection | `Ads panel (eg-config.pyw)` | `src/features/ads/inline/config.ts`, `rehype-inline-ads.ts` | collection names; default ad position in `ads-registry.json` | Build-time only |
| 1 | `config/data/direct-sponsors.json` | Direct sponsor creative inventory | `Ads panel (eg-config.pyw)` | Ads Manager only | placement names conceptually | Not currently wired into site runtime |
| 2 | `config/media/sample-ads/*` | Sample SVG creatives for dev/sample ad rendering | manual asset edits | `src/features/ads/sample-images.ts`, `AdSlot.astro` | ad slot sizes from `ads-registry.json` | Asset config, not JSON, but part of ads pipeline |

## Intertwine matrix

| Upstream source | Downstream source or surface | How they intertwine | What goes stale when they diverge |
|---|---|---|---|
| `categories.json` | content frontmatter validation | `src/content.config.ts` derives allowed `category` enums from `src/core/category-contract.ts` | frontmatter can become invalid or hidden if category capability changes |
| `categories.json` | product JSON validation | `dataProducts` collection enum is derived from category contract | product files can validate-fail or be silently filtered from runtime if category contract changes |
| `categories.json` | `src/core/content.ts` | active content categories gate all article-like content | article exists on disk but vanishes site-wide when category disabled |
| `categories.json` | `src/core/products.ts` | active product categories gate all products | product exists on disk but vanishes from hubs/slideshow/search/vault |
| `categories.json` | `src/core/hub-tools.ts` | tool rows in `hub-tools.json` are filtered by active product categories | stale tool entries remain in JSON but disappear at runtime |
| `categories.json` | `GlobalNav.astro` hubs menu | hubs menu is driven from `CONFIG.categories` | navbar hubs state changes without touching navbar manager data |
| `categories.json` | `GlobalNav.astro` guides/brands/games | navbar content is filtered through `filterNavbarEntries(..., CONFIG.contentCategories)` | a guide can still have `navbar` assigned in frontmatter but be hidden because category is off |
| `categories.json` | `Content panel (eg-config.pyw)` | manager dims content whose category is inactive | GUI can show an article as editorially present but category-disabled |
| `categories.json` | all mega-app panels | panels subscribe to `CATEGORIES` and update live via `store.preview()` | UI chrome updates instantly; semantic state (active flags, colors) propagates before save |
| content frontmatter `publish`/`draft` | `src/core/content.ts` and `GlobalNav.astro` | shared visibility filter removes drafts/unpublished entries | safe at runtime, but editor-assigned navbar state can still persist invisibly |
| content frontmatter `navbar` (guides) | `navbar-guide-sections.json` + `GlobalNav.astro` | guide membership is stored on each guide, but section order lives in JSON | section JSON and guide assignments can be individually valid yet semantically misaligned |
| content frontmatter `categories`+`navbar` (brands) | `Navbar panel (eg-config.pyw)` + `GlobalNav.astro` | `categories` controls index page membership, `navbar` controls nav mega-menu display. Manager writes both fields via `write_list_field()`. Checkbox UI toggles `navbar` independently | manager can assign hidden/draft/unpublished entries because it does not gate by runtime visibility |
| content frontmatter `navbar` (guides/games) | `Navbar panel (eg-config.pyw)` | manager writes `navbar` directly to frontmatter | manager can assign hidden/draft/unpublished entries because it does not gate by runtime visibility |
| content frontmatter `hero` | `content.json` dashboard overlay | dashboard and home featured sections require hero-capable entries | an article can be pinned or slotted in `content.json` but fail dashboard eligibility if no hero path resolves |
| content frontmatter dates | `content.json` pins/badges overlay | home and article sidebars sort using content plus overlay | editorial pin order can fight publication chronology in ways not visible in raw frontmatter |
| product JSON `category` | `slideshow.json` | slideshow queue stores product entry IDs, but final slide set is built from `getProducts()` | queue can contain disabled-category products that silently drop from the slideshow |
| product JSON `overall` + media | `Slideshow panel (eg-config.pyw)` | manager eligibility is `overall > 0` and image count > 0 | queue editor can see products unavailable for other reasons, like category deactivation |
| product JSON media views | `image-defaults.json` | fallback chains only work if configured view names exist in product media | broken or suboptimal fallback behavior when view names drift |
| `content.json` | home dashboard | `buildDashboard()` uses slots, pinned, badges, excluded | dashboard reflects overlay correctly |
| `content.json` indexHeroes | index hero dashboards | `selectDashboard()` / `selectBrandDashboard()` use overrides as highest priority | hero sections on /reviews, /news, /guides, /brands reflect editorial picks |
| content frontmatter `categories` (brands) | Index Heroes brand hero preview | brand category membership determines dashboard eligibility | Navbar panel broadcasts via `brand_categories` pseudo-key; Index Heroes merges overrides on brand reload |
| `content.json` pins/badges/excluded | Index Heroes hero preview | hero algorithm uses pinned set; pool displays badges/pins | Content panel broadcasts via `content_editorial` pseudo-key; Index Heroes syncs immediately |
| `content.json` | home featured reviews/guides/news/games | home page reuses `pinnedSet` and `badgesMap`, but not `excluded` | GUI "publish" toggle is not a full publication toggle for runtime home sections |
| `content.json` | article pages (`reviews`, `guides`, `news`) | article pages import `pinnedSet` and `badgesMap` for related cards | pin/badge overlay is broader than dashboard, but exclusions are not |
| `hub-tools.json` | categories/product activation | tool inventory persists per category, runtime hides disabled categories | stale tools survive in config even when category is not shippable |
| `navbar-guide-sections.json` | `categories.json` | section order file is keyed by category IDs from categories config | removed/renamed categories can leave orphan section definitions |
| `ads-registry.json` | `inline-ads-config.json` | inline defaults reference placement names defined in the registry | bad default position names can break inline ad insertion semantics |
| `ads-registry.json` | `AdSlot.astro` / `bootstrap.ts` | live runtime ad behavior comes from registry only | direct ad behavior ignores `direct-sponsors.json` today |
| `direct-sponsors.json` | runtime direct ads | no current runtime reader | creatives can be edited without ever affecting the site |

## Mega-app live sync (implemented)

The previous standalone `.pyw` managers have been consolidated into a single
nine-panel mega-app (`config/eg-config.pyw`) with a shared `ConfigStore`
reactive layer.
This eliminates the primary in-GUI staleness vector: panels that read stale
data because another panel changed the same upstream file.

### How it works

**ConfigStore.preview(key, data)** updates in-memory state and fires all
subscribers WITHOUT writing to disk. The Categories panel calls `preview()`
on every change (color pick, toggle, label edit). The rest of the created
panels can then refresh their visible chrome or category-derived UI without
waiting for a disk write.

**Global save (Ctrl+S)** iterates ALL panels and saves every dirty one. This
means a single save writes `categories.json` + `hub-tools.json` +
`slideshow.json` + any other changed configs atomically. No more saving one
tool and forgetting to re-open another.

**Global unsaved badge** shows dirty state across ALL panels, not just the
active one. The user always knows if any panel has pending changes.

### What this fixes

| Previous problem | How mega-app fixes it |
|-----------------|----------------------|
| Category color changed in cat-manager, other tools show old colors until relaunch | `preview()` fires `_on_categories_change()` on all panels instantly |
| Category toggle changed, hub-tools/content/slideshow still filter by old flags | `preview()` updates `active_product_cats`/`active_content_cats` derived state |
| Saved categories but forgot to re-save hub-tools | Global save writes all dirty panels |
| No visibility into which tools have unsaved changes | Global badge: "unsaved: 3 panels" |
| Tools read `categories.json` at import time (module-level constants) | All panels read from shared `ConfigStore` instance at runtime |

### Cross-panel pseudo-keys (live propagation without disk)

Beyond `preview()`, panels can broadcast unsaved state changes via pseudo-keys —
arbitrary string keys on the ConfigStore subscriber system that have no file backing.

| Pseudo-key | Publisher | Subscriber | What it carries |
|---|---|---|---|
| `"brand_categories"` | Navbar panel (brand drag/drop, Delete key) | Index Heroes panel | Brand category assignment changes. Store holds `brand_categories: {slug: [cats]}` in-memory dict. Cleared on save and external refresh. |
| `"content_editorial"` | Content panel (pin/badge/exclude toggles) | Index Heroes panel | Pin/badge/excluded changes. No dict on store — subscriber reads Content panel's `_pinned`/`_badges`/`_excluded` attrs directly. |

Flow for `brand_categories`:
1. Navbar panel edits brand category → writes `store.brand_categories[slug] = [cats]`
2. Calls `store.notify("brand_categories")`
3. Index Heroes' `_on_brand_categories_change()` fires → `_reload_brands()` merges overrides on top of disk data → brand hero preview updates

Flow for `content_editorial`:
1. Content panel toggles pin/badge/exclude → updates `_pinned`/`_badges`/`_excluded` in memory
2. Calls `store.notify("content_editorial")`
3. Index Heroes' `_on_content_editorial()` fires → reads Content panel's live in-memory state → hero preview updates

Both pseudo-keys provide **immediate** propagation. The older `_on_tab_change()` mechanism (sync on panel switch) remains as a fallback for the initial panel-creation case.

### What this does NOT fix (runtime drift)

The mega-app solves **in-GUI staleness** — all panels see the same state while
the GUI is open. It does NOT solve **runtime drift** — the gap between what the
GUI configures and what the Astro build actually renders. Those issues (listed
below as "current drift findings") require build-time validation, not GUI-level
propagation.

## Current drift findings

### 1. `content.json` "publish" is not the same as article publication

`Content panel (eg-config.pyw)` exposes a publish toggle, but it writes to
`content.json.excluded`, not to article frontmatter `publish`.

Current result:
- home dashboard respects `excluded`
- home featured reviews/guides/news/games do not read `excluded`
- navbar does not read `excluded`
- collection pages and article pages do not use `excluded` for visibility

So the manager currently controls an editorial home-page overlay, not true
publication state.

### 2. Navbar assignments can be valid in frontmatter but still be invisible

`Navbar panel (eg-config.pyw)` reads and writes `navbar` assignments directly in
frontmatter, but it does not gate those entries on:
- `publish`
- `draft`
- category activation from `categories.json`

Runtime navbar rendering is safer because `GlobalNav.astro` filters through
`filterNavbarEntries()`, but that means hidden stale assignments can accumulate
in frontmatter and only appear later when another state flips.

### 3. Slideshow queue and runtime slideshow do not use the same eligibility path

`Slideshow panel (eg-config.pyw)` scans raw product JSON and accepts products with:
- numeric `overall > 0`
- at least one media image

`HomeSlideshow.astro` later builds the actual queue from `getProducts()`, which
also applies active product category gating from `categories.json`.

Current result:
- queued products can disappear silently if their category is disabled
- missing IDs are skipped silently
- if all configured entries fail, runtime falls back to the algorithmic slideshow

### 4. `direct-sponsors.json` is not wired into runtime direct ads

`Ads panel (eg-config.pyw)` edits `direct-sponsors.json`, but runtime direct ads mount from
`AD_POSITIONS[position]` in:
- `src/features/ads/config.ts`
- `src/features/ads/bootstrap.ts`

That runtime path uses `img`, `href`, `width`, and `height` from
`ads-registry.json`, not from `direct-sponsors.json`.

Current result:
- sponsor creative edits can be saved successfully
- the site can ignore them entirely

### 5. `navbar-guide-sections.json` and guide frontmatter are a split ownership model

Guide section order is stored in JSON, while guide membership is stored in each
guide's `navbar` frontmatter field.

That split is workable, but it means guide-nav state is never truly in one
place. The manager has to keep both synchronized.

### 6. `hub-tools.json` and `categories.json` are intentionally loosely coupled

This one is mostly safe:
- `hub-tools.json` owns tool inventory
- `categories.json` owns category activation
- runtime filters tools by active categories

The tradeoff is silent hiding: stale tool definitions can live forever for a
disabled category because runtime simply filters them out.
