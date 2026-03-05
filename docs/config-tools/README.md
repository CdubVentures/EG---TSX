# Config Tools — GUI Managers

Three tkinter GUI tools live in `config/` for managing site configuration.
All share the **Catppuccin Mocha** dark theme, drag-and-drop patterns, and the
same design system (`C` color tokens, `F` font tokens, `FlatBtn`, `Toast`, `Tip`).

Launch any of them with `pythonw config/<name>.pyw`.

| Tool | File | Data | Purpose |
|------|------|------|---------|
| Category Manager | `category-manager.pyw` | `config/categories.json` | Category colors, labels, product/content flags |
| Navbar Manager | `navbar-manager.pyw` | Frontmatter + `src/data/navbar-*.json` | Navbar link assignment per category |
| Hub Tools Manager | `hub-tools-manager.pyw` | `config/hub-tools.json` | Hub sidebar tools + /hubs/ dashboard slots |

## Start here

- **[RULES.md](./RULES.md)** — Mandatory standards: window size, header spec, accent colors, widget conventions, drag-and-drop rules. **Read this first before modifying any tool.**

## Detailed docs

- [CATEGORY-MANAGER.md](./CATEGORY-MANAGER.md) — Category manager internals
- [NAVBAR-MANAGER.md](./NAVBAR-MANAGER.md) — Navbar manager internals
- [HUB-TOOLS-MANAGER.md](./HUB-TOOLS-MANAGER.md) — Hub tools manager internals
- [DRAG-DROP-PATTERN.md](./DRAG-DROP-PATTERN.md) — Shared drag-and-drop architecture
- [CATEGORY-TYPES.md](./CATEGORY-TYPES.md) — Product vs Content category detection
