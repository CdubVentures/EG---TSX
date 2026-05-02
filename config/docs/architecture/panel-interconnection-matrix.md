# Panel Interconnection Matrix

> **Authority:** This document is the single source of truth for cross-panel data dependencies, live preview cascading, and watch-polling behavior. Every panel implementation (existing and future) MUST follow these rules.

---

## 1. All 9 Panels — Data Files & Ownership

| #  | Panel          | Config File(s)                      | Store Key(s)                            | Status     |
|----|----------------|-------------------------------------|-----------------------------------------|------------|
| 1  | Categories     | `data/categories.json`              | `categories`                            | Implemented |
| 2  | Content        | `data/content.json` (slots section) | `content`                               | Implemented |
| 3  | Index Heroes   | `data/content.json` (indexHeroes section) | `content` (shared)                 | Implemented |
| 4  | Hub Tools      | `data/hub-tools.json`               | `hub_tools`                             | Implemented |
| 5  | Slideshow      | `data/slideshow.json`               | `slideshow`                             | Implemented |
| 6  | Navbar         | `data/navbar-guide-sections.json` + article frontmatter | `nav_sections`       | Ported    |
| 7  | Image Defaults | `data/image-defaults.json`          | `image_defaults`                        | To port    |
| 8  | Ads            | `data/ads-registry.json` + `data/inline-ads-config.json` + `data/direct-sponsors.json` + `.env` | `ads_registry`, `inline_ads`, `sponsors` | To port |
| 9  | Cache/CDN      | `data/cache-cdn.json`               | `cache_cdn`                             | To port    |

---

## 2. Derived State (rebuilt from categories.json)

The backend `ConfigStore` rebuilds these whenever `CATEGORIES` changes (preview, save, or external edit):

| Derived Field            | Source                          | Consumed By                                                |
|--------------------------|---------------------------------|------------------------------------------------------------|
| `site_colors`            | `siteColors.primary/secondary`  | Shell (accent), all panel status bars                      |
| `site_accent`            | `siteColors.primary`            | Shell gradient, Hub Tools fallback, Slideshow accent bars  |
| `cat_colors`             | `categories[].color`            | Content, Index Heroes, Hub Tools, Navbar, Slideshow, Image Defaults |
| `cat_labels`             | `categories[].label`            | Content, Index Heroes, Hub Tools, Navbar, Slideshow, Image Defaults |
| `cat_ids`                | `categories[].id`               | Hub Tools (category list), Navbar, Image Defaults          |
| `active_product_cats`    | `product.production \|\| vite`  | Hub Tools (which categories show tools)                    |
| `active_content_cats`    | `content.production \|\| vite`  | Content (article eligibility), Index Heroes                |

---

## 3. Cross-Panel Dependency Matrix (All 9 Panels)

### 3a. Full dependency graph

```
CATEGORIES ─────drives──▶ Content         (cat_colors, cat_labels, active_content_cats)
            ├───drives──▶ Index Heroes    (cat_colors, cat_labels, active_content_cats)
            ├───drives──▶ Hub Tools       (categories list, active_product_cats, site_accent)
            ├───drives──▶ Slideshow       (cat_colors, cat_labels, site_accent — UI display)
            ├───drives──▶ Navbar          (cat_ids, cat_labels, cat_colors — mega menu structure)
            └───drives──▶ Image Defaults  (cat_labels, cat_colors — category pill display)

CONTENT    ────drives──▶ Index Heroes    (pinned/badges/excluded, article pool)
           ────shares──▶ Index Heroes    (SAME file: content.json indexHeroes field)

NAVBAR     ────drives──▶ Index Heroes    (brand_categories transient state — preview only)

HUB_TOOLS  ────standalone (no downstream panel dependents)
SLIDESHOW  ────standalone (no downstream panel dependents)
IMAGE_DEF  ────standalone (no downstream panel dependents)
ADS        ────standalone (no downstream panel dependents)
CACHE_CDN  ────standalone (no downstream panel dependents)
```

### 3b. DataCache dependencies (filesystem reads, not config JSON)

| Panel          | DataCache Method              | What It Reads                                  |
|----------------|-------------------------------|------------------------------------------------|
| Content        | (direct frontmatter scan)     | `src/content/{reviews,guides,news,brands,games}/**` |
| Index Heroes   | (direct frontmatter scan)     | Same as Content + brand categories             |
| Hub Tools      | `get_content_only_cats()`     | Filters product-only categories                |
| Slideshow      | `get_products()`              | `src/content/data-products/**/*.json` (366 files) |
| Navbar         | `get_guides/brands/games()`   | `src/content/{guides,brands,games}/**` frontmatter |
| Image Defaults | `get_view_counts()`           | `src/content/data-products/**/*.json` media.images |
| Ads            | (none)                        | Scans `.astro/.ts/.tsx` source for `<AdSlot>` usage |
| Cache/CDN      | (none)                        | —                                              |
| Categories     | `get_category_presence()`     | Checks data-products/ + content/ for category presence |

### 3c. Cascade matrix (what happens when each panel changes)

| When This Changes  | Backend Clears                              | Frontend Must Cascade Refresh To              |
|--------------------|---------------------------------------------|-----------------------------------------------|
| **Categories**     | `_hub_tools_preview`                        | Content, Index Heroes, Hub Tools, Slideshow*, Navbar*, Image Defaults* |
| **Content**        | `_content_preview`, `_index_heroes_preview` | Index Heroes                                  |
| **Index Heroes**   | `_index_heroes_preview`                     | (none)                                        |
| **Hub Tools**      | `_hub_tools_preview`                        | (none)                                        |
| **Slideshow**      | (none)                                      | (none)                                        |
| **Navbar**         | (none)                                      | Index Heroes** (brand_categories transient)   |
| **Image Defaults** | (none)                                      | (none)                                        |
| **Ads**            | (none)                                      | (none)                                        |
| **Cache/CDN**      | (none)                                      | (none)                                        |

\* Slideshow, Navbar, Image Defaults read `cat_colors`/`cat_labels` for **display only** (UI labels and pill colors). Cascading a refresh is recommended so labels/colors update in real-time, but functionally the panels still work — stale display is cosmetic, not data-corrupting. At minimum, the 2-second watch polling will catch up.

\*\* Navbar's brand drag-and-drop sets `store.brand_categories` (transient in-memory state). Index Heroes reads this to preview brand category assignments before Navbar saves. This is a live-preview-only dependency — once Navbar saves, the frontmatter is canonical and Index Heroes reads from disk.

---

## 4. Live Preview Cascading Rules (All 9 Panels)

### Rule 1: Categories Preview → Cascade to ALL dependent panels

```
PUT /api/panels/categories/preview
  └─ Backend: store.preview(CATEGORIES) → rebuilds derived state
  └─ Backend: clears _hub_tools_preview (forces tool regeneration)

Frontend MUST then (in parallel, if target is not dirty):
  1. Update shell (accent, status) + categoriesPanel
  2. GET /api/panels/content           → refresh article eligibility
  3. GET /api/panels/index-heroes      → refresh candidate pool colors/labels
  4. GET /api/panels/hub-tools         → refresh tool defaults + category list
  5. GET /api/panels/slideshow         → refresh product category colors/labels
  6. GET /api/panels/navbar            → refresh mega menu category structure
  7. GET /api/panels/image-defaults    → refresh category pill colors/labels
```

Panels 5-7 are cosmetic refreshes (labels/colors only). Panels 2-4 are data-critical refreshes (eligibility/defaults change).

### Rule 2: Content Preview → Cascade to Index Heroes

```
PUT /api/panels/content/preview
  └─ Backend: updates content preview cache, clears _index_heroes_preview

Frontend MUST then:
  1. Update shell + contentPanel
  2. If Index Heroes is NOT dirty → GET /api/panels/index-heroes
```

### Rule 3: Navbar Preview → Cascade to Index Heroes (brand_categories)

```
PUT /api/panels/navbar/preview  (when ported)
  └─ Backend: sets store.brand_categories transient state

Frontend MUST then:
  1. Update shell + navbarPanel
  2. If Index Heroes is NOT dirty → GET /api/panels/index-heroes
```

### Rule 4: Index Heroes Preview → No cascade

```
Frontend: Update shell + indexHeroesPanel only.
```

### Rule 5: Hub Tools Preview → No cascade

```
Frontend: Update shell + hubToolsPanel only.
```

### Rule 6: Slideshow Preview → No cascade

```
Frontend: Update shell + slideshowPanel only.
```

### Rule 7: Image Defaults, Ads, Cache/CDN → No cascade

These are fully isolated leaf panels. Their previews affect no other panels.

---

## 5. Watch Polling Rules (All 10 Version Keys)

The frontend polls `GET /api/watch` every 2 seconds. Response: `{ changed: string[], versions: Record<string, number> }`.

The backend watches all 10 config files via `ConfigStore._paths`. When `poll_changes()` detects a mtime change:
- `CONTENT` change → clears `_content_preview` + `_index_heroes_preview`
- `CATEGORIES` change → clears `_hub_tools_preview`
- `HUB_TOOLS` change → clears `_hub_tools_preview`

### Watch table (all panels)

| Version Key      | If Changed & Panel Not Dirty         | Also Cascade Refresh                  |
|------------------|--------------------------------------|---------------------------------------|
| `categories`     | GET `/api/panels/categories`         | Content, Index Heroes, Hub Tools, Slideshow*, Navbar*, Image Defaults* |
| `content`        | GET `/api/panels/content` + `/api/panels/index-heroes` | —                    |
| `hub_tools`      | GET `/api/panels/hub-tools`          | —                                     |
| `slideshow`      | GET `/api/panels/slideshow`          | —                                     |
| `nav_sections`   | GET `/api/panels/navbar`             | Index Heroes**                        |
| `image_defaults` | GET `/api/panels/image-defaults`     | —                                     |
| `ads_registry`   | GET `/api/panels/ads`                | —                                     |
| `inline_ads`     | GET `/api/panels/ads`                | —                                     |
| `sponsors`       | GET `/api/panels/ads`                | —                                     |
| `cache_cdn`      | GET `/api/panels/cache-cdn`          | —                                     |

\* Cosmetic cascade (labels/colors only). Recommended but not data-critical.
\*\* Only if Navbar has pending brand_categories changes.

### Ads Panel: 3-key watch pattern

The Ads panel manages 3 separate JSON files + `.env`. Watch polling must check all 3 version keys and refresh the single Ads panel if any change:

```typescript
// Pseudocode for ads watch
const adsKeys = ['ads_registry', 'inline_ads', 'sponsors'];
const anyAdsChanged = adsKeys.some(key =>
  payload.versions[key] !== adsVersionRefs[key].current
);
if (anyAdsChanged && !isAdsDirty) {
  fetch('/api/panels/ads').then(refreshAdsPanel);
}
```

---

## 6. Per-Panel Detail Cards

### Panel 1: Categories

| Aspect | Detail |
|--------|--------|
| **File** | `data/categories.json` |
| **Reads from store** | Own key only |
| **Reads from cache** | `get_category_presence()` (has_products/has_content badges) |
| **Drives** | ALL other panels (via derived state) |
| **Preview cascade** | Content, Index Heroes, Hub Tools (data-critical); Slideshow, Navbar, Image Defaults (cosmetic) |
| **Save cascade** | None (watch polling handles dependent refresh) |
| **Special** | Only panel that rebuilds derived state. Color picker changes propagate everywhere. |

### Panel 2: Content

| Aspect | Detail |
|--------|--------|
| **File** | `data/content.json` (slots/pinned/badges/excluded sections) |
| **Reads from store** | `categories` (derived: cat_colors, cat_labels, active_content_cats) |
| **Reads from cache** | Article frontmatter scan |
| **Drives** | Index Heroes (article eligibility, pinned/badge status) |
| **Preview cascade** | Index Heroes |
| **Save cascade** | None |
| **Special** | Shares content.json with Index Heroes. 15-slot dashboard grid layout. |

### Panel 3: Index Heroes

| Aspect | Detail |
|--------|--------|
| **File** | `data/content.json` (indexHeroes section) |
| **Reads from store** | `categories` (derived), `content` (pinned/badges/excluded) |
| **Reads from cache** | Article + brand frontmatter scan |
| **Driven by** | Categories (colors/labels), Content (article status), Navbar (brand_categories transient) |
| **Preview cascade** | None |
| **Save cascade** | None |
| **Special** | Shares content.json with Content. `brand_categories` transient state from Navbar. |

### Panel 4: Hub Tools

| Aspect | Detail |
|--------|--------|
| **File** | `data/hub-tools.json` |
| **Reads from store** | `categories` (derived: categories list, active_product_cats, site_accent) |
| **Reads from cache** | `get_content_only_cats()` (filter non-product categories) |
| **Driven by** | Categories (product activation, category list) |
| **Preview cascade** | None |
| **Save cascade** | None |
| **Special** | `_ensure_hub_defaults()` auto-adds 5 tool types for new product categories. Shapes tool only for mouse. |

### Panel 5: Slideshow

| Aspect | Detail |
|--------|--------|
| **File** | `data/slideshow.json` |
| **Reads from store** | `categories` (derived: cat_colors, cat_labels, site_accent — UI display + accent propagation) |
| **Reads from cache** | `get_products()` — all 366 product JSONs (no eligibility filter) |
| **Driven by** | Categories (cosmetic: tab colors/labels, accent propagation) |
| **Preview cascade** | None (standalone leaf panel) |
| **Save cascade** | None |
| **Data structure** | `{ maxSlides: number, slides: string[] }` (product entry_ids, ordered) |
| **React entry** | `panels.tsx` → `SlideshowPanelView`, pure logic in `slideshow-editor.mjs` (29 tests) |
| **API routes** | `GET /api/panels/slideshow`, `PUT .../preview`, `PUT .../save` |
| **Special** | Auto-fill: score >= 8.0, deal links first, max 3/category. Yellow warning badge on queue tiles with score < 8.0. Category accent color propagates to tabs, sort pills, accent bar, divider via `--slideshow-accent` CSS variable. |
| **Product pool** | All products (no filter). Category tabs show only categories with product data on disk, in config order. |

### Panel 6: Navbar

| Aspect | Detail |
|--------|--------|
| **File** | `data/navbar-guide-sections.json` + writes to article frontmatter |
| **Reads from store** | `categories` (derived: cat_ids, cat_labels, cat_colors) |
| **Reads from cache** | `get_guides()`, `get_brands()`, `get_games()` — live frontmatter scan |
| **Driven by** | Categories (mega menu structure) |
| **Preview cascade** | Index Heroes (brand_categories transient) |
| **Save cascade** | DataCache invalidated (forces re-scan); brand_categories cleared |
| **Data structure** | `{ [category]: string[] }` (section names in order) |
| **Special** | **Writes frontmatter** — `navbar`, `categories`, `guide`, `displayName`, `game`, `title` fields. Uses targeted YAML field mutation (not full rewrite). 3 sub-tabs: Guides (sections + D&D), Brands (category assignment + navbar toggle), Games (on/off toggles). |
| **Transient state** | `store.brand_categories` — in-memory dict, NOT persisted. Set during brand D&D, cleared on save. Index Heroes reads this for preview. |

### Panel 7: Image Defaults

| Aspect | Detail |
|--------|--------|
| **File** | `data/image-defaults.json` |
| **Reads from store** | `categories` (derived: cat_labels, cat_colors — pill display only) |
| **Reads from cache** | `get_view_counts()` — product image view census |
| **Driven by** | Categories (cosmetic: pill labels/colors) |
| **Preview cascade** | None |
| **Save cascade** | None |
| **Data structure** | `{ defaults: { defaultImageView, listThumbKeyBase, coverImageView, headerGame, viewPriority, imageDisplayOptions, viewMeta }, categories: { [catId]: overrides } }` |
| **Special** | Category overrides deep-merge onto global defaults. `viewMeta` per-view entries are merged (not replaced). No preview mode — direct edits only. |

### Panel 8: Ads

| Aspect | Detail |
|--------|--------|
| **Files** | `data/ads-registry.json` + `data/inline-ads-config.json` + `data/direct-sponsors.json` + `.env` |
| **Reads from store** | Own 3 keys only. No categories dependency. |
| **Reads from cache** | None (scans `.astro/.ts/.tsx` source for `<AdSlot>` usage, not frontmatter) |
| **Driven by** | Nothing — fully independent |
| **Preview cascade** | None |
| **Save cascade** | None (writes 4 files independently) |
| **Special** | 5 sub-tabs: Positions, Usage Scanner, Inline Config, Sponsors, Dashboard. Writes `.env` for `PUBLIC_ADS_ENABLED` toggle. Sponsors.json has no site runtime consumer yet (pre-launch). |
| **Watch pattern** | Must watch 3 version keys (`ads_registry`, `inline_ads`, `sponsors`) and refresh single Ads panel if any change. |

### Panel 9: Cache/CDN

| Aspect | Detail |
|--------|--------|
| **File** | `data/cache-cdn.json` |
| **Reads from store** | Own key only. No dependencies on any other panel. |
| **Reads from cache** | None |
| **Driven by** | Nothing — fully independent |
| **Preview cascade** | None |
| **Save cascade** | None |
| **Data structure** | `{ policies: { [name]: CachePolicy }, pageTypes: { [name]: PageType }, targets: Target[] }` |
| **Special** | 6 policies, 8 page types, 8 route targets. Normalization handles legacy `policy` → `pageType` migration. Audit validation checks consistency (noStore vs TTLs, reference integrity). |

---

## 7. Content.json Shared File Contract

`content.json` is shared between Content (Panel 2) and Index Heroes (Panel 3):

```json
{
  "slots": { ... },          // ← Content panel reads/writes
  "pinned": [ ... ],         // ← Content panel reads/writes
  "badges": { ... },         // ← Content panel reads/writes
  "excluded": [ ... ],       // ← Content panel reads/writes
  "indexHeroes": {            // ← Index Heroes panel reads/writes
    "reviews": { ... },
    "news": { ... },
    "guides": { ... },
    "brands": { ... }
  }
}
```

**Version tracking:** Both panels share version key `content`. A change to either section updates the same file mtime.

**Conflict rule:** The backend merges writes independently. Content saves write `slots/pinned/badges/excluded`. Index Heroes saves write `indexHeroes`. Neither overwrites the other's fields.

---

## 8. Navbar Frontmatter Write Contract

Navbar is the only panel that writes to article source files (not just JSON config):

| Collection | Fields Written                          | File Location                    |
|------------|----------------------------------------|----------------------------------|
| Guides     | `navbar: [section]` or `[]`, `guide: "name"` | `src/content/guides/*/index.md`  |
| Brands     | `categories: [...]`, `navbar: [...]`, `displayName: "name"` | `src/content/brands/*/index.md` |
| Games      | `navbar: true/false`, `title: "name"`, `game: "name"` | `src/content/games/*/index.md` |

**Write method:** Targeted YAML field mutation via `write_list_field()` / `write_field()` — preserves file formatting, only replaces the specific field.

**Side effect on save:** `DataCache.invalidate()` forces all cache consumers to re-scan on next access.

---

## 9. Bootstrap Payload

On initial load, `GET /api/bootstrap` returns all implemented panels:

```typescript
BootstrapPayload = {
  shell: ShellPayload,
  panels: {
    categories: CategoriesPanelPayload,
    content: ContentPanelPayload,
    indexHeroes: IndexHeroesPanelPayload,
    hubTools: HubToolsPanelPayload,
    slideshow: SlideshowPanelPayload,
    navbar: NavbarPanelPayload,
    // Add as ported:
    imageDefaults: ImageDefaultsPanelPayload,
    ads: AdsPanelPayload,
    cacheCdn: CacheCdnPanelPayload,
  }
}
```

Each new panel requires:
1. Backend `get_*_payload()` method in `runtime.py`
2. HTTP routes in `main.py` (GET, PUT preview, PUT save)
3. Frontend TypeScript payload type in `desktop-model.ts`
4. Frontend state/effects/watch in `app.tsx`

---

## 10. Fixed Frontend Gaps

These 4 gaps were identified in the audit and fixed in `app.tsx`:

| Gap | Problem | Fix Applied |
|-----|---------|-------------|
| 1 | Categories preview didn't cascade to Hub Tools | Added parallel `GET /api/panels/hub-tools` if Hub Tools is clean |
| 2 | Categories preview didn't cascade to Index Heroes | Added parallel `GET /api/panels/index-heroes` if Index Heroes is clean |
| 3 | Content preview didn't cascade to Index Heroes | Added `GET /api/panels/index-heroes` after content preview if Index Heroes is clean |
| 4 | External category change didn't cascade | Added parallel cascade to Content, Index Heroes, Hub Tools on external category change |

---

## 11. Implementor Checklist (for every new panel)

### Backend (runtime.py + main.py)

- [ ] Add `get_{panel}_payload()` method to `ConfigRuntime`
- [ ] Add `preview_{panel}()` method (if panel supports live preview)
- [ ] Add `save_{panel}()` method
- [ ] Add HTTP routes: `GET /api/panels/{name}`, `PUT .../preview`, `PUT .../save`
- [ ] Add panel to `get_bootstrap_payload()` in `main.py`
- [ ] If panel reads categories: verify derived state is consumed (cat_colors, cat_labels, etc.)
- [ ] If panel writes frontmatter: call `cache.invalidate()` on save

### Frontend (app.tsx + panels.tsx + desktop-model.ts)

- [ ] Add TypeScript payload type to `desktop-model.ts`
- [ ] Add snapshot/normalization function to `desktop-model.ts`
- [ ] Add state: `useState`, snapshotRef, previewSnapshotRef, versionRef, previewRequestRef
- [ ] Add dirty detection: `snapshot(panel) !== snapshotRef.current`
- [ ] Add save handler with PUT endpoint
- [ ] Add preview useEffect with 120ms debounce + race-safe request ID
- [ ] Add watch polling for the panel's version key(s)
- [ ] Add to bootstrap payload processing
- [ ] Add to `saveCurrentPanel()` dispatch

### Cross-Panel Wiring

- [ ] If depends on categories: add cascade refresh in categories preview handler
- [ ] If depends on categories: add cascade refresh in external categories watch handler
- [ ] If depends on content: add cascade refresh in content preview handler
- [ ] If Navbar: add brand_categories cascade to Index Heroes
- [ ] If Ads: watch all 3 version keys (`ads_registry`, `inline_ads`, `sponsors`)

### Testing

- [ ] Edit categories → verify panel refreshes within 120ms (preview) or 2s (watch)
- [ ] Edit content → verify panel refreshes if dependent
- [ ] External file edit → verify watch detects and refreshes
- [ ] Save → verify no cascade side effects on other panels
- [ ] Concurrent dirty panels → verify no cross-contamination
