# Config Tools — Rules & Conventions

Mandatory standards for the unified EG Config Manager (`config/eg-config.pyw`)
and all panels within it.

---

## Window & Layout

| Property | Value | Notes |
|----------|-------|-------|
| Window size | **1536 x 864** | No exceptions |
| Centered | `center_window(self, 1536, 864)` | Screen-centered on launch |
| Min size | 1100x700 | |
| DPI awareness | `SetProcessDpiAwareness(1)` | Called before any Tk creation |
| Dark title bar | `DwmSetWindowAttribute(hwnd, 20, 1)` | Windows only, wrapped in try/except |
| Window icon | 32x32 solid pixel in accent color | `make_icon(accent)` |

## Mega-App Layout

```
┌──────────────────────────────────────────────────────────────────────┐
│ EG Config Manager (title bar)                                        │
├────────────┬─────────────────────────────────────────────────────────┤
│  Logo area │  Context Bar (48px)                                     │
│  (56px)    │  Breadcrumb · Ctrl+N hint · [unsaved badge] [Save]     │
│────────────│─────────────────── accent border (2px) ─────────────────│
│            │                                                         │
│  Sidebar   │              Content Area                               │
│  (200px)   │       (active panel fills this)                         │
│  C.CRUST   │              C.MANTLE                                   │
│            │                                                         │
│  9 nav     │                                                         │
│  items     │                                                         │
│            │                                                         │
│────────────│                                                         │
│ Project    │                                                         │
│ name       │                                                         │
├────────────┴─────────────────────────────────────────────────────────┤
│ Status Bar (32px) — C.CRUST                                          │
└──────────────────────────────────────────────────────────────────────┘
```

### Sidebar (200px, `C.CRUST`)

| Element | Spec |
|---------|------|
| Logo area | 56px height, "EG" 18pt bold in accent + "Config" 12pt `C.TEXT` |
| Nav items | 42px height each, icon (13pt) + label (`F.BODY`) |
| Active state | `C.SURFACE0` bg, accent-colored indicator bar (3px left edge), accent icon, `C.TEXT` label |
| Inactive state | `C.CRUST` bg, `C.OVERLAY0` icon, `C.SUBTEXT0` label |
| Hover | `C.SURFACE1` bg (inactive items only) |
| Accent stripe | 2px vertical line between sidebar and content |
| Bottom info | Project name in `F.TINY`, `C.OVERLAY0` |

### Context Bar (48px, `C.CRUST`)

| Element | Spec |
|---------|------|
| Breadcrumb | `F.HEADING`, `C.TEXT` — shows active panel name |
| Shortcut hint | `F.TINY`, `C.OVERLAY0` — "Ctrl+1" through "Ctrl+9" |
| Changes badge | `F.SMALL`, `C.PEACH` — global across ALL panels |
| Save button | `F.BODY_BOLD`, bg = accent, fg = `C.CRUST` |
| Bottom border | 2px, accent color |

### Status Bar (32px, `C.CRUST`)

```python
bar = tk.Frame(self, bg=C.CRUST, height=32)
bar.pack(fill="x", side="bottom")
bar.pack_propagate(False)
```

---

## Accent Colors — NEVER Hardcode

### The rule

> **Every accent element (sidebar indicator, context bar border, "EG" label,
> save button, count badges, card accent bars, dialog action buttons, drag ghost)
> MUST use the live site primary color from `categories.json` — NEVER `C.BLUE`
> or any other hardcoded Catppuccin color.**

`C.BLUE` is only acceptable for:
- `selectbackground` on listboxes (UI selection highlight)
- `highlightcolor` on entry fields (input focus ring)

These are framework-level UI feedback, not theme accent.

### How accent loads and propagates

The mega-app reads accent from `ConfigStore.site_accent` (derived from
`categories.json` `siteColors.primary`). When the Categories panel changes the
site primary color:

1. Categories calls `store.preview(CATEGORIES, data)` — immediate, no disk write
2. Store rebuilds `site_accent`, `cat_colors`, etc.
3. Store fires all `CATEGORIES` subscribers
4. `MegaConfig._refresh_accent()` updates sidebar, context bar, save button, icon
5. All other panels' `_on_categories_change()` update their category-derived UI

**No restart needed.** Color changes propagate live across the entire app.

### Category colors

Per-category colors are accessed via `app.store.cat_colors`:
```python
color = self._app.store.cat_colors.get(cat_id, self._app.store.site_accent)
```

---

## Design System — Catppuccin Mocha

All panels share identical `C` and `F` token classes from `lib/shared.py`.

### Color tokens (`class C`)

| Token | Hex | Usage |
|-------|-----|-------|
| `BASE` | `#11111b` | Deepest background |
| `MANTLE` | `#181825` | Main window bg, content area |
| `CRUST` | `#0d0d12` | Sidebar, context bar, status bar |
| `SURFACE0` | `#1e1e2e` | Card bg, active sidebar item |
| `SURFACE1` | `#313244` | Input bg, button default, sidebar hover |
| `SURFACE2` | `#45475a` | Button hover, separators |
| `OVERLAY0` | `#6c7086` | Muted text, labels |
| `OVERLAY1` | `#7f849c` | Slightly brighter muted |
| `TEXT` | `#cdd6f4` | Primary text |
| `SUBTEXT0/1` | `#a6adc8/#bac2de` | Secondary text |
| `GREEN` | `#a6e3a1` | Toggle on, success toast |
| `PEACH` | `#fab387` | Unsaved changes, warnings |
| `RED` | `#f38ba8` | Delete buttons, errors |
| `DROP` | `#2a2b3d` | Drop target highlight |
| `CARD_BORDER` | `#252538` | Card border |

### Font tokens (`class F`)

| Token | Spec | Usage |
|-------|------|-------|
| `TITLE` | Segoe UI 18 bold | Unused in headers (too big) |
| `HEADING` | Segoe UI 13 bold | Context bar breadcrumb |
| `SUBHEADING` | Segoe UI 11 | Section headings within panels |
| `BODY` | Segoe UI 10 | Default text, inputs |
| `BODY_BOLD` | Segoe UI 10 bold | Card titles, save button, nav labels |
| `SMALL` | Segoe UI 9 | Labels, change indicator |
| `TINY` | Segoe UI 8 | Counts, tooltips, shortcut hints |

---

## Shared Widgets

All panels use the same widget classes from `lib/shared.py`. Do not diverge.

| Widget | Purpose | Key behavior |
|--------|---------|-------------|
| `Toggle` | iOS-style pill switch | 38x20 or 46x24. `C.GREEN` when on. |
| `FlatBtn` | Flat label-as-button | Hover/press feedback. Takes `bg`, `hover_bg`, `command`. |
| `Toast` | Notification overlay | Positioned at bottom-center, auto-hides after `ms`. |
| `Tip` | Hover tooltip | Toplevel window, wraplength 280, appears below widget. |
| `HoverListbox` | Listbox with hover | Per-row highlight. `_global_drag` suppresses during drag. |
| `ColorPicker` | Full color picker dialog | SV gradient + hue strip + hex/RGB + presets + derived preview. |

---

## Drag-and-Drop

Drag-and-drop is a **preferred interaction pattern** — use it for any
assignment/ordering task where it makes sense.

### Architecture

```
ButtonPress-1   → _drag_start()    # Record source widget/item, create ghost
B1-Motion       → _drag_motion()   # Move ghost to cursor position
ButtonRelease-1 → _drag_drop()     # Hit test, apply change, cleanup
                  _drag_cleanup()   # Destroy ghost, reset state (always runs)
```

### Ghost window

```python
g = tk.Toplevel(self)
g.overrideredirect(True)
g.attributes("-alpha", 0.9)
g.configure(bg=accent)  # use accent color, not hardcoded
```
Offset: +14px right, -10px up from cursor.

### Rules

1. Ghost color = **accent color** (site primary or category color as appropriate)
2. No drag between tabs — only within a single tab
3. After drop, **rebuild the entire view** to reflect new state
4. Toast on invalid operations (duplicates, etc.)
5. Changes are in-memory only until `Ctrl+S` saves
6. `_drag_cleanup()` always runs — prevents orphaned ghost windows
7. `HoverListbox._global_drag` suppresses hover during drag

### Current implementations

| Panel | Tab | Source -> Target | Action |
|-------|-----|------------------|--------|
| Navbar | Guides | Pool -> Section | Assign guide to section |
| Navbar | Guides | Section -> Section | Move guide between sections |
| Navbar | Brands | All Brands -> Category | Add to brand's `categories` + `navbar` |
| Navbar | Brands | Category -> All Brands | Remove from brand's `categories` + `navbar` |
| Hub Tools | Index | Pool -> Slot (1-6) | Assign tool to dashboard slot |

---

## Data Flow & Save Behavior

### Reactive store — ConfigStore

All panels read and write through `ConfigStore`. No direct JSON file I/O.

```python
# Read
data = app.store.get(ConfigStore.SLIDESHOW)

# Live preview (in-memory only, fires subscribers)
app.store.preview(ConfigStore.CATEGORIES, updated_data)

# Save to disk (fires subscribers)
app.store.save(ConfigStore.SLIDESHOW, data)
```

### Global save (Ctrl+S)

1. Collect all panels where `has_changes()` is True
2. Pause file watcher (supports nested depth)
3. Call `save()` on each dirty panel
4. Resume file watcher
5. Show consolidated toast listing saved panels
6. Update global changes badge

### Unsaved changes badge (global)

The context bar badge reflects ALL panels, not just the active one:
- `unsaved: Categories` — one dirty panel
- `unsaved: 3 panels` — multiple dirty panels

### Live propagation (preview + pseudo-keys)

Categories panel broadcasts every change (color, label, toggle) via
`store.preview()` BEFORE save. All downstream panels update immediately:

| Change in Categories | Downstream effect |
|---------------------|-------------------|
| Site primary color | All panels: accent refresh. Mega-app: sidebar, context bar, save button |
| Category color | All panels: category pills, card accents, filter badges |
| Category label/plural | All panels: display names in pills, cards, lists |
| Product/content toggle | Content: active flags. Hub Tools: category list. Slideshow: pool filter |

Text entry changes (label/plural) are debounced at 300ms. Color picks and
toggles broadcast immediately.

**Pseudo-keys** extend live propagation beyond Categories. Panels can broadcast
unsaved changes via `store.notify("key_name")` where the key is not a file-backed
ConfigStore key. Subscribers call `store.subscribe("key_name", callback)`.

| Pseudo-key | Publisher | Subscriber | Purpose |
|---|---|---|---|
| `"brand_categories"` | Navbar | Index Heroes | Brand category drag/drop → hero preview |
| `"content_editorial"` | Content | Index Heroes | Pin/badge/exclude → hero preview |

**Rule:** Any panel that edits state consumed by another panel's preview MUST
broadcast via `store.notify()` on every in-memory change. Never rely on tab
switch alone for cross-panel accuracy.

### Filesystem scanning (read-only)

Some panels scan content directories at init to auto-detect categories, count
articles/products, and determine category type. This is read-only — panels never
modify content files except for Navbar writing frontmatter fields.

---

## Category Type Detection

The filesystem is the source of truth for what TYPE a category is.
JSON flags (`product.production`, `content.vite`, etc.) control route visibility,
not category type.

| Has `data-products/` folder? | Has articles? | Type |
|------------------------------|---------------|------|
| YES | YES | Product + Content |
| YES | NO | Product only |
| NO | YES | Content only |
| NO | NO | Inactive / manual |

See [CATEGORY-TYPES.md](./CATEGORY-TYPES.md) for full details.

---

## Adding a New Panel

Follow these rules exactly:

1. **Panel class**: `tk.Frame` subclass, `__init__(self, parent, app)`
2. **Background**: `bg=C.MANTLE`
3. **Store access**: Use `app.store.get(KEY)` to load, `app.store.save(KEY, data)` to persist
4. **Subscribe**: `app.store.subscribe(KEY, self._on_external_change)` for own data
5. **Categories refresh hook**: implement `_on_categories_change()` when the panel has category-derived UI; `eg-config.pyw` dispatches that hook centrally
6. **has_changes()**: Compare current state against snapshot (JSON dump comparison)
7. **save()**: Write via `store.save()`, return True if saved
8. **refresh()**: Reload from store, reset snapshot, rebuild UI
9. **Accent**: Always from `app.store.site_accent`, never hardcoded
10. **Register**: Add to `_NAV_ITEMS` and `_import_panel_class()` in `eg-config.pyw`

---

## Detailed Tool Docs

- [panels/categories.md](./panels/categories.md) — Categories panel
- [panels/navbar.md](./panels/navbar.md) — Navbar panel
- [panels/hub-tools.md](./panels/hub-tools.md) — Hub Tools panel
- [panels/ads.md](./panels/ads.md) — Ads panel
- [panels/image-defaults.md](./panels/image-defaults.md) — Image Defaults panel
- [DRAG-DROP-PATTERN.md](./DRAG-DROP-PATTERN.md) — Full drag-and-drop architecture reference
- [CATEGORY-TYPES.md](./CATEGORY-TYPES.md) — Product vs Content filesystem detection
- [category-colors.md](../../docs/08-design-system/category-colors.md) — CSS variable derivation, seasonal theming, icon conventions
