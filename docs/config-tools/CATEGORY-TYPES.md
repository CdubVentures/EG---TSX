# Category Types — Product vs Content Detection

## The Problem

Categories in `config/data/categories.json` can represent two different things:

1. **Product categories** — have a hub page (`/hubs/mouse`), product database,
   comparison tools, shapes viewer, radar charts, etc.
2. **Content categories** — only have editorial articles (reviews, guides, news).
   No hub page, no product database.

Some categories have both products AND content (e.g., mouse has 342 products
and 45+ articles). Some have only content (e.g., hardware has guides but no
product database). Some are future placeholders with neither yet.

## Detection: Filesystem Scan (not flags)

Both `category-manager.py` and `hub-tools-manager.py` determine category type
by **scanning the filesystem**, not by reading the JSON flags. The JSON
`product.production`/`product.vite` and `content.production`/`content.vite`
flags are user-controlled toggles for enabling/disabling routes — they don't
determine what type of category something IS.

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
| NO | NO | Future / manual | headset, mousepad, controller |

## How each tool uses this

### category-manager.py

```
scan_category_presence() -> {cat_id: {has_products: bool, has_content: bool}}
count_products() -> {cat_id: int}   # JSON file count per data-products subfolder
```

- **Product + Content** categories: show both Product and Content toggle rows
- **Content only** categories: show Content toggles only (no Product toggles)
- **Future** categories (neither on disk): show both toggle rows for manual config
- Row 4 shows counts: "342 products | 12 reviews - 26 guides - 7 news"

### hub-tools-manager.py

```
_scan_content_only_cats() -> set[str]   # cached at module load
get_hub_categories() -> list[dict]      # excludes content-only
```

- **Content-only categories are excluded entirely** — they don't have hub pages
- Only product categories (active or future) appear in the sidebar
- Future product categories (headset, mousepad, controller) appear dimmed with
  all tools disabled by default

## Current state (as of build)

```
PRODUCT (active):   mouse (342), keyboard (12), monitor (12)
PRODUCT (future):   headset, mousepad, controller
CONTENT ONLY:       hardware, game, gpu, ai
```

## Adding a new category

1. Add it in **category-manager.py** (or it auto-discovers from content)
2. If it's a product category: create `src/content/data-products/{cat_id}/` folder
3. If it's content-only: just add articles with `category: {cat_id}` in frontmatter
4. The tools will auto-detect the type on next launch

## Key rule

> **The filesystem is the source of truth for category TYPE.**
> The JSON flags control route visibility (prod/vite), not what the category IS.
