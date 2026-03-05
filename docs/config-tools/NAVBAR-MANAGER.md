# Navbar Manager — `config/navbar-manager.py`

Manages navbar link assignments across 4 tabs.
Reads/writes frontmatter in content files + `src/data/navbar-*.json`.

Launch: `python config/navbar-manager.py`

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

**Section management:**
- Add/Rename/Delete sections via dialogs
- Reorder sections with arrow buttons
- Section order stored in `src/data/navbar-guide-sections.json`

### Brands Tab

Assigns brands to category columns in the navbar.

**Layout:** Category columns (one per category, scrollable) + "All Brands" pool.

**Drag-and-drop:**
- Drag from "All Brands" into a category column to add that category
- Drag from category column back to "All Brands" to remove
- Delete key also removes from current category
- Brands can belong to **multiple categories** (navbar field is an array)

**Data:** Updates frontmatter `navbar:` field in brand `.md` files as a YAML list.

### Games Tab

Toggle games on/off for navbar display. No drag-and-drop.

**Layout:** 3-column card grid with toggle switches.

**Data:** Updates frontmatter `navbar:` boolean in game `.md` files.

### Hubs Tab

Enable/disable category hub links in navbar dropdown. No drag-and-drop.

**Layout:** Full-width cards per category with toggle switches.

**Data:** Writes `src/data/navbar-hubs.json` (array of enabled category IDs).

## Data Files

| File | Format | Tab |
|------|--------|-----|
| `src/content/guides/**/index.md` | frontmatter `navbar: section_name` | Guides |
| `src/content/brands/**/index.md` | frontmatter `navbar: [cat1, cat2]` | Brands |
| `src/content/games/**/index.md` | frontmatter `navbar: true/false` | Games |
| `src/data/navbar-hubs.json` | `["mouse", "keyboard", ...]` | Hubs |
| `src/data/navbar-guide-sections.json` | `{cat: [section_names]}` | Guides |

## Save Behavior

Changes are batched in memory. `Ctrl+S` writes all pending changes:
- Frontmatter updates use `write_navbar_field()` which modifies only the
  `navbar:` line in the YAML front matter (preserves all other fields)
- JSON files are written atomically
