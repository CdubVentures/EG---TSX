# Category Manager — `config/category-manager.py`

Manages the master category list, colors, labels, and product/content flags.
Reads/writes `config/categories.json`.

Launch: `python config/category-manager.py`

## What it configures

Each category entry in `categories.json` has:

```json
{
  "id": "mouse",
  "label": "Mouse",
  "plural": "Mice",
  "color": "#00aeff",
  "product": { "production": true, "vite": true },
  "content": { "production": true, "vite": true }
}
```

## Card Layout (per category)

| Row | Content |
|-----|---------|
| 1 | Color swatch (clickable picker) + category ID + hex code |
| 2 | Label + Plural text inputs |
| 3 | Product/Content toggle rows (conditionally shown, see below) |
| 4 | Data counts: "342 products \| 12 reviews - 26 guides - 7 news" |
| 4 | Navbar icon status (found/missing SVG check) |
| 5 | Derived color swatches (base, accent, hover, grad-start, etc.) |

## Smart Toggle Visibility

The Product and Content toggle rows are shown **based on what exists on disk**,
not based on the current flag values. See [CATEGORY-TYPES.md](./CATEGORY-TYPES.md).

| Filesystem state | Toggles shown |
|-----------------|---------------|
| Has `data-products/` folder AND articles | Product + Content |
| Has articles only (no product folder) | Content only |
| Has product folder only (no articles) | Product only |
| Neither (future/manual category) | Product + Content |

This prevents confusion — you won't see Product toggles for a content-only
category like `hardware` that will never have a product database.

## Filesystem Scanning

On launch, the manager scans:

```
scan_category_presence()  -> {cat_id: {has_products, has_content}}
count_products()          -> {cat_id: product_count}
count_articles()          -> {cat_id: {reviews, guides, news}}
```

Scanned paths:
- `src/content/data-products/{cat_id}/` — product JSON files
- `src/content/{reviews,guides,news}/**/*.{md,mdx}` — article frontmatter

## Auto-Discovery

`_auto_discover()` runs at launch. If a category ID appears in content
frontmatter or as a `data-products/` subfolder but isn't in `categories.json`,
it's automatically added with:
- A randomly generated distinct color
- Default label/plural from the ID
- Both product and content flags set to `{production: false, vite: true}`

## Product/Content Flags

These flags control **route visibility**, not category type:

| Flag | Meaning |
|------|---------|
| `product.production` | Product hub routes enabled in production build |
| `product.vite` | Product hub routes enabled in dev server |
| `content.production` | Content routes enabled in production build |
| `content.vite` | Content routes enabled in dev server |

Typical workflow: set `vite: true` first for dev testing, then flip
`production: true` when ready to deploy.

## Color Picker

Clicking the color swatch or hex label opens a full color picker dialog with:
- HSL sliders
- Hex input
- Preview against dark/light backgrounds
- Category icon preview in the new color
- Derived color preview (base, accent, hover, etc.)

## Data File — `config/categories.json`

```json
{
  "siteColors": {
    "primary": "#a6e3a1",
    "secondary": "#21c55e"
  },
  "categories": [
    { "id": "mouse", "label": "Mouse", "plural": "Mice", "color": "#00aeff",
      "product": { "production": true, "vite": true },
      "content": { "production": true, "vite": true } },
    // ... more categories
  ]
}
```

`siteColors` is configured in the Site Theme row at the top of the manager
(separate from individual categories).
