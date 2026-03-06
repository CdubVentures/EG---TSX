# Phase C: GUI Overhaul

> **Parent plan:** `../../AD-STACK-PLAN.md`
> **Status:** NOT STARTED
> **Prerequisite:** Phase B complete (inline config tab depends on inline system existing)
> **Effort:** Medium-Large — mostly GUI code in `ads-manager.pyw`, no site logic changes
> **Scope:** Transform the single-panel ads-manager into a 5-tab ad operations dashboard

---

## Overview

The current `ads-manager.pyw` is functional but minimal (483 lines, single panel). This phase transforms it into a comprehensive ad management tool with:

1. **Tabbed interface** via `ttk.Notebook`
2. **Enhanced Placements tab** (search, section collapse, size preview, presets, bulk ops)
3. **Page Map tab** (visual schematic of ad placements per page type)
4. **Inline Ads Config tab** (per-collection cadence editor — already built in B.8)
5. **Direct Sponsors tab** (creative management with rotation preview)
6. **Dashboard tab** (future — post-launch analytics placeholder)

**GUI is Tkinter/ttkbootstrap with Catppuccin Mocha theme** — no new dependencies.

---

## C.1 — Add Tabbed Interface (ttk.Notebook)

**Goal:** Replace the single-panel layout with a tabbed interface. Existing placement list+detail becomes Tab 1.

**Implementation:**
```python
# Replace the current single-panel layout with:
notebook = ttk.Notebook(root)
notebook.pack(fill='both', expand=True)

tab_placements = ttk.Frame(notebook)
tab_page_map   = ttk.Frame(notebook)
tab_inline     = ttk.Frame(notebook)
tab_sponsors   = ttk.Frame(notebook)
tab_dashboard  = ttk.Frame(notebook)

notebook.add(tab_placements, text='  Placements  ')
notebook.add(tab_page_map,   text='  Page Map  ')
notebook.add(tab_inline,     text='  Inline Config  ')
notebook.add(tab_sponsors,   text='  Sponsors  ')
notebook.add(tab_dashboard,  text='  Dashboard  ')
```

**Migration:**
- Move all existing left-panel (list) and right-panel (detail) widgets into `tab_placements`
- Global settings bar (AdSense client, ad label, toggles) stays at the TOP of the window, above the notebook — shared across all tabs
- Status bar stays at the BOTTOM of the window, below the notebook
- Save button applies to whichever tab is active (each tab tracks its own dirty state)

**Test:** Open GUI. Tab 1 ("Placements") shows identical behavior to current single-panel view. All other tabs show placeholder content.

**File:** `config/ads-manager.pyw`

---

## C.2 — Enhance Placements Tab (Tab 1)

**Goal:** Add quality-of-life features to the existing placement list+detail panel.

### C.2a — Section Collapse/Expand

**What:** Click a section header (e.g., "Inline", "Home Rail") to collapse/expand its placement list.

**Implementation:**
- Track collapsed state per section in a dict: `self.collapsed_sections: dict[str, bool]`
- On click, toggle visibility of all placement items under that section
- Visual indicator: `▼` (expanded) / `►` (collapsed) prefix on section header
- Collapsed state is NOT persisted — always starts expanded

**Test:** Click "Sidebar" section header → its 5 placements hide. Click again → they reappear.

### C.2b — Search/Filter Bar

**What:** Text input above the placement list that filters placements by name.

**Implementation:**
- `ttk.Entry` with placeholder text "Filter placements..."
- On each keystroke, filter the Treeview to show only placements whose name contains the search text (case-insensitive)
- Clear button (×) to reset filter
- Section headers still show if they contain matching placements

**Test:** Type "rail" → only "home-rail-top", "home-rail-body-1", etc. show. Clear → all show.

### C.2c — Size Preview

**What:** In the detail panel, show visual rectangles drawn to scale representing each ad size.

**Implementation:**
- Small Tkinter Canvas (200px wide) in the detail panel
- For each size in the placement's `sizes` list, draw a scaled rectangle
- Label each rectangle with its dimensions
- Scale factor: fit largest dimension to 180px, scale others proportionally
- Highlight the largest size (used for CLS reservation) with a different border color

**Test:** Select "inline-ad" (sizes: 970x250, 728x90, 336x280, 300x250, 320x100, 320x50) → canvas shows 6 nested rectangles.

### C.2d — Size Presets Dropdown

**What:** Quick-add buttons for common IAB standard sizes.

**Implementation:**
- Dropdown/combobox with preset names:
  - "Leaderboard" → 728x90
  - "Medium Rectangle" → 300x250
  - "Large Rectangle" → 336x280
  - "Half Page" → 300x600
  - "Billboard" → 970x250
  - "Mobile Banner" → 320x50
  - "Mobile Leaderboard" → 320x100
  - "Large Mobile" → 320x480
  - "Skyscraper" → 300x400
- Selecting a preset adds it to the current placement's sizes (if not already present)

**Test:** Select "Half Page" → "300x600" appears in the sizes list. Select again → no duplicate.

### C.2e — Notes Field

**What:** Free-text notes per placement, persisted in `ads-registry.json`.

**Implementation:**
- `ttk.Text` widget (3 lines) at the bottom of the detail panel
- Stored as `"notes": "..."` in each placement object in the JSON
- Zod schema: `notes: z.string().optional()` (add to existing schema in `config.ts`)

**Test:** Add a note "This placement is for long-form reviews only". Save. Reload. Note persists.

### C.2f — Duplicate Placement Button

**What:** Button that copies the selected placement's config with a new name.

**Implementation:**
- Prompt for new campaign name (dialog)
- Deep-copy all fields from selected placement
- Add to same section as original
- Auto-select the new placement

**Test:** Duplicate "sidebar-right-top" as "sidebar-right-bottom" → new placement appears with identical config.

### C.2g — Usage Reference

**What:** Shows which `.astro` files reference this campaign name.

**Implementation:**
- "Find Usages" button in detail panel
- On click, runs `grep -r "campaign=\"{name}\"" src/` (or equivalent Python search)
- Results displayed in a small list: file path + line number
- Click a result → copies the path to clipboard

**Test:** Click "Find Usages" on "home-rail-top" → shows `src/pages/index.astro:42` (or wherever it's used).

**Files:** `config/ads-manager.pyw`

---

## C.3 — Page Map Tab (Tab 2)

**Goal:** Visual schematic view showing ad placements on each page type.

**Config file:** `config/data/ads-page-map.json`

```json
{
  "pages": {
    "home": {
      "label": "Home Page",
      "zones": [
        { "campaign": "hero-right",       "x": 75, "y": 5,  "w": 20, "h": 15, "label": "Hero Right" },
        { "campaign": "hero-left",        "x": 5,  "y": 5,  "w": 20, "h": 15, "label": "Hero Left" },
        { "campaign": "home-rail-top",    "x": 75, "y": 25, "w": 20, "h": 12, "label": "Rail Top" },
        { "campaign": "home-rail-body-1", "x": 75, "y": 40, "w": 20, "h": 12, "label": "Rail Body 1" },
        { "campaign": "home-rail-body-2", "x": 75, "y": 55, "w": 20, "h": 12, "label": "Rail Body 2" },
        { "campaign": "home-rail-body-3", "x": 75, "y": 70, "w": 20, "h": 12, "label": "Rail Body 3" },
        { "campaign": "footer-left",      "x": 5,  "y": 88, "w": 20, "h": 8,  "label": "Footer L" },
        { "campaign": "footer-right",     "x": 75, "y": 88, "w": 20, "h": 8,  "label": "Footer R" }
      ]
    },
    "article": {
      "label": "Article Page",
      "zones": [
        { "campaign": "sidebar-right-top",  "x": 75, "y": 10, "w": 20, "h": 12, "label": "Sidebar Top" },
        { "campaign": "sidebar-right-mid",  "x": 75, "y": 30, "w": 20, "h": 18, "label": "Sidebar Mid", "sticky": true },
        { "campaign": "inline-ad",          "x": 10, "y": 25, "w": 55, "h": 6,  "label": "Inline 1", "type": "inline" },
        { "campaign": "inline-ad",          "x": 10, "y": 50, "w": 55, "h": 6,  "label": "Inline 2", "type": "inline" },
        { "campaign": "inline-ad",          "x": 10, "y": 75, "w": 55, "h": 6,  "label": "Inline 3", "type": "inline" },
        { "campaign": "footer-left",        "x": 5,  "y": 88, "w": 20, "h": 8,  "label": "Footer L" },
        { "campaign": "footer-right",       "x": 75, "y": 88, "w": 20, "h": 8,  "label": "Footer R" }
      ]
    },
    "hub": {
      "label": "Hub Page",
      "zones": [
        { "campaign": "type-dashboard-rail",      "x": 75, "y": 10, "w": 20, "h": 15, "label": "Dashboard Rail" },
        { "campaign": "type-dashboard-rail-1row",  "x": 75, "y": 30, "w": 20, "h": 12, "label": "Rail 1-Row" },
        { "campaign": "footer-left",               "x": 5,  "y": 88, "w": 20, "h": 8,  "label": "Footer L" },
        { "campaign": "footer-right",              "x": 75, "y": 88, "w": 20, "h": 8,  "label": "Footer R" }
      ]
    },
    "snapshot": {
      "label": "Snapshot Page",
      "zones": [
        { "campaign": "moreof-rail",   "x": 75, "y": 10, "w": 20, "h": 15, "label": "More-Of Rail" },
        { "campaign": "snap-rail-one", "x": 75, "y": 30, "w": 20, "h": 15, "label": "Snap Rail 1" },
        { "campaign": "snap-rail-two", "x": 75, "y": 50, "w": 20, "h": 18, "label": "Snap Rail 2" },
        { "campaign": "footer-left",   "x": 5,  "y": 88, "w": 20, "h": 8,  "label": "Footer L" },
        { "campaign": "footer-right",  "x": 75, "y": 88, "w": 20, "h": 8,  "label": "Footer R" }
      ]
    },
    "index": {
      "label": "Index Page",
      "zones": [
        { "campaign": "site-index-rail",     "x": 75, "y": 10, "w": 20, "h": 18, "label": "Index Rail" },
        { "campaign": "sidebar-right-index2","x": 75, "y": 32, "w": 20, "h": 12, "label": "Index Rail 2" },
        { "campaign": "sidebar-right-index3","x": 75, "y": 48, "w": 20, "h": 18, "label": "Index Rail 3" },
        { "campaign": "sidebar-right-index4","x": 75, "y": 70, "w": 20, "h": 18, "label": "Index Rail 4" },
        { "campaign": "footer-left",          "x": 5,  "y": 88, "w": 20, "h": 8,  "label": "Footer L" },
        { "campaign": "footer-right",         "x": 75, "y": 88, "w": 20, "h": 8,  "label": "Footer R" }
      ]
    }
  }
}
```

**Canvas implementation:**
- Tkinter `Canvas` widget (600x450)
- Page type selector: row of buttons at top (Home, Hub, Snapshot, Article, Index)
- Background: dark rectangle representing the page
- Content area: lighter rectangle representing the main content zone
- Ad zones: colored rectangles with:
  - Fill color: green (enabled), red (disabled), orange (GPT/not configured), blue (direct/has creatives)
  - Border: white 1px
  - Label: campaign name + largest size
  - Status dot: same color coding as fill
- Click handler: clicking a zone switches to Tab 1 (Placements) with that campaign pre-selected
- Hover tooltip: shows full placement details (provider, all sizes, display status)

**Content areas** (non-ad zones drawn as context):
- Page header (dark bar at top)
- Main content area (lighter rectangle)
- Sidebar (darker strip on right)
- Footer (dark bar at bottom)
- Labels: "HEADER", "CONTENT", "SIDEBAR", "FOOTER" in muted text

**Test:** Select "Article" page type. 7 zones render. Click "Sidebar Top" zone → switches to Placements tab with "sidebar-right-top" selected.

**Files:**
- `config/data/ads-page-map.json` (new)
- `config/ads-manager.pyw`

---

## C.4 — Inline Ads Config Tab (Tab 3)

**Goal:** Integrate the inline ads configuration editor built in Phase B.8 into the tabbed interface.

**What:** If B.8 was built as a standalone panel, wire it into Tab 3 of the notebook. If B.8 already used the notebook, this step is a no-op.

**Features (recap from B.8):**
- Collection selector dropdown (Reviews, Guides, News, Games, Brands, Pages)
- Enabled toggle per collection
- Desktop cadence fields: firstAfter, every, max (spinbox inputs)
- Mobile cadence fields: firstAfter, every, max (spinbox inputs)
- Word scaling section: enabled toggle, desktopWordsPerAd, mobileWordsPerAd, minFirstAdWords
- Preview calculator: "For a [____]-word article: Desktop: N ads, Mobile: M ads"
- Collection status bar: "Reviews . | Guides . | News . | Games x | Brands x | Pages x"

**Reads/writes:** `config/data/inline-ads-config.json`

**Test:** Change reviews desktop `every` from 5 to 6. Save. Reopen. Value persists. Preview calculator updates.

**File:** `config/ads-manager.pyw`

---

## C.5 — Direct Sponsors Tab (Tab 4)

**Goal:** Creative management interface for direct sponsor campaigns.

**Prerequisite:** Phase E.1 (sponsor schema + config file) — but the GUI tab can be scaffolded with mock data first.

**Layout:**
```
+---------------------------------------------------+
| Placement: [hero-left v]  Provider: direct         |
+---------------------------------------------------+
|                                                     |
| CREATIVES                     | PREVIEW             |
| +---------------------------+ | +-----------------+ |
| | 1. Razer Sponsor (40%)    | | |                 | |
| |    2026-01-01 > 2026-06-30| | |  [Image of      | |
| |    [Active]               | | |   selected      | |
| |                           | | |   creative]     | |
| | 2. SteelSeries (35%)     | | |                 | |
| |    2026-03-01 > 2026-03-31| | |  300 x 400      | |
| |    [Active]               | | |                 | |
| |                           | | |  Click URL:     | |
| | 3. HyperX Bundle (25%)   | | |  razer.com/...  | |
| |    2026-04-01 > 2026-12-31| | |                 | |
| |    [Scheduled]            | | +-----------------+ |
| +---------------------------+ |                     |
|                                                     |
| [+ Add Creative] [Edit] [Delete] [Adjust Weights]  |
+---------------------------------------------------+
| Weight Distribution: [====40%====|===35%===|=25%=]  |
+---------------------------------------------------+
```

**Placement selector:**
- Dropdown filtered to only show placements with `provider: "direct"` in the registry
- If no direct placements exist, show message: "No direct-provider placements. Change a placement's provider to 'direct' in the Placements tab."

**Creative list (left panel):**
- Treeview with columns: Label, Weight%, Date Range, Status
- Status logic:
  - **Active**: today is between start and end dates
  - **Scheduled**: start date is in the future
  - **Expired**: end date is in the past
- Color coding: Active=green text, Scheduled=blue text, Expired=red/dimmed text
- Select a creative → preview panel updates

**Preview panel (right panel):**
- Image preview: load from `images/ads/` path or URL
- Size label: "300 x 400"
- Click-through URL display
- `rel` attribute display (default: "nofollow sponsored noopener")

**Add/Edit dialog:**
- Fields: label, image path, href, width, height, weight, start date, end date, rel, alt text
- Image browser: button to pick from `images/ads/` directory
- Date fields: `YYYY-MM-DD` text entry with basic validation

**Weight adjustment:**
- Visual bar showing weight distribution across all creatives
- Warning if weights don't sum to 100 (show: "Weights sum to 75. Normalize?")
- "Normalize" button: proportionally adjusts all weights to sum to 100

**Reads/writes:** `config/data/direct-sponsors.json`

**Test:** Add a creative with weight 50. Add another with weight 50. Verify weight bar shows 50/50. Change first to 60. Warning: "Weights sum to 110." Click Normalize → 55/45. Save. Reload. Values persist.

**File:** `config/ads-manager.pyw`

---

## C.6 — Bulk Operations

**Goal:** Section-level enable/disable and other bulk actions.

### C.6a — Section-Level Toggle

**What:** Right-click a section header → context menu with "Enable All" / "Disable All".

**Implementation:**
- Right-click handler on section headers in the Placements tab
- Context menu with:
  - "Enable All in {section}" — sets `display: true` on all placements in the section
  - "Disable All in {section}" — sets `display: false` on all placements in the section
- Alternatively: a toggle icon (eye/eye-off) on the section header row itself

**Test:** Right-click "Sidebar" header → "Disable All" → all 5 sidebar placements show as disabled. Save. Reload. All 5 are disabled.

### C.6b — Export/Import

**What:** Export current configuration as a JSON file. Import a previously exported config.

**Implementation:**
- "Export Config" in File menu → saves current `ads-registry.json` content to a user-chosen location
- "Import Config" in File menu → loads a JSON file, validates with Zod schema, replaces current config
- Confirmation dialog on import: "This will replace all current placement settings. Continue?"

**Test:** Export. Change a few values. Import the export. Values revert to exported state.

**File:** `config/ads-manager.pyw`

---

## C.7 — Dashboard Tab (Tab 5) — Placeholder

**Goal:** Reserve Tab 5 for post-launch analytics. Build only the shell now.

**Content (placeholder):**
- Message: "Dashboard will be available after ads go live."
- Placeholder sections (greyed out):
  - "Total Impressions" — 0
  - "Fill Rate" — N/A
  - "Revenue (estimated)" — $0.00
  - "CLS Score" — N/A
- "Connect AdSense API" button (disabled, tooltip: "Available post-launch")

**Why build the placeholder:** It establishes the tab structure and communicates the roadmap. When analytics data becomes available (Phase G), the widgets get wired up.

**File:** `config/ads-manager.pyw`

---

## Dependency Graph

```
C.1 (tabbed interface)
  |
  +---> C.2 (enhance placements tab)
  |
  +---> C.3 (page map tab)
  |
  +---> C.4 (inline config tab) -- depends on B.8
  |
  +---> C.5 (sponsors tab) -- depends on E.1
  |
  +---> C.6 (bulk operations) -- depends on C.2
  |
  +---> C.7 (dashboard placeholder)
```

C.1 must be done first. C.2–C.5 and C.7 can be built in any order after C.1. C.6 depends on C.2.

---

## Estimated Line Count

Current: 483 lines.
After overhaul: ~1,100–1,300 lines (Tab 1 enhancements ~200, Page Map ~250, Inline Config ~150, Sponsors ~200, Dashboard ~50, tabbed infrastructure ~50).

---

## Checklist

- [ ] C.1 — Tabbed interface with ttk.Notebook
- [ ] C.2a — Section collapse/expand
- [ ] C.2b — Search/filter bar
- [ ] C.2c — Size preview canvas
- [ ] C.2d — Size presets dropdown
- [ ] C.2e — Notes field per placement
- [ ] C.2f — Duplicate placement button
- [ ] C.2g — Usage reference (grep)
- [ ] C.3 — Page Map tab with canvas + zones
- [ ] C.4 — Inline Ads Config tab (integrate B.8)
- [ ] C.5 — Direct Sponsors tab with creative management
- [ ] C.6a — Section-level enable/disable
- [ ] C.6b — Export/import config
- [ ] C.7 — Dashboard placeholder tab
