# Hub Tools Manager — `config/hub-tools-manager.py`

Manages hub sidebar tools configuration for each product category.
Reads/writes `config/hub-tools.json`.

Launch: `python config/hub-tools-manager.py`

## What it configures

Each product category (mouse, keyboard, monitor, + future: headset, mousepad,
controller) has 5 tool types that appear as links in the home page sidebar,
hub index page, and filtered hub views:

| Tool Type | URL Pattern | Purpose |
|-----------|-------------|---------|
| Hub | `/hubs/{cat}` | Main hub page — browse and compare |
| Database | `/hubs/{cat}?view=list` | Full product database list |
| Versus | `/hubs/{cat}?compare=stats` | Side-by-side spec comparison |
| Radar | `/hubs/{cat}?compare=radar` | Radar chart comparison |
| Shapes | `/hubs/{cat}?compare=shapes` | Mouse shape overlay (mouse only) |

## Two Tabs

### Home Tab

Configures individual tool entries per category.

**Sidebar:** Category list (dimmed for future/inactive categories).
Click to switch which category's tools are shown.

**Tool Cards:** Each tool has editable fields:
- **Title** — display name
- **URL** — link target
- **Description** — tooltip/card text
- **Subtitle** — secondary text
- **Hero Image** — path for hub page hero (`/images/tools/{cat}/{tool}/hero-img`)
- **Navbar** toggle — whether this tool shows in the navbar mega menu
- **SVG** — inline SVG icon markup (edit via dedicated SVG editor dialog)
- **Enabled** toggle — on/off (disabled tools are grayed everywhere)

**Shared Tooltips:** Edit button opens dialog for tool type descriptions shown
on hover across all categories.

### Index Tab

Configures the `/hubs/` dashboard page — which 6 tools appear in the featured
grid and in what order.

**View Selector (left sidebar):**
- **All** — pool shows all tool types from all categories
- **Hub** — pool shows only hub-type tools
- **Database** — pool shows only database-type tools
- **Versus / Radar / Shapes** — same pattern

Each view has its own independent 6-slot arrangement.

**Slots (3x2 grid):**
- Start blank (grey)
- Drag a tool from the unassigned pool into a slot
- Slot takes the category color of the tool placed in it
- Shows category label, tool type, title, description, icon
- Remove button (x) to clear a slot
- Disabled tools show "OFF" badge but are still assignable

**Unassigned Pool (right):**
- Shows all tools matching the current view that aren't in any slot
- Disabled tools appear grayed with "(off)" suffix
- Drag from pool to slot to assign

**Auto-fill:** Empty slots are filled automatically at page build time from
remaining tools. Explicit slot assignments take priority.

## Data Model — `config/hub-tools.json`

```json
{
  "mouse": [
    {
      "tool": "hub",
      "title": "Hub",
      "description": "Explore and compare over 500 gaming mouse",
      "subtitle": "Your One-Stop Mouse Hub",
      "url": "/hubs/mouse",
      "svg": "<svg ...>...</svg>",
      "enabled": true,
      "navbar": true,
      "heroImg": "/images/tools/mouse/hub/hero-img"
    }
    // ... 4 more tools (database, versus, radar, shapes)
  ],
  "keyboard": [ /* 5 tools */ ],
  "monitor": [ /* 5 tools */ ],
  "_tooltips": {
    "hub": "Your one-stop comparison hub...",
    "database": "The full spec database...",
    "versus": "Side-by-side comparisons...",
    "radar": "Multi-axis radar charts...",
    "shapes": "Overlay mouse shapes..."
  },
  "_index": {
    "all": ["keyboard:hub", "monitor:hub", "mouse:hub"],
    "hub": [],
    "database": [],
    "versus": [],
    "radar": [],
    "shapes": []
  }
}
```

### `_index` format

Keys are **view names** (not categories). Values are ordered arrays of
`"category:tool_type"` strings representing slot assignments.

- `"all"` view: featured tools on the main `/hubs/` page
- `"hub"` view: featured tools when filtering by hub type
- Empty array = all 6 slots auto-fill at build time
- Array shorter than 6 = explicit slots first, remaining auto-fill

### Key prefixes

- `_tooltips` — shared tooltip text (not a category)
- `_index` — dashboard slot assignments (not a category)
- Everything else is a category ID with an array of tool entries

## Category Filtering

Uses filesystem scanning (not JSON flags) to determine which categories to show.
See [CATEGORY-TYPES.md](./CATEGORY-TYPES.md).

- **Content-only** categories (hardware, game, gpu, ai) are excluded entirely
- **Active product** categories (mouse, keyboard, monitor) show with full color
- **Future product** categories (headset, mousepad, controller) show dimmed,
  all tools disabled by default

## `ensure_defaults()`

On launch, auto-creates missing tool entries for any category that doesn't have
all 5 tool types. Defaults:

- Future/inactive categories: all tools `enabled: false`
- Shapes tool: `enabled: false` for all categories except mouse
- Hub tool: `navbar: true` by default, all others `navbar: false`
