# Category Types — Product vs Content Detection

## The Problem

Categories in `config/data/categories.json` can represent two different things:

1. **Product categories** — have product records in `src/content/data-products/{cat_id}/`
   and participate in hub-tool URL contracts, comparison tooling, shapes viewer,
   radar charts, and related product-facing config.
2. **Content categories** — only have editorial articles (reviews, guides, news).
   No product data folder and no hub-tool inventory.

Some categories have both products AND content (e.g., mouse has 342 products
and 45+ articles). Some have only content (e.g., hardware has guides but no
product data folder). Some are manual/inactive categories with neither yet.

## Detection: Filesystem Scan (not flags)

Both the Categories panel and Hub Tools panel in `config/eg-config.pyw` determine category type
by scanning the filesystem, not by reading the JSON route flags. The JSON
`product.production`/`product.vite` and `content.production`/`content.vite`
values control visibility only.

The `collections` block in `categories.json` is related but different: it is
the build contract for which Astro collections may reference the category. It
still does not decide whether a category is "product" or "content-only" for the
GUI layout.

### What gets scanned

| Path | What it proves |
|------|---------------|
| `src/content/data-products/{cat_id}/` folder exists | Category HAS products |
| Articles in `src/content/{reviews,guides,news}/` with `category: {cat_id}` in frontmatter | Category HAS content |

### Resulting classification

| Has products folder? | Has articles? | Type | Example |
|---------------------|---------------|------|---------|
| YES | YES | Product + Content | mouse, keyboard, monitor |
| YES | NO | Product only | (none currently) |
| NO | YES | Content only | hardware, game, gpu, ai |
| NO | NO | Inactive / manual | headset, mousepad, controller |

## How each tool uses this

### Categories panel (`config/eg-config.pyw`)

```
scan_category_presence() -> {cat_id: {has_products: bool, has_content: bool}}
count_products() -> {cat_id: int}   # JSON file count per data-products subfolder
```

- **Product + Content** categories: show both Product and Content toggle rows
- **Content only** categories: show Content toggles only (no Product toggles)
- **Inactive/manual** categories (neither on disk): show both toggle rows for manual config
- Row 4 shows counts: "342 products | 12 reviews - 26 guides - 7 news"

### Hub Tools panel (`config/eg-config.pyw`)

```
_scan_content_only_cats(root: Path) -> set[str]   # helper in config/panels/hub_tools.py
app.cache.get_content_only_cats() -> set[str]     # cached result consumed by the panel
```

- **Content-only categories are excluded entirely** from the Hub Tools panel
- Only product categories (active or inactive/manual) appear in the sidebar
- Inactive/manual product categories (headset, mousepad, controller) appear dimmed with
  all tools disabled by default

## Current state (as of build)

```
PRODUCT (active):   mouse (342), keyboard (12), monitor (12)
PRODUCT (inactive/manual):   headset, mousepad, controller
CONTENT ONLY:       hardware, game, gpu, ai
```

## Adding a new category

1. Add it in the **Categories panel** in `config/eg-config.pyw` (or let auto-discovery add it from content/products)
2. If it's a product category: create `src/content/data-products/{cat_id}/` folder
3. If it's content-only: just add articles with `category: {cat_id}` in frontmatter
4. Update the `collections` block in `categories.json` if the category should become valid for reviews, guides, news, or product JSON
5. The tools will auto-detect the type on next launch

## Key rule

> **The filesystem is the source of truth for category TYPE.**
> The JSON flags control route visibility (prod/vite), not what the category IS.
