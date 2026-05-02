# Index Heroes Panel

Index Heroes manages hero overrides for index pages by type and category. It configures hero dashboard overrides for `/reviews`, `/news`, `/guides`, and `/brands` index pages with 3-slot heroes for articles and 6-slot heroes for brands.

Panel within the unified mega-app: `pythonw config/eg-config.pyw` (Ctrl+3)

Current status:

- Tk: full implementation (`config/panels/index_heroes.py`)
- React: full implementation (`config/ui/panels.tsx` + `config/ui/app.tsx`)

## Responsibilities

- Owns `indexHeroes` inside `config/data/content.json`.
- Supports types: `reviews`, `news`, `guides`, `brands`.
- Slot counts:
  - `reviews/news/guides`: 3
  - `brands`: 6
- Supports category overrides including `_all`.

## Ownership Boundary

`content.json` is co-owned:

- Index Heroes owns: `indexHeroes`
- Content owns: `slots`, `pinned`, `badges`, `excluded`

`save_index_heroes()` must preserve Content-owned keys.

## React Wiring Pattern

React follows same preview/save flow as Categories and Content:

- Bootstrap hydration from `/api/bootstrap`
- Dirty snapshot via `snapshotIndexHeroes()`
- Debounced preview to `/api/panels/index-heroes/preview`
- Save to `/api/panels/index-heroes/save`
- Watch refresh via `versions.content`

Files:

- `config/ui/desktop-model.ts` (`IndexHeroesPanelPayload`, request/snapshot helpers)
- `config/ui/panels.tsx` (`IndexHeroesPanelView`)
- `config/ui/app.tsx` (state + effects + save routing)
- `config/app/runtime.py` (`get_index_heroes_payload`, `preview_index_heroes`, `save_index_heroes`)
- `config/app/main.py` (routes)

## Data and Output Format

- **Reads:** `src/content/{reviews,guides,news}/**/index.{md,mdx}` (article frontmatter, read-only)
- **Reads:** `src/content/brands/**/index.md` (brand frontmatter, read-only)
- **Reads:** Content panel's in-memory `_pinned`, `_badges`, `_excluded` (live sync)
- **Shared write:** `config/data/content.json` (`indexHeroes` field only)

Index Heroes writes only the `indexHeroes` field within `content.json`:

```json
{
  "indexHeroes": {
    "reviews": { "_all": ["reviews:mouse/razer-review", "reviews:mouse/pulsar-review"] },
    "news": {},
    "guides": { "mouse": ["guides:mouse/best-mice"] },
    "brands": { "_all": ["pulsar", "razer"] }
  }
}
```

- Keys per type: `"_all"` for the unfiltered view, category slugs for filtered views
- Article values: composite keys (`collection:entry_id`)
- Brand values: plain slugs (e.g., `"razer"`, `"logitech-g"`)

## Hero Algorithm

### Articles (reviews, news, guides) — 3 slots

Priority: **config overrides > pinned > date sort > category diversity**

1. If `indexHeroes[type][category]` has manual overrides, use those first
2. Fill remaining slots with pinned articles (from Content panel's `_pinned` set)
3. Fill remaining with date-sorted articles (`max(datePublished, dateUpdated)` desc)
4. All-view: prefer unseen categories for diversity

### Brands — 6 slots

Priority: **config overrides > iDashboard/iFilteredDashboard > date sort > category diversity**

1. If `indexHeroes.brands[category]` has manual overrides, use those first
2. Fill remaining with `iDashboard` (all-view) / `iFilteredDashboard` (category view) frontmatter pins
3. Sort remaining by `max(datePublished, dateUpdated)` desc, slug alphabetical as tiebreaker
4. All-view: prefer unseen primary categories for diversity
5. Category view: simple date-sorted fill

This mirrors the JS algorithm in `src/features/site-index/select-brand-dashboard.mjs`.

## Subscriptions (Live Cross-Panel Sync)

| Key | Source | What it does |
|-----|--------|-------------|
| `CONTENT` | ConfigStore (file save) | Syncs pins/badges/excluded from saved config. Also syncs hero overrides if no local changes. |
| `"content_editorial"` | Content panel (pin/badge/exclude toggles) | Reads Content panel's live in-memory state. Updates hero preview before save. |
| `"brand_categories"` | Navbar panel (brand drag/drop) | Triggers brand reload + merges unsaved categories overrides. Updates brand hero preview before save. |
| `CATEGORIES` (via lazy refresh) | Categories panel | Updates `category_active` flags on articles when category toggles change. |

## Layout

### Type Tabs

Horizontal row: Reviews (blue), News (peach), Guides (green), Brands (mauve).
Clicking a type switches the entire panel view.

### Category Sidebar

Left column of category filter buttons. Shows brand/article counts per category.
"All" button shows the unfiltered view.

### Hero Slots

3 slots (articles) or 6 slots (brands) in a grid.

Each slot shows:
- Article: title, date, collection badge, hero image indicator
- Brand: display name, categories, logo indicator

**Tooltips:** Each slot shows what the auto-fill algorithm would pick:
- Manual slot: "Manual override — auto-fill would show: {name}"
- Auto slot: "Auto-filled by date sort (date: {sort_date})"

### Pool (Treeview)

Scrollable list of eligible articles or brands below the slots.

Article columns: pin icon, title, category, date, badge
Brand columns: name, categories, iDashboard, logo

## Interactions

| Action | Behavior |
|--------|----------|
| Double-click pool item | Assign to first empty slot |
| Drag pool item to slot | Assign to specific slot |
| Click slot "x" button | Clear manual override (revert to auto-fill) |
| Type tab click | Switch between reviews/news/guides/brands |
| Category button click | Filter to specific category view |
| Ctrl+S | Save `indexHeroes` to `content.json` (merge pattern) |

## No-Drift UI Contract (Content Primitive Reuse)

Index Heroes now composes the same dense shell primitives as Content:

- Main type tabs use `content-panel__main-tabs` / `content-panel__main-tab`.
- Category filter tabs use `content-panel__subtabs` / `content-panel__subtab`.
- Candidate list uses `content-pool` + `content-pool__row` primitives.
- Hero cards use `content-dashboard` + `content-dashboard__slot` primitives.

Do not re-introduce bespoke tab/list/card skins for Index Heroes.

Accent behavior:

- Pool rows bind `--content-accent` per candidate (`candidate.categoryColor`).
- Slot cards bind `--content-accent` per slotted candidate.
- This keeps row text and auto-slot borders category-colored like Content.

Data density expectations:

- Pool columns are Title / Cat / Date / Add.
- Hero header shows manual/auto/slot counts.
- Filled hero cards show title + category badge + bottom-right date.
- Slot grid must clear inherited Content dashboard row tracks (`.index-heroes-slots__grid { grid-template-rows: none; }`) so `brands` renders as a true 2-row 3x2 matrix without second-row stretch drift.

## Runtime Selection Notes

- Runtime builds pool + slot payloads per type.
- Overrides are sanitized against valid keys before preview/save.
- `brands` uses brand selector logic; article types use article selector logic.
- Payload includes:
  - `types`
  - `categories`
  - `pools`
  - `slots`
  - `overrides`
  - `activeType`, `activeCategory`
  - `statusRight`, `version`

## Cross-Panel Behavior

- Depends on Content editorial keys (`pinned`, `badges`, `excluded`) for candidate quality.
- Refreshes alongside Content when `content.json` version changes.

## Shared Ownership — content.json

Index Heroes and Content panel both write to `content.json`:
- **Content owns:** `slots`, `pinned`, `badges`, `excluded`
- **Index Heroes owns:** `indexHeroes`

Both use `existing.update(owned_fields)` merge pattern on save.

## Validation

- `test/config-react-desktop-port.test.mjs` (index-heroes get/preview/save + key-preservation)
- `test/config-react-desktop-ui-contract.test.mjs` (shell integration assertions)
- `config/tests/test_react_desktop_api.py`

## Cross-Links

- [Categories](categories.md)
- [Content Dashboard](content-dashboard.md)
- [Hub Tools](hub-tools.md)
- [Navbar](navbar.md)
- [Data Contracts](../data/data-contracts.md)
- [Routing and GUI](../frontend/routing-and-gui.md)
- [Python Application](../runtime/python-application.md)
- [System Map](../architecture/system-map.md)

## Validated Against

- `config/panels/index_heroes.py`
- `config/eg-config.pyw`
- `config/app/main.py`
- `config/app/runtime.py`
- `config/ui/app.tsx`
- `config/ui/panels.tsx`
- `config/ui/desktop-model.ts`
- `config/data/content.json`
- `src/features/site-index/select-brand-dashboard.mjs`
- `config/tests/test_react_desktop_api.py`
- `test/config-react-desktop-port.test.mjs`
- `test/config-react-desktop-ui-contract.test.mjs`
