# Drag-and-Drop Pattern — Config Panels

All three config panels in `config/eg-config.pyw` share a common drag-and-drop architecture built on
tkinter. This document explains the pattern so future tools can reuse it.

## Core Components

### HoverListbox

Custom `tk.Listbox` subclass that highlights items on hover. Used as the source
pool for draggable items.

```python
class HoverListbox(tk.Listbox):
    _global_drag = False  # class-level flag — suppresses hover during drag

    def __init__(self, master, hover_bg, item_bg, **kw):
        # Binds <Motion> to highlight row under cursor
        # Binds <Leave> to reset highlight
        # Checks _global_drag to avoid hover flicker during drag
```

Key detail: `_global_drag` is a **class-level** flag. When any drag starts, it's
set to `True` to prevent hover highlights from interfering with the ghost window.
Reset to `False` on drop/cleanup.

### Ghost Window

During drag, a `tk.Toplevel` window follows the cursor showing what's being
dragged. It uses `overrideredirect(True)` so there's no title bar, and
`attributes("-alpha", 0.9)` for slight transparency.

**Deferred creation:** The ghost is NOT created on `ButtonPress-1`. It is
created on the first `B1-Motion` event (actual mouse movement). This prevents
ghost windows from interfering with double-click rename — a double-click has
no motion, so no ghost ever appears.

```python
# In _drag_motion (NOT _drag_start):
if not self._drag_ghost:
    HoverListbox._global_drag = True
    g = tk.Toplevel(self)
    g.overrideredirect(True)
    g.attributes("-alpha", 0.9)
    g.configure(bg=category_color)
    tk.Label(g, text=f"  {name}  ", bg=category_color, ...).pack()
    self._drag_ghost = g
self._drag_ghost.geometry(f"+{event.x_root + 14}+{event.y_root - 10}")
```

The ghost is offset 14px right and 10px up from the cursor so it doesn't
interfere with drop target detection.

### Hit Testing

Drop targets are found by walking the widget tree and checking if the cursor's
screen coordinates fall within a widget's bounding box:

```python
def _slot_at(self, x, y) -> int | None:
    cx, cy = card.winfo_rootx(), card.winfo_rooty()
    cw, ch = card.winfo_width(), card.winfo_height()
    if cx <= x <= cx + cw and cy <= y <= cy + ch:
        return card._slot_idx
```

Widgets that are valid drop targets get custom attributes (e.g., `card._is_slot = True`,
`card._slot_idx = 3`) so the hit test knows what it found.

### Drag Lifecycle

```
ButtonPress-1   -->  _drag_start()   # Record source + item (no ghost yet)
B1-Motion       -->  _drag_motion()  # Create ghost on first motion, then track cursor
ButtonRelease-1 -->  _drag_drop()    # Hit test, apply change if cross-widget drop
                     _drag_cleanup() # Destroy ghost, reset state
Double-Button-1 -->  _rename_*()     # Opens rename dialog (no ghost, no refresh)
```

**Key distinction:** `_drag_start` only records state — no ghost, no
`_global_drag`. A double-click (no motion) never creates a ghost and never
triggers a view refresh on release, so the rename dialog opens cleanly.

State variables (initialized in `__init__`):

```python
self._drag_src: tk.Listbox | None = None
self._drag_idx: int | None = None
self._drag_item: dict | None = None
self._drag_ghost: tk.Toplevel | None = None
```

### Cleanup Safety

`_drag_cleanup()` always runs — even if the drop target is invalid. It destroys
the ghost window and resets all drag state. This prevents orphaned ghost windows.

## Pattern by Tool

### Navbar panel (`config/eg-config.pyw`) — Brands Tab

| Source | Target | Action |
|--------|--------|--------|
| "All Brands" pool | Category column | Add category to brand's `categories` + `navbar` lists |
| Category column | "All Brands" pool | Remove category from brand's `categories` + `navbar` lists |
| Category column | Different category column | Move brand between categories (both fields) |

- Brands can belong to **multiple categories** (categories list is an array)
- **Dual fields:** `categories` controls index page membership (`/brands/{cat}/`),
  `navbar` controls nav mega-menu display (curated subset of categories)
- Default drag/drop adds to both `categories` and `navbar`
- Delete key removes from both fields
- **Checkbox toggle:** Brands in category columns show `[x]` (in navbar) or `[ ]`
  (categories only). Click the checkbox area to toggle navbar visibility without
  changing category membership

### Navbar panel (`config/eg-config.pyw`) — Guides Tab

| Source | Target | Action |
|--------|--------|--------|
| Section column | Different section column | Move guide to new section |
| "Unassigned" pool | Section column | Assign guide to section |

- Each guide belongs to exactly **one section** per category
- Sections are ordered and can be reordered with arrow buttons

### Hub Tools panel (`config/eg-config.pyw`) — Index Tab

| Source | Target | Action |
|--------|--------|--------|
| Unassigned pool | Numbered slot (1-6) | Assign tool to dashboard slot |
| Slot remove button (x) | N/A | Remove tool from slot |

- 6 numbered slots in a 3x2 grid
- Each **view** (All, Hub, Database, Versus, Radar, Shapes) has independent slots
- Slots start blank and take the category color when filled
- Empty slots auto-fill from remaining tools at page build time
- Disabled tools appear grayed out with "(off)" but are still draggable

## Design Conventions

1. **Ghost color matches source** — drag ghost background uses the category color
   of the item being dragged
2. **No drag between tabs** — drag-and-drop only works within a single tab
3. **Immediate visual feedback** — after drop, the entire view rebuilds to show
   the new state
4. **Toast on error** — duplicate assignments, invalid drops, etc. show a toast
   notification
5. **Ctrl+S to save** — drag operations update in-memory state only; changes
   persist to disk on explicit save
6. **Unsaved changes indicator** — header shows "unsaved changes" badge in peach
   color when state differs from disk
