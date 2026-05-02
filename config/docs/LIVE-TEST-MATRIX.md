# Config Manager — Live Test Matrix

Comprehensive functionality and propagation verification for all 9 ported panels.
Audited against `app.tsx`, `runtime.py`, `panels.tsx`, `desktop-model.ts`, `navbar-editor.ts`, `slideshow-editor.mjs`.

Legend: `[ ]` = untested, `[x]` = pass, `[!]` = fail (add note)

---

## Panel 1: Categories (Ctrl+1)

### Core Functionality

| # | Test | Expected | Status |
|---|------|----------|--------|
| C-01 | Load panel from bootstrap | All categories render with correct color, label, plural, product/content toggles | [ ] |
| C-02 | Edit category color | Color picker opens, swatch + hex update live | [ ] |
| C-03 | Edit label text | Text input updates, debounced 300ms | [ ] |
| C-04 | Edit plural text | Text input updates, debounced 300ms | [ ] |
| C-05 | Toggle product.production | Flag toggles, card updates | [ ] |
| C-06 | Toggle product.vite | Flag toggles, card updates | [ ] |
| C-07 | Toggle content.production | Flag toggles, card updates | [ ] |
| C-08 | Toggle content.vite | Flag toggles, card updates | [ ] |
| C-09 | Site primary color edit | Color picker opens, accent changes | [ ] |
| C-10 | Site secondary color edit | Color picker opens, secondary updates | [ ] |
| C-11 | Add new category | Dialog opens, new category appears with generated color | [ ] |
| C-12 | Data counts display | Product count, article counts (reviews/guides/news) shown per category | [ ] |
| C-13 | Derived color swatches | Base, accent, hover, grad-start, score-end, dark, soft swatches shown | [ ] |
| C-14 | Save (Ctrl+S) | `categories.json` updated on disk, toast confirms, version bumps | [ ] |
| C-15 | Dirty indicator | "unsaved: Categories" in context bar, clears after save | [ ] |

### Preview Cascade (Categories → All Other Panels)

Categories preview fires on every change. If the downstream panel is NOT dirty,
it receives a fresh payload automatically.

| # | Test | Expected | Status |
|---|------|----------|--------|
| C-P1 | Color change → Content panel | Category pills and feed section colors update (no save) | [ ] |
| C-P2 | Color change → Index Heroes | Category sidebar accent colors update | [ ] |
| C-P3 | Color change → Hub Tools | Category sidebar accent colors update | [ ] |
| C-P4 | Color change → Navbar Guides | Column bar colors, pill accents, count badge colors update | [ ] |
| C-P5 | Color change → Navbar Brands | All column bars update to new category color | [ ] |
| C-P6 | Color change → Navbar Hubs | Hub card dot + left accent bar update | [ ] |
| C-P7 | Label change → all panels | Category display names update in pills, headers, column titles | [ ] |
| C-P8 | Product flag toggle → Hub Tools | Category list filters, dimmed state updates | [ ] |
| C-P9 | Product flag toggle → Navbar Hubs | Product/Vite badges update on hub cards | [ ] |
| C-P10 | Content flag toggle → Content | Active content categories update, articles dim/undim | [ ] |
| C-P11 | Site accent change → shell | Sidebar accent, context bar accent update across app | [ ] |
| C-P12 | Color change → Slideshow | Category tab colors, accent bar, sort pill active color update | [ ] |
| C-P13 | Label change → Slideshow | Category tab labels update | [ ] |
| C-P14 | Cascade skipped when dirty | If any downstream panel is dirty, cascade does NOT overwrite local changes | [ ] |

### Watch / External Edit

| # | Test | Expected | Status |
|---|------|----------|--------|
| C-W1 | Edit `categories.json` externally | `versions.categories` bumps, panel refreshes within 2s | [ ] |
| C-W2 | External change cascades | Content, Index Heroes, Hub Tools, Slideshow also refresh (if not dirty) | [ ] |

---

## Panel 2: Content / Dashboard (Ctrl+2)

### Core Functionality

| # | Test | Expected | Status |
|---|------|----------|--------|
| D-01 | Load panel from bootstrap | Homepage tab: article pool (left) + 15-slot dashboard grid (right) | [ ] |
| D-02 | Collection filter pills | Click filter → pool shows only that collection | [ ] |
| D-03 | Search articles | Text search filters pool in real time | [ ] |
| D-04 | Drag article → dashboard slot | Article placed in slot, slot shows title/image/collection badge | [ ] |
| D-05 | Clear slot (x button) | Manual override removed, slot reverts to auto-fill | [ ] |
| D-06 | Move slot (drag between slots) | Article swaps position | [ ] |
| D-07 | Reset all slots | All manual overrides cleared, full auto-fill | [ ] |
| D-08 | Pin toggle | Pin/unpin, feed label updates (pinned floats in Rev H/Guide H/News L) | [ ] |
| D-09 | Badge edit | Badge text set, badge pill appears on article | [ ] |
| D-10 | Exclude toggle | Article removed from all feeds, dimmed in pool | [ ] |
| D-11 | Feed guide tooltips | Hover feed section pills → tooltip explains sort/pin/dedup | [ ] |
| D-12 | Auto-fill simulation | Empty slots fill date-sorted: reviews > guides > news, hero-eligible only | [ ] |
| D-13 | Dashboard row layout | 6 rows (1 + 3 + 1 + 3 + 3 + 4 = 15 slots) | [ ] |
| D-14 | Type tabs (Reviews, Guides, News, Brands, Games) | Per-collection lists with frontmatter details | [ ] |
| D-15 | Save (Ctrl+S) | `content.json` updated: slots, pinned, badges, excluded (merge preserves indexHeroes) | [ ] |
| D-16 | Dirty indicator | "unsaved: Content" in context bar | [ ] |

### Content → Index Heroes Propagation

| # | Test | Expected | Status |
|---|------|----------|--------|
| D-P1 | Pin toggle → Index Heroes preview | Hero pool priority updates (pinned article gets hero priority) | [ ] |
| D-P2 | Exclude toggle → Index Heroes preview | Excluded article removed from hero pool | [ ] |
| D-P3 | Badge change → Index Heroes | Badge appears in hero slot display | [ ] |
| D-P4 | Cascade skipped when IH dirty | If Index Heroes has local changes, cascade does NOT overwrite | [ ] |

### Watch / External Edit

| # | Test | Expected | Status |
|---|------|----------|--------|
| D-W1 | Edit `content.json` externally | Both Content AND Index Heroes refresh (shared file) | [ ] |

---

## Panel 3: Index Heroes (Ctrl+3)

### Core Functionality

| # | Test | Expected | Status |
|---|------|----------|--------|
| H-01 | Load panel from bootstrap | Type tabs + category sidebar + hero slots + pool | [ ] |
| H-02 | Type tab: Reviews | 3 hero slots, review pool, blue accent | [ ] |
| H-03 | Type tab: News | 3 hero slots, news pool, peach accent | [ ] |
| H-04 | Type tab: Guides | 3 hero slots, guide pool, green accent | [ ] |
| H-05 | Type tab: Brands | 6 hero slots, brand pool, mauve accent | [ ] |
| H-06 | Category sidebar — "All" | Unfiltered view with category diversity in auto-fill | [ ] |
| H-07 | Category sidebar — specific | Filtered to one category's articles/brands | [ ] |
| H-08 | Category sidebar counts | Badge shows count per category | [ ] |
| H-09 | Double-click pool item → slot | Assigned to first empty slot | [ ] |
| H-10 | Drag pool item → specific slot | Assigned to that slot | [ ] |
| H-11 | Clear slot (x button) | Reverts to auto-fill | [ ] |
| H-12 | Clear all overrides | All manual overrides cleared | [ ] |
| H-13 | Auto-fill — articles | Config overrides > pinned > date sort > category diversity | [ ] |
| H-14 | Auto-fill — brands | Config overrides > iDashboard > date sort > category diversity | [ ] |
| H-15 | Slot tooltip — manual | "Manual override — auto-fill would show: {name}" | [ ] |
| H-16 | Slot tooltip — auto | "Auto-filled by date sort (date: {date})" | [ ] |
| H-17 | Save (Ctrl+S) | `content.json` indexHeroes field updated (merge preserves slots/pinned/badges/excluded) | [ ] |
| H-18 | Dirty indicator | "unsaved: Index Heroes" in context bar | [ ] |

### Index Heroes Subscriptions

| # | Test | Expected | Status |
|---|------|----------|--------|
| H-P1 | Content pin/exclude → hero | Live update before either panel saves | [ ] |
| H-P2 | Navbar brand category drag → brand hero | `brand_categories` transient updates hero pool | [ ] |
| H-P3 | Categories flag toggle → eligibility | Articles dim when their category is deactivated | [ ] |
| H-P4 | Categories color change → sidebar | Sidebar button colors update instantly | [ ] |

### Watch / External Edit

| # | Test | Expected | Status |
|---|------|----------|--------|
| H-W1 | Edit `content.json` externally | Both Content AND Index Heroes refresh (shared file, both version refs checked) | [ ] |

---

## Panel 4: Hub Tools (Ctrl+4)

### Home Tab

| # | Test | Expected | Status |
|---|------|----------|--------|
| T-01 | Load panel from bootstrap | Category sidebar + tool cards for selected category | [ ] |
| T-02 | Category sidebar switch | Tools update to selected category | [ ] |
| T-03 | Active vs dimmed categories | Inactive/manual product categories dimmed, content-only excluded | [ ] |
| T-04 | Edit tool title | Text field updates | [ ] |
| T-05 | Edit tool URL | Text field updates | [ ] |
| T-06 | Edit tool description | Text area updates | [ ] |
| T-07 | Edit tool subtitle | Text field updates | [ ] |
| T-08 | Toggle tool enabled | Card dims when off | [ ] |
| T-09 | Toggle tool navbar | Navbar visibility flag changes | [ ] |
| T-10 | Edit SVG icon | SVG editor dialog opens, icon preview updates | [ ] |
| T-11 | Edit shared tooltips | Tooltip dialog, text editable per tool type | [ ] |
| T-12 | 5 tool types per category | Hub, Database, Versus, Radar, Shapes all present | [ ] |

### Index Tab

| # | Test | Expected | Status |
|---|------|----------|--------|
| T-13 | View selector | All/Hub/Database/Versus/Radar/Shapes filter the pool | [ ] |
| T-14 | Drag tool → slot | Tool placed, slot takes category color | [ ] |
| T-15 | Remove tool from slot (x) | Slot clears, tool returns to pool | [ ] |
| T-16 | 6 slots (3x2 grid) | Correct slot count and layout | [ ] |
| T-17 | Disabled tool in pool | Grayed with "(off)", still assignable | [ ] |
| T-18 | Slot info display | Category label, tool type, title, description, icon | [ ] |

### Save & Watch

| # | Test | Expected | Status |
|---|------|----------|--------|
| T-19 | Save (Ctrl+S) | `hub-tools.json` updated: tools + _tooltips + _index | [ ] |
| T-20 | Dirty indicator | "unsaved: Hub Tools" in context bar | [ ] |
| T-21 | Edit `hub-tools.json` externally | Panel refreshes within 2s | [ ] |

### Cross-Panel

| # | Test | Expected | Status |
|---|------|----------|--------|
| T-P1 | Categories color → sidebar | Accent colors update | [ ] |
| T-P2 | Categories product flag → category list | Category appears/dims | [ ] |
| T-P3 | Categories label → sidebar | Display names update | [ ] |
| T-P4 | Categories save clears hub preview | `_hub_tools_preview = None` on categories save | [ ] |

---

## Panel 5: Navbar (Ctrl+5)

### Guides Tab

| # | Test | Expected | Status |
|---|------|----------|--------|
| N-01 | Load guides tab | Pills + section columns + divider + pool-area (button + search + Unassigned) | [ ] |
| N-02 | Category pill switch | Columns update to that category's guide sections | [ ] |
| N-03 | Pills wrap correctly | 120px min-width, flex-wrap, 6px row gap, never cross divider | [ ] |
| N-04 | Drag: Unassigned → section | Guide moves, `guideChanges` delta recorded | [ ] |
| N-05 | Drag: section → section | Guide reassigns between sections | [ ] |
| N-06 | Drag: section → Unassigned | Guide unassigned, `navbar` cleared | [ ] |
| N-07 | + Add Section button | Dialog, new section created in columns (before Unassigned) | [ ] |
| N-08 | Rename section (✎) | Dialog, section + all items renamed, sectionOrder updated | [ ] |
| N-09 | Delete section (✕) | Dialog, section removed, items move to Unassigned, guideChanges recorded | [ ] |
| N-10 | Reorder section (◀ ▶) | Section swaps in sectionOrder, columns re-sort | [ ] |
| N-11 | Column colored bar | Matches category color | [ ] |
| N-12 | Count badge — colored | Category color background, dark text | [ ] |
| N-13 | Hover-reveal controls | ◀ ▶ ✎ ✕ fade in on column hover, hidden otherwise | [ ] |
| N-14 | Control divider | Visible separator between reorder and edit button groups | [ ] |
| N-15 | Unassigned muted items | `--color-overlay-0` text, highlights on hover | [ ] |
| N-16 | Search filters all columns | Items filtered across sections AND Unassigned | [ ] |
| N-17 | Search width = Unassigned width | Both 280px in pool-area container | [ ] |
| N-18 | Layout divider visible | 1px vertical line between columns-area and pool-area | [ ] |
| N-19 | Double-click guide → rename | Rename dialog for `guide` field | [ ] |
| N-20 | Drop target highlight | Dashed blue border + 8% blue tint on valid drop zones | [ ] |
| N-21 | Column title capitalize | Section names render title-cased | [ ] |

### Brands Tab

| # | Test | Expected | Status |
|---|------|----------|--------|
| N-22 | Load brands tab | All category columns + divider + pool-area (search + All Brands) | [ ] |
| N-23 | All columns visible at once | Mouse, Keyboard, Monitor, etc. — no pill selector | [ ] |
| N-24 | Horizontal scroll | Category columns scroll, All Brands pinned right | [ ] |
| N-25 | All columns same 280px width | Consistent column sizing | [ ] |
| N-26 | All Brands = every brand | Pool shows ALL brands regardless of category | [ ] |
| N-27 | Category tags colored | Each brand in pool shows colored pill tags per assigned category | [ ] |
| N-28 | Checkbox — category colored | Active: filled with category color + checkmark. Inactive: empty square | [ ] |
| N-29 | Checkbox hover states | Inactive: border turns blue. Active: darkens category color | [ ] |
| N-30 | Checkbox toggle | Toggles `navbar` for that category only, `categories` unchanged | [ ] |
| N-31 | Drag: pool → category column | Brand added to `categories` + `navbar`, `brandChanges` delta recorded | [ ] |
| N-32 | Drag: column → pool | Brand removed from that category | [ ] |
| N-33 | Drop targets per category | Each column registers as `brand-{catId}` | [ ] |
| N-34 | Pencil edit button | Hover-reveal on brand items, opens rename dialog | [ ] |
| N-35 | Double-click → rename | Same rename dialog for `displayName` | [ ] |
| N-36 | Search brands | Filters All Brands pool | [ ] |
| N-37 | Layout divider | Between category columns and All Brands | [ ] |
| N-38 | Colored column bars | Each category column has its color top bar | [ ] |
| N-39 | Count badges colored | Per-column with category color | [ ] |

### Games Tab

| # | Test | Expected | Status |
|---|------|----------|--------|
| N-40 | Load games tab | Header (Games + count + active/total + Toggle All) + 3-column grid | [ ] |
| N-41 | Exactly 3 columns | `grid-template-columns: repeat(3, 1fr)`, not auto-fill | [ ] |
| N-42 | Game card — 3px left accent | Theme color when active, grey when inactive | [ ] |
| N-43 | Game card — hover highlight | Background shifts to `--color-surface-1` | [ ] |
| N-44 | Toggle switch | Click toggles `navbar` boolean, accent bar updates, `gameChanges` recorded | [ ] |
| N-45 | Toggle All button | All on/off, label flips "Activate All" ↔ "Deactivate All" | [ ] |
| N-46 | Pencil edit button | Hover-reveal, opens rename dialog for `game`/`title` | [ ] |
| N-47 | Active count updates | Header "{n}/{total} active" reflects current toggle state | [ ] |

### Hubs Tab

| # | Test | Expected | Status |
|---|------|----------|--------|
| N-48 | Load hubs tab | Header (Hub Categories + count + read-only note) + vertical list | [ ] |
| N-49 | Full-width cards | One card per category, flex-direction: column, not grid | [ ] |
| N-50 | 12px color dot | Correct category color | [ ] |
| N-51 | 3px category-colored left accent | Matches category color | [ ] |
| N-52 | Product badge always shown | Green "PRODUCT" when active, grey when inactive | [ ] |
| N-53 | Vite badge always shown | Blue "VITE" when active, grey when inactive | [ ] |
| N-54 | Card hover highlight | Background shifts | [ ] |
| N-55 | Read-only | No toggles, no inputs, no dragging | [ ] |

### Navbar Save

| # | Test | Expected | Status |
|---|------|----------|--------|
| N-56 | Save (Ctrl+S) | Delta sent: guideChanges + brandChanges + gameChanges + renames + sectionOrder | [ ] |
| N-57 | Guide save → frontmatter | `navbar` field updated in guide `.md` files | [ ] |
| N-58 | Brand save → frontmatter | `categories` + `navbar` + `displayName` written | [ ] |
| N-59 | Game save → frontmatter | `navbar` boolean written | [ ] |
| N-60 | Rename save → frontmatter | Scalar field written (`guide`, `displayName`, `game`/`title`) | [ ] |
| N-61 | Section order → JSON | `navbar-guide-sections.json` updated | [ ] |
| N-62 | brand_categories cleared | Transient dict emptied after save | [ ] |
| N-63 | Response returns fresh payload | Server re-scans frontmatter, clean state returned | [ ] |
| N-64 | navbarChanges reset | Local delta cleared to empty after successful save | [ ] |
| N-65 | Dirty indicator | "unsaved: Navbar" in context bar | [ ] |

### Navbar Preview

| # | Test | Expected | Status |
|---|------|----------|--------|
| N-66 | Preview sends delta only | `{ sectionOrder, brandChanges }` — not full payload | [ ] |
| N-67 | Preview debounced 120ms | Rapid edits coalesce | [ ] |
| N-68 | brand_categories transient set | Server stores `store.brand_categories[slug]` on preview | [ ] |
| N-69 | Stale preview guard | Request ID prevents old responses from overwriting newer state | [ ] |

### Navbar Cross-Panel

| # | Test | Expected | Status |
|---|------|----------|--------|
| N-P1 | Brand drag → Index Heroes brand hero | `brand_categories` pseudo-key: hero pool updates | [ ] |
| N-P2 | Categories color → guides | Column bars, pills, badges update | [ ] |
| N-P3 | Categories color → brands | Column bars, checkboxes, category tags update | [ ] |
| N-P4 | Categories color → hubs | Dot, accent bar, badges update | [ ] |
| N-P5 | Categories label → guides | Pill labels update | [ ] |
| N-P6 | Categories label → brands | Column titles update | [ ] |
| N-P7 | Categories flag → hubs | Product/Vite badges change | [ ] |
| N-P8 | Cascade skipped when dirty | If Navbar has unsaved changes, categories cascade does NOT overwrite | [ ] |

### Navbar Watch

| # | Test | Expected | Status |
|---|------|----------|--------|
| N-W1 | Edit `navbar-guide-sections.json` externally | `versions.nav_sections` bumps, panel refreshes within 2s | [ ] |
| N-W2 | Watch skipped when dirty | If Navbar has unsaved changes, watch does NOT overwrite | [ ] |

---

## Panel 6: Slideshow (Ctrl+6)

### Core Functionality

| # | Test | Expected | Status |
|---|------|----------|--------|
| S-01 | Load panel from bootstrap | Category tabs + sort pills + search + pool (left) + queue (right) | [ ] |
| S-02 | Product pool shows all 366 products | No eligibility filter — every product in data-products appears | [ ] |
| S-03 | Category tabs: config order | Tabs match categories.json order, only categories with products | [ ] |
| S-04 | Category tab filter | Click tab → pool shows only that category's products | [ ] |
| S-05 | "All" tab | Shows all products, accent reverts to site primary | [ ] |
| S-06 | Category accent propagation | Selected category color flows to: active tab underline, active sort pill, accent bar, divider | [ ] |
| S-07 | Sort pills: Score | Pool sorted by overall DESC, brand+model ASC tiebreaker | [ ] |
| S-08 | Sort pills: Release | Pool sorted by year DESC, month DESC, score DESC | [ ] |
| S-09 | Sort pills: Brand | Pool sorted by brand ASC, model ASC | [ ] |
| S-10 | Sort pills: Model | Pool sorted by model ASC | [ ] |
| S-11 | Search filters pool | Brand + model text match, live, case-insensitive | [ ] |
| S-12 | Pool columns | Brand, Model, Cat, Score, Released, $ — grid layout | [ ] |
| S-13 | Pool row accent color | Row inherits category color via `--content-accent` | [ ] |
| S-14 | Queued products dimmed | Products already in queue shown at 0.45 opacity | [ ] |
| S-15 | Drag pool → queue slot | Product placed at drop position | [ ] |
| S-16 | Double-click pool item | Product appended to end of queue | [ ] |
| S-17 | Drag within queue | Item reorders between slot positions | [ ] |
| S-18 | Drag queue → pool | Item removed from queue | [ ] |
| S-19 | × button on queue tile | Item removed from queue | [ ] |
| S-20 | Delete/Backspace on focused tile | Item removed | [ ] |
| S-21 | Up/Down arrows on focused tile | Item swaps with neighbor | [ ] |
| S-22 | Duplicate rejected | Adding product already in queue is a no-op | [ ] |
| S-23 | Queue capacity guard | Cannot exceed maxSlides | [ ] |
| S-24 | Queue tile: slot number | Shows 1-based position number | [ ] |
| S-25 | Queue tile: score badge | `content-dashboard__slot-badge` shows overall score | [ ] |
| S-26 | Queue tile: warning badge | Yellow border + yellow badge text for overall < 8.0 | [ ] |
| S-27 | Queue tile: category badge | Category label in slot-bottom with `--content-accent` color | [ ] |
| S-28 | Queue tile: drag cursor | Filled tiles show grab cursor | [ ] |
| S-29 | Empty slot | Dashed border, "Drop product here" text | [ ] |
| S-30 | Drop target highlight | Blue border + blue tint via `content-dashboard__slot--drop-target` | [ ] |
| S-31 | Auto-fill button | Fills empty slots: deals first, release DESC, score DESC, max 3/cat, ≥ 8.0 | [ ] |
| S-32 | Clear button | Empties entire queue | [ ] |
| S-33 | Max spinner (1–20) | Adjusts slot count, truncates queue if reduced below current length | [ ] |
| S-34 | Status bar right | "{N} products · {M} assigned" | [ ] |
| S-35 | Save (Ctrl+S) | `slideshow.json` updated, toast confirms, version bumps | [ ] |
| S-36 | Dirty indicator | "unsaved: Slideshow" in context bar, clears after save | [ ] |

### Preview & Watch

| # | Test | Expected | Status |
|---|------|----------|--------|
| S-P1 | Preview debounce 120ms | Rapid edits coalesce, server validates slides against product set | [ ] |
| S-P2 | Stale preview guard | Request ID prevents old responses from overwriting newer state | [ ] |
| S-P3 | External `slideshow.json` edit | `versions.slideshow` bumps, panel refreshes within 2s | [ ] |
| S-P4 | Watch skipped when dirty | If slideshow has unsaved changes, watch does NOT overwrite | [ ] |

### Cross-Panel

| # | Test | Expected | Status |
|---|------|----------|--------|
| S-X1 | Categories color → slideshow | Tab colors, accent bar, sort pill active update (via cascade) | [ ] |
| S-X2 | Categories label → slideshow | Tab labels update | [ ] |
| S-X3 | Cascade skipped when dirty | If slideshow has unsaved changes, categories cascade does NOT overwrite | [ ] |

### Pure Editor Unit Tests

| # | Test | Expected | Status |
|---|------|----------|--------|
| S-U1 | `node --test config/tests/test_slideshow_editor.mjs` | 29/29 pass | [ ] |

---

## Global / Cross-Cutting

### Save System

| # | Test | Expected | Status |
|---|------|----------|--------|
| G-01 | Ctrl+S saves active panel first | Active panel priority, then fallback to first dirty | [ ] |
| G-02 | Save while already saving | Blocked by `isSaving` guard | [ ] |
| G-03 | Save with no changes | Toast "No changes to save" | [ ] |
| G-04 | Multi-panel dirty badge | Context bar: "unsaved: Categories · Content · Navbar" | [ ] |
| G-05 | Save clears dirty state | Snapshot ref updated, dirty indicator gone | [ ] |
| G-06 | Save returns fresh shell | `statusRight` timestamp updated in status bar | [ ] |
| G-07 | content.json merge integrity | After Content save: `indexHeroes` preserved. After IH save: `slots/pinned/badges/excluded` preserved | [ ] |

### Watch / File Polling

| # | Test | Expected | Status |
|---|------|----------|--------|
| G-08 | Poll interval | `/api/watch` called every 2 seconds | [ ] |
| G-09 | Version key: categories | Bumps → panel + cascade refresh (content, IH, hub tools, slideshow) | [ ] |
| G-10 | Version key: content | Bumps → both Content AND Index Heroes refresh | [ ] |
| G-11 | Version key: hub_tools | Bumps → Hub Tools refresh | [ ] |
| G-12 | Version key: nav_sections | Bumps → Navbar refresh | [ ] |
| G-12a | Version key: slideshow | Bumps → Slideshow refresh | [ ] |
| G-13 | Watch skips dirty panels | No overwrite of unsaved local changes | [ ] |

### Preview System

| # | Test | Expected | Status |
|---|------|----------|--------|
| G-14 | Debounce 120ms | All preview effects use 120ms setTimeout | [ ] |
| G-15 | Duplicate guard | Preview snapshot compared, skip if unchanged | [ ] |
| G-16 | Stale response guard | Request ID incremented, stale responses discarded | [ ] |
| G-17 | Preview → save → fresh data | Save writes previewed state, response re-scans truth | [ ] |

### Panel Switching & Keyboard

| # | Test | Expected | Status |
|---|------|----------|--------|
| G-18 | Ctrl+1 through Ctrl+9 | Navigate to correct panel | [ ] |
| G-19 | Ctrl+S | Saves current/first-dirty panel | [ ] |
| G-20 | Switch preserves dirty state | Unsaved changes retained when switching away and back | [ ] |
| G-21 | Sub-tab state preserved | Active tab, category filter, scroll position retained | [ ] |

### Bootstrap

| # | Test | Expected | Status |
|---|------|----------|--------|
| G-22 | `/api/bootstrap` returns all panels | shell + categories + content + indexHeroes + hubTools + navbar + slideshow + imageDefaults + cacheCdn + ads | [ ] |
| G-23 | Loading state | Spinner/indicator until bootstrap completes | [ ] |
| G-24 | Snapshot refs initialized | All 6 panels have clean snapshots after bootstrap | [ ] |
| G-25 | Version refs initialized | All 6 version refs set from bootstrap payload | [ ] |

---

## Data Integrity (Post-Save Spot Checks)

| # | Check | How to verify | Status |
|---|-------|---------------|--------|
| I-01 | `categories.json` valid JSON | Parse check | [ ] |
| I-02 | `content.json` valid JSON | Parse check, verify both `slots` and `indexHeroes` present | [ ] |
| I-03 | `hub-tools.json` valid JSON | Parse check, verify `_tooltips` and `_index` present | [ ] |
| I-04 | `navbar-guide-sections.json` valid JSON | Parse check | [ ] |
| I-04a | `slideshow.json` valid JSON | Parse check, verify `maxSlides` and `slides` array present | [ ] |
| I-05 | Guide frontmatter `navbar` | Spot-check 3 guides: value matches section assignment | [ ] |
| I-06 | Brand frontmatter `categories` | Spot-check 3 brands: array matches column assignments | [ ] |
| I-07 | Brand frontmatter `navbar` | Spot-check: subset of `categories` matching checkboxes | [ ] |
| I-08 | Game frontmatter `navbar` | Spot-check 3 games: boolean matches toggle state | [ ] |
| I-09 | Rename propagation | After rename, field value correct in frontmatter file | [ ] |
| I-10 | Section order matches columns | JSON array order matches visual column order | [ ] |

---

## Propagation Chain Summary

```
Categories (SSOT hub)
  ├─ preview cascade → Content      (if not dirty)
  ├─ preview cascade → Index Heroes (if not dirty)
  ├─ preview cascade → Hub Tools    (if not dirty)
  ├─ preview cascade → Navbar       (if not dirty)
  ├─ preview cascade → Slideshow    (if not dirty)
  └─ save clears _hub_tools_preview, _slideshow_preview

Content
  └─ preview cascade → Index Heroes (if not dirty)
      (pinned/badges/excluded affect hero pool)

Navbar
  └─ preview sends brand_categories transient → server
      → Index Heroes reads transient on next payload call

content.json shared ownership:
  Content owns: slots, pinned, badges, excluded
  Index Heroes owns: indexHeroes
  Both merge on save (existing.update pattern)
```
