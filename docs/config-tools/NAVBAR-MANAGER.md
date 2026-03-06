# Navbar Manager — `config/navbar-manager.pyw`

Manages navbar link assignments across 4 tabs.
Reads/writes frontmatter in content files + `config/data/navbar-guide-sections.json`.

Launch: `pythonw config/navbar-manager.pyw`

## Four Tabs

### Guides Tab

Assigns guides to named sections within each category's navbar mega menu.

**Sidebar:** Category pills (color-coded) filter the view.

**Layout:** Horizontally scrollable section columns (left) + fixed "Unassigned"
pool (right).

**Drag-and-drop:**
- Drag guide from Unassigned pool into a section column to assign
- Drag between section columns to reassign
- Updates frontmatter `navbar:` field with section name

**Double-click rename:** Double-click any guide item to rename its `guide`
frontmatter field (the short nav-friendly display name).

**Section management:**
- Add/Rename/Delete sections via dialogs
- Reorder sections with arrow buttons
- Section order stored in `config/data/navbar-guide-sections.json`

### Brands Tab

Assigns brands to category columns in the navbar.

**Layout:** Category columns (one per category, scrollable) + "All Brands" pool.

**Drag-and-drop:**
- Drag from "All Brands" into a category column to add that category
- Drag from category column back to "All Brands" to remove
- Delete key also removes from current category
- Brands can belong to **multiple categories** (navbar field is an array)

**Double-click rename:** Double-click any brand to rename its `displayName`
frontmatter field. The `brand` field stays stable as an identifier — only
`displayName` changes. `GlobalNav.astro` reads `displayName ?? brand` so the
rename propagates to both desktop and mobile nav menus.

**Data:** Updates frontmatter `navbar:` field and `displayName` field in brand
`.md` files.

### Games Tab

Toggle games on/off for navbar display. No drag-and-drop.

**Layout:** 3-column card grid with toggle switches.

**Double-click rename:** Double-click any game label to rename its `title` (and
`game`) frontmatter fields.

**Data:** Updates frontmatter `navbar:` boolean and `title`/`game` fields in
game `.md` files.

### Hubs Tab (display-only)

Read-only view of category activation flags from `config/data/categories.json`.
Shows which categories have Product/Content enabled (production + vite flags).

**Layout:** Full-width cards per category with status badges.

**No edits here** — use Category Manager (`config/category-manager.pyw`) to
change activation flags. The navbar hubs dropdown is driven by
`config.ts → isProductActive()` via `GlobalNav.astro`.

## Data Files

| File | Format | Tab |
|------|--------|-----|
| `src/content/guides/**/index.md` | frontmatter `navbar`, `guide` | Guides |
| `src/content/brands/**/index.md` | frontmatter `navbar`, `displayName` | Brands |
| `src/content/games/**/index.md` | frontmatter `navbar`, `title`, `game` | Games |
| `config/data/categories.json` | read-only (activation flags) | Hubs |
| `config/data/navbar-guide-sections.json` | `{cat: [section_names]}` | Guides |

## Save Behavior

Changes are batched in memory. `Ctrl+S` writes all pending changes:
- Navbar assignment updates use `write_navbar_field()` — modifies only the
  `navbar:` line in the YAML front matter (preserves all other fields)
- Rename updates use `write_field()` — modifies a single scalar YAML field
  (e.g., `displayName`, `guide`, `title`). Auto-quotes values with special chars
- JSON files are written atomically
- Hubs tab has no save actions (display-only)
- Two separate pending-change dicts: `pending_changes` (navbar assignments) and
  `pending_field_changes` (renames). Both clear on save
