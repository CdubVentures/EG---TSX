# Config Tools — Rules & Conventions

Mandatory standards for all three GUI managers (`category-manager.pyw`,
`navbar-manager.pyw`, `hub-tools-manager.pyw`) and any future config tools.

---

## Window & Layout

| Property | Value | Notes |
|----------|-------|-------|
| Window size | **1536 x 864** | All tools, no exceptions |
| Centered | `+{(sw-win_w)//2}+{(sh-win_h)//2}` | Screen-centered on launch |
| Min size | Tool-specific, but at least 900x600 | |
| DPI awareness | `SetProcessDpiAwareness(1)` | Called before any Tk creation |
| Dark title bar | `DwmSetWindowAttribute(hwnd, 20, 1)` | Windows only, wrapped in try/except |
| Window icon | 32x32 solid pixel in accent color | `ico.put(accent_color)` then `.zoom(32,32)` |

## Header Bar (38px — all tools)

Every tool has an identical header structure:

```
┌─────────────────────────────────────────────────────────┐
│ EG   Tool Name   · EG - TSX          [changes] [Save]  │
│─────────────────────── accent border (2px) ─────────────│
```

| Element | Spec |
|---------|------|
| Frame height | `56` with `pack_propagate(False)` |
| Background | `C.CRUST` |
| Inner padding | `padx=20` |
| "EG" label | 18pt bold, colored with **accent color** |
| Tool name | 14pt normal, `C.TEXT` |
| Project path | `F.BODY` (10pt), `C.OVERLAY0` |
| Save button | `F.BODY_BOLD`, bg = **accent color**, fg = `C.CRUST`, `pady=4` |
| Changes label | `F.SMALL`, `C.PEACH`, `padx=8` |
| Bottom border | 2px frame, bg = **accent color** |

## Status Bar (32px — all tools)

```python
bar = tk.Frame(self, bg=C.CRUST, height=32)
bar.pack(fill="x", side="bottom")
bar.pack_propagate(False)
```

---

## Accent Colors — NEVER Hardcode

### The rule

> **Every accent element (header border, "EG" label, save button, count badges,
> card accent bars, dialog action buttons, drag ghost) MUST use the live site
> primary color from `categories.json` — NEVER `C.BLUE` or any other hardcoded
> Catppuccin color.**

`C.BLUE` is only acceptable for:
- `selectbackground` on listboxes (UI selection highlight)
- `highlightcolor` on entry fields (input focus ring)

These are framework-level UI feedback, not theme accent.

### How each tool loads accent colors

**category-manager.pyw** — instance-level, live-updating:
```python
self.site_colors = load_site_colors()          # reads categories.json
pri = self.site_colors["primary"]              # used everywhere
hover = derive_colors(pri).get("hover", pri)   # derived hover
```
Changes via the Site Theme color picker immediately update all header widgets
through `_refresh_site_theme()`.

**navbar-manager.pyw** — module-level constants:
```python
ACCENT = _load_site_accent()       # reads categories.json at import
ACCENT_HOVER = _darken(ACCENT)     # 70% darkened for hover
```
Picks up new colors on next launch after category-manager saves.

**hub-tools-manager.pyw** — uses `C.TEAL` as its accent (separate identity).
Same header structure, same sizing, but its own accent color.

### Category colors

Per-category colors are read from `categories.json`, never hardcoded:
```python
CAT_COLORS = _load_cat_colors()  # {cat_id: hex} from JSON
color = CAT_COLORS.get(cat, ACCENT)  # fallback = site accent, NOT C.BLUE
```

### No DEFAULT_SITE_COLORS constant

The old hardcoded `DEFAULT_SITE_COLORS` dict is gone. `load_site_colors()`
reads live from `categories.json`. The only fallback (`#ffffff/#ffffff`) is a
neutral placeholder for the impossible case where the JSON doesn't exist.

---

## Design System — Catppuccin Mocha

All tools share identical `C` and `F` token classes.

### Color tokens (`class C`)

| Token | Hex | Usage |
|-------|-----|-------|
| `BASE` | `#11111b` | Deepest background |
| `MANTLE` | `#181825` | Main window bg |
| `CRUST` | `#0d0d12` | Header/status bar bg |
| `SURFACE0` | `#1e1e2e` | Card bg |
| `SURFACE1` | `#313244` | Input bg, button default |
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
| `HEADING` | Segoe UI 13 bold | Tab section headings |
| `SUBHEADING` | Segoe UI 11 | Tool name in header |
| `BODY` | Segoe UI 10 | Default text, inputs |
| `BODY_BOLD` | Segoe UI 10 bold | Card titles, save button |
| `SMALL` | Segoe UI 9 | Labels, change indicator |
| `TINY` | Segoe UI 8 | Counts, tooltips, project path |

---

## Shared Widgets

All tools use the same widget classes. Copy them identically — do not diverge.

| Widget | Purpose | Key behavior |
|--------|---------|-------------|
| `Toggle` | iOS-style pill switch | 38x20 (cat-mgr) or 46x24 (navbar-mgr). `C.GREEN` when on. |
| `FlatBtn` | Flat label-as-button | Hover/press feedback. Takes `bg`, `hover_bg`, `command`. |
| `Toast` | Notification overlay | Positioned at bottom-center, auto-hides after `ms`. |
| `Tip` | Hover tooltip | Toplevel window, wraplength 280, appears below widget. |
| `HoverListbox` | Listbox with hover | Per-row highlight. `_global_drag` suppresses during drag. |
| `ColorPicker` | Full color picker dialog | SV gradient + hue strip + hex/RGB + presets + derived preview. Accepts `accent` param for OK button color. |

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
g.configure(bg=ACCENT)  # use accent color, not hardcoded
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

| Tool | Tab | Source → Target | Action |
|------|-----|-----------------|--------|
| navbar-mgr | Guides | Pool → Section | Assign guide to section |
| navbar-mgr | Guides | Section → Section | Move guide between sections |
| navbar-mgr | Brands | All Brands → Category | Add category to brand |
| navbar-mgr | Brands | Category → All Brands | Remove category from brand |
| hub-tools-mgr | Index | Pool → Slot (1-6) | Assign tool to dashboard slot |

---

## Data Flow & Save Behavior

### SSOT: `config/categories.json`

```json
{
  "siteColors": { "primary": "#a6e3a1", "secondary": "#21c55e" },
  "categories": [...]
}
```

All tools read from this file. Only category-manager writes to it.

### Save pattern

1. Changes accumulate in memory (dict/list mutations)
2. Header shows "unsaved changes" in `C.PEACH`
3. `Ctrl+S` (or Save button) writes all changes atomically
4. Toast confirms with timestamp
5. Badge clears

### Filesystem scanning (read-only)

Tools scan content directories to auto-detect categories, count articles/products,
and determine category type (product vs content-only). This is read-only — the
tools never modify content files except for navbar frontmatter fields.

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
| NO | NO | Future / manual |

See [CATEGORY-TYPES.md](./CATEGORY-TYPES.md) for full details.

---

## Adding a New Config Tool

Follow these rules exactly:

1. **Window**: 1536x864, centered, dark title bar, DPI-aware
2. **Header**: 38px, identical structure (see Header Bar section above)
3. **Status bar**: 32px, `C.CRUST` bg
4. **Accent color**: Load from `categories.json` site primary — never hardcode
5. **Design system**: Use `C` and `F` token classes verbatim — don't invent new tokens
6. **Widgets**: Reuse `FlatBtn`, `Toggle`, `Toast`, `Tip` — don't create variants
7. **Save**: Batch changes in memory, `Ctrl+S` to persist, unsaved badge in header
8. **Dark title bar**: Call `dark_title_bar(self)` / `self._dark_titlebar()`
9. **Window icon**: 32x32 solid accent-color pixel via `PhotoImage`

---

## Detailed Tool Docs

- [CATEGORY-MANAGER.md](./CATEGORY-MANAGER.md) — Site theme, category cards, color picker, auto-discovery
- [NAVBAR-MANAGER.md](./NAVBAR-MANAGER.md) — Four-tab layout, guide sections, brand assignments, game toggles
- [HUB-TOOLS-MANAGER.md](./HUB-TOOLS-MANAGER.md) — Tool cards, index slots, SVG editor, tooltip editor
- [DRAG-DROP-PATTERN.md](./DRAG-DROP-PATTERN.md) — Full drag-and-drop architecture reference
- [CATEGORY-TYPES.md](./CATEGORY-TYPES.md) — Product vs Content filesystem detection
- [CATEGORY-COLORS.md](../CATEGORY-COLORS.md) — CSS variable derivation, seasonal theming, icon conventions
