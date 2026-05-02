# Content Dashboard Panel

Content Dashboard manages homepage editorial layout and collection-level article controls. It configures the 15-slot homepage dashboard, pins, badges, exclusions, and full feed simulation.

Panel within the unified mega-app: `pythonw config/eg-config.pyw` (Ctrl+2)

Subscribes to `CATEGORIES` — when category flags change in the Categories panel, the Content panel re-checks which articles belong to active content categories and re-runs the feed simulation instantly via `_on_categories_change()`. Disabling a category immediately dims its articles in the dashboard.

Current status:

- Tk: full implementation (`config/panels/content.py`)
- React: full implementation (`config/ui/panels.tsx` + `config/ui/app.tsx`)

## React Wiring Pattern

React mirrors Categories pattern:

- Bootstrap hydration from `/api/bootstrap`
- Dirty snapshot via `snapshotContent()`
- Debounced preview to `/api/panels/content/preview`
- Save to `/api/panels/content/save`
- Watch refresh from `/api/watch` (`versions.content`)

Files:

- `config/ui/desktop-model.ts` (`ContentPanelPayload`, request/snapshot helpers)
- `config/ui/content-editor.ts` (pure edit transitions)
- `config/ui/panels.tsx` (`ContentPanelView`)
- `config/ui/app.tsx` (state + effects)
- `config/app/runtime.py` (`get_content_payload`, `preview_content`, `save_content`)
- `config/app/main.py` (routes)

## Data and Output Format

- **Reads:** `src/content/{reviews,guides,news,brands,games}/**/index.{md,mdx}` (article frontmatter, read-only)
- **Reads:** `config/data/categories.json` (category colors, content flags)
- **Writes:** `config/data/content.json`

```json
{
  "slots": {
    "1": { "collection": "news", "id": "monitor/msi-unveils-mag" }
  },
  "pinned": ["reviews:mouse/razer-viper-review"],
  "badges": { "reviews:mouse/razer-viper-review": "Top Pick" },
  "excluded": ["news:old-article-to-hide"]
}
```

- `slots` — manual overrides keyed by 1-indexed slot number (1-15)
- `pinned` — composite keys (`collection:id`) that float to top within their feed section
- `badges` — composite keys mapped to badge text (e.g., "Top Pick", "Editors Choice")
- `excluded` — composite keys to hide from all feeds

## Tabs

### Homepage Tab

Two-panel layout: Article Pool (left) + Dashboard Grid (right).

**Toolbar:** Collection filter pills, search, and feed guide with hover tooltips.

**Feed Guide:** Row of colored pills for each home page section. Hover any pill to see a tooltip explaining its sort method, pin behavior, and dedup rules.

### Type Tabs (Reviews, Guides, News, Brands, Games)

Per-collection article lists with sort controls and frontmatter details.

## Dashboard Grid Layout

Matches HBS `index.handlebars` structure — 6 rows, 15 slots:

| Row | Slots | Description |
|-----|-------|-------------|
| 0 | 1 | Hero (full-width, large image) |
| 1 | 2-4 | 3 medium cards |
| 2 | 5 | Feature (full-width cinematic tile) |
| 3 | 6-8 | 3 medium cards |
| 4 | 9-11 | 3 medium cards |
| 5 | 12-15 | 4 small cards |

## Interactions

| Action | Behavior |
|--------|----------|
| Drag article -> slot | Place article in slot (manual override) |
| Pin toggle | Pin/unpin article (floats within its feed section) |
| Badge edit | Set custom badge text on a slot |
| Exclude toggle | Remove article from all feeds |
| Ctrl+S | Save all changes to `content.json` |

## Home Page Feed Sections

The content manager simulates the full home page data flow from `index.astro`. Each article in the pool shows its feed assignment label.

| Feed Label | Section | Items | Sort Method | Pins? | Dedup |
|------------|---------|-------|-------------|-------|-------|
| Dash | Dashboard | 15 | max(datePublished, dateUpdated) newest first | No — use manual slot overrides | None |
| News F | News Feed Sidebar | 3 | datePublished only — newest published first | No — pure chronological | None |
| Games | Game Gear Picks | all | pinned first, then max(pub, upd) | Yes | None (separate collection) |
| Rev H | Featured Reviews Hero | 1 (first after pin+date sort) | pinned first, then max(pub, upd) | Yes — a pinned review becomes the hero | Excludes Dashboard articles |
| Rev | Featured Reviews | rest after hero | pinned first, then max(pub, upd) | Yes | Excludes Dashboard articles |
| Guide H | Highlighted Guides Hero | 1 (first after pin+date sort) | pinned first, then max(pub, upd) | Yes — a pinned guide becomes the hero | Excludes Dashboard articles |
| Guides | Highlighted Guides | rest after hero | pinned first, then max(pub, upd) | Yes | Excludes Dashboard articles |
| News L | Latest News Top Grid | 4 | pinned first, then max(pub, upd) | Yes | Excludes Dashboard articles |
| News C | Latest News Continued | up to 16 | pinned first, then max(pub, upd) | Yes | Items 5-20 from same sorted list |

**Key design decisions:**

- **Dashboard auto-fill** uses pure date sort (no pins) — manual slot overrides are the editorial control mechanism
- **News F** uses `datePublished` only, not `max(pub, upd)` — this is intentional: it's a "latest published" feed, so fixing a typo on an old article doesn't bump it into the sidebar
- **News F is non-exclusive** — the same article CAN appear in both News F and News L/C
- **News L and News C are one sorted list split at index 4** — items 1-4 go to News L (top grid), items 5-20 go to News C (continued feed)
- **Rev H / Guide H are heroes** — the first article after pin+date sort becomes the scroller hero; pinning a review/guide makes it the hero
- **Dashboard collections** — only reviews, guides, and news enter the dashboard. Games and brands have their own dedicated sections

### Sort Key Reference

- `max(datePublished, dateUpdated)`: whichever date is newer — updated content bubbles up
- `datePublished only`: ignores dateUpdated — only genuinely new articles appear
- `pinned first`: articles in the `pinned` array of `content.json` float to the top within their section

### Tie-Breaking

When multiple articles share the same sort date, ties break by production input order: reviews first (by datePublished desc), then guides, then news. This matches the `[...taggedReviews, ...taggedGuides, ...taggedNews]` merge in `index.astro`.

## Auto-fill Logic

1. Manually placed slots are filled first (from `slots` config)
2. Remaining empty slots fill with eligible articles sorted by `max(datePublished, dateUpdated)` newest first
3. Eligibility: must have `hero` field, must not be in `excluded` list, collection must be reviews/guides/news
4. Tie-breaking: reviews before guides before news, then by datePublished desc within collection

## Live Cross-Panel Propagation (content_editorial)

When pin, badge, or exclude toggles change, the Content panel broadcasts the change to Index Heroes **before save** via a pseudo-key:

1. Content updates `_pinned`/`_badges`/`_excluded` in memory
2. Calls `store.notify("content_editorial")`
3. Index Heroes' `_on_content_editorial()` fires
4. Index Heroes reads Content panel's live in-memory state directly
5. Article hero preview updates immediately (pinned articles get priority)

This ensures the Index Heroes panel always shows accurate hero previews even when Content panel edits haven't been saved yet.

## Shared Ownership — content.json

Content and Index Heroes both write to `content.json`:
- **Content owns:** `slots`, `pinned`, `badges`, `excluded`
- **Index Heroes owns:** `indexHeroes` (per-type hero override arrays)

Both panels use a merge-on-save pattern to preserve each other's data:
```python
existing = dict(store.get(CONTENT))  # read full config
existing.update(my_owned_fields)      # update only owned fields
store.save(CONTENT, existing)         # write back with other fields intact
```

`save_content()` must preserve `indexHeroes`.

## Astro Integration

`src/core/dashboard.ts` reads `config/data/content.json` and exports:
- `buildDashboard()` — the 15-slot algorithm
- `sortByPinnedThenDate()` — shared sort for all pin-aware sections
- `pinnedSet` / `badgesMap` — editorial metadata

`src/pages/index.astro` orchestrates the full data flow:
1. Dashboard (15 slots) via `buildDashboard()`
2. News F sidebar (top 3 news by datePublished)
3. Games via `sortByPinnedThenDate()`
4. Featured Reviews (deduped against dashboard) via `sortByPinnedThenDate()`
5. Highlighted Guides (deduped against dashboard) via `sortByPinnedThenDate()`
6. Latest News (deduped against dashboard) via `sortByPinnedThenDate()`

## Cross-Panel Behavior

- Categories preview refreshes Content payload when Content is clean, so category labels/colors update live.
- Content and Index Heroes both react to `versions.content` changes.

## Downstream Consumers

- `src/core/dashboard.ts`
- `src/pages/index.astro`
- `src/features/home/featured-scroller-utils.ts`
- Index heroes selection logic

## Design System

Follows [RULES.md](../RULES.md) exactly:
- Catppuccin Mocha theme
- Site accent from `categories.json` siteColors
- Collection-colored badges and feed pills
- Standard header/status bar/save pattern
- `HoverTooltip` widget for feed guide explanations

## Validation

- `test/config-react-desktop-port.test.mjs` (content bootstrap/get/preview/save contract)
- `test/config-react-desktop-ui-contract.test.mjs` (rendering/token/density contracts)
- `config/tests/test_react_desktop_api.py`

## Cross-Links

- [Categories](categories.md)
- [Index Heroes](index-heroes.md)
- [Hub Tools](hub-tools.md)
- [Navbar](navbar.md)
- [Data Contracts](../data/data-contracts.md)
- [Routing and GUI](../frontend/routing-and-gui.md)
- [Python Application](../runtime/python-application.md)
- [System Map](../architecture/system-map.md)

## Validated Against

- `config/panels/content.py`
- `config/eg-config.pyw`
- `config/app/main.py`
- `config/app/runtime.py`
- `config/ui/app.tsx`
- `config/ui/panels.tsx`
- `config/ui/content-editor.ts`
- `config/ui/desktop-model.ts`
- `config/data/content.json`
- `src/core/dashboard.ts`
- `src/pages/index.astro`
- `src/features/home/featured-scroller-utils.ts`
- `config/tests/test_react_desktop_api.py`
- `test/config-react-desktop-port.test.mjs`
- `test/config-react-desktop-ui-contract.test.mjs`
