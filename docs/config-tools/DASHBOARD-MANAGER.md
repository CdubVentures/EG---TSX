# Dashboard Manager — `config/dashboard-manager.pyw`

GUI tool for managing the home page editorial dashboard (15-slot grid).

## Launch

```
pythonw config/dashboard-manager.pyw
```

## Data

- **Reads:** `src/content/{reviews,guides,news,brands,games}/**/index.{md,mdx}` (article frontmatter, read-only)
- **Reads:** `config/data/categories.json` (category colors)
- **Writes:** `config/data/dashboard.json`

## Output Format

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

- `slots` — manual overrides keyed by 1-indexed slot number (1–15)
- `pinned` — composite keys (`collection:id`) that stick to their slot
- `badges` — composite keys mapped to badge text (e.g., "Top Pick", "Editors Choice")
- `excluded` — composite keys to hide from auto-fill

## Grid Layout

Matches HBS `index.handlebars` structure — 6 rows, 15 slots:

| Row | Slots | Description |
|-----|-------|-------------|
| 0 | 1 | Hero (full-width, large image) |
| 1 | 2–4 | 3 medium cards |
| 2 | 5 | Feature (full-width cinematic tile) |
| 3 | 6–8 | 3 medium cards |
| 4 | 9–11 | 3 medium cards |
| 5 | 12–15 | 4 small cards |

## UI Layout

Grid-based visual editor matching the dashboard layout above.

## Interactions

| Action | Behavior |
|--------|----------|
| Drag article → slot | Place article in slot (manual override) |
| Pin toggle | Pin/unpin article in its slot |
| Badge edit | Set custom badge text on a slot |
| Exclude toggle | Remove article from auto-fill pool |
| Ctrl+S | Save all changes to `dashboard.json` |

## Auto-fill Logic

1. Manually placed slots are filled first (from `slots` config)
2. Remaining empty slots fill with eligible articles sorted by date (newest first)
3. Eligibility: must have `hero` field, must not be in `excluded` list
4. Pinned and badge metadata are preserved across auto-fill

## Astro Integration

`Dashboard.astro` reads `config/data/dashboard.json`:
- Manual slot assignments override algorithmic placement
- Excluded articles are filtered out
- Pinned/badge metadata enriches the rendered cards

## Design System

Follows [RULES.md](./RULES.md) exactly:
- Catppuccin Mocha theme
- Site accent from `categories.json` siteColors
- Collection-colored badges
- Standard header/status bar/save pattern
