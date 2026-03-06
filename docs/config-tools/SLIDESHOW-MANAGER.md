# Slideshow Manager

GUI tool for managing the home page product carousel order.

## Launch

```
pythonw config/slideshow-manager.pyw
```

## Data

- **Reads:** `src/content/data-products/{cat}/{brand}/{slug}.json` (366 products)
- **Reads:** `config/data/categories.json` (category colors, labels)
- **Writes:** `config/data/slideshow.json`

## Output Format

```json
{
  "maxSlides": 10,
  "slides": [
    "razer-viper-v3-pro",
    "wooting-60he"
  ]
}
```

- `slides[]` = ordered Astro entry IDs (`{brand-slug}-{product-slug}`, matching glob loader format)
- `maxSlides` = configurable cap (1–20), persisted for Astro build

## Eligibility

Products must have:
- `overall` score > 0 (numeric)
- `media.images.length` > 0

## UI Layout

Two-panel design:

- **Product Pool** (left): all eligible products, filterable and sortable
- **Slideshow Queue** (right): numbered slots showing assigned products

## Interactions

| Action | Behavior |
|--------|----------|
| Drag pool → queue | Add product at drop position |
| Double-click pool item | Quick-add to bottom of queue |
| Drag within queue | Reorder (swap positions) |
| Drag queue → pool | Remove from queue |
| `×` button on queue item | Remove from queue |
| Delete/Backspace in queue | Remove selected item |
| Up/Down arrows in queue | Move selected item up/down |
| Auto-fill button | Fill empty slots by release date, score >= 8, max 3/category |
| Clear All button | Empty the queue |
| Max spinner (1–20) | Set slot count |
| Search field | Filter pool by brand + model (live, case-insensitive) |
| Category pills | Filter pool by category (color-coded) |
| Sort dropdown | Sort pool by: Score, Release Date, Brand, Model |

## Auto-fill Logic

1. Filter: score >= 8.0 required, exclude products already in queue
2. Sort by `release_date` descending (newest first), score as tiebreaker
3. Round-robin across categories, up to 3 per category
4. Fill only empty slots (preserves existing manual picks)
5. Respects `maxSlides` cap

## Astro Integration

`HomeSlideshow.astro` reads `config/data/slideshow.json`:
- If `slides[]` has entries, use config-driven order
- If `slides[]` is empty, fall back to algorithmic selection (top 10 by score)
- Missing/invalid entry IDs are silently skipped

## Design System

Follows [RULES.md](./RULES.md) exactly:
- Catppuccin Mocha theme
- Site accent from `categories.json` siteColors
- Category color dots on pool items
- Accent-colored drag ghost
- Standard header/status bar/save pattern
