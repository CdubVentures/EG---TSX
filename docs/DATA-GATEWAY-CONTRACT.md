# Data Gateway Contract â€” Products & Content

> **Status:** Active â€” all component developers must follow this contract
> **Last updated:** 2026-03-04
> **Related:** [`DATA-IMAGE-CONTRACT.md`](DATA-IMAGE-CONTRACT.md) (image resolution) | [`ARCHITECTURE.md`](ARCHITECTURE.md) (full system design)

---

## Why This Document Exists

Every component that displays products or articles must respect category visibility flags. Without a central gateway, every component would need to independently filter by environment flags, drafts, and stubs â€” leading to inconsistencies, forgotten filters, and data leaks in production.

The gateway pattern solves this: **one function per data type, called everywhere.**

---

## The Three Rules

```
RULE 1: NEVER call getCollection('dataProducts') directly.
        Always use getProducts() from @core/products.

RULE 2: NEVER call getCollection('reviews'|'guides'|'news'|'brands'|'games') directly.
        Always use getArticles() from @core/content.

RULE 3: NEVER read hub-tools.json directly in components.
        Always use getDesktopTools() / getMobileTools() from @core/hub-tools.

EXCEPTION: GlobalNav may use raw getCollection() for navbar-specific filtering
           (navbar field assignment is a separate concern from content visibility).
```

---

## How It Works

```
config/data/categories.json     â† Single Source of Truth (edited by category-manager.py)
    â”‚
    â”‚  Each category has TWO toggle objects:
    â”‚    "product": { "production": true, "vite": true }
    â”‚    "content": { "production": true, "vite": true }
    â”‚
    â–¼
src/core/config.ts              â† Reads flags at build time
    â”‚
    â”‚  CONFIG.categories         â†’ active PRODUCT category IDs
    â”‚  CONFIG.contentCategories  â†’ active CONTENT category IDs
    â”‚  CONFIG.allCategories      â†’ ALL category IDs (for schema validation)
    â”‚
    â”‚  Environment logic:
    â”‚    active = production:true  OR  (dev mode AND vite:true)
    â”‚
    â”œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¬â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
    â–¼                      â–¼                      â–¼
src/core/products.ts    src/core/content.ts    src/core/hub-tools.ts
    â”‚                      â”‚                      â”‚
    â”‚  getProducts()       â”‚  getArticles(...)    â”‚  getDesktopTools()
    â”‚                      â”‚  getReviews()        â”‚  getMobileTools()
    â”‚                      â”‚  getGuides()         â”‚  getToolsForCategory()
    â”‚                      â”‚  getNews()           â”‚  getToolTooltip()
    â”‚                      â”‚  getBrands()         â”‚
    â”‚                      â”‚  getGames()          â”‚
    â”‚                      â”‚                      â”‚
    â–¼                      â–¼                      â–¼
every component site-wide
```

---

## Product Gateway

**File:** `src/core/products.ts`
**Pure filter:** `src/core/products-filter.mjs`
**Tests:** `test/products-gateway.test.mjs` (7 tests)

```typescript
import { getProducts } from '@core/products';

const allProducts = await getProducts();
// Returns only products whose category is in CONFIG.categories
```

### What it filters

| Rule | Effect |
|------|--------|
| Category in `CONFIG.categories` | Products in disabled categories are invisible |

### What it does NOT filter

Products don't have `draft` or `publish` fields â€” the category gate is the only filter.

---

## Content Gateway

**File:** `src/core/content.ts`
**Pure filter:** `src/core/content-filter.mjs`
**Tests:** `test/content-filter.test.mjs` (21 tests)

```typescript
import { getNews, getReviews, getGuides } from '@core/content';

const latestNews = await getNews();       // filtered + sorted
const reviews    = await getReviews();    // filtered + sorted
const guides     = await getGuides();     // filtered + sorted

// Or use the generic form:
import { getArticles } from '@core/content';
const articles = await getArticles('reviews');
```

### What it filters (in order)

| # | Rule | Effect |
|---|------|--------|
| 1 | `publish !== false` | Exclude stubs (placeholder entries not ready for display) |
| 2 | `draft !== true` | Exclude drafts (work in progress) |
| 3 | Category in `CONFIG.contentCategories` | Articles in disabled content categories are invisible |
| 4 | Sort `datePublished` desc | Newest first, nulls last |

### Category field behavior

| Collection | Has `category` field? | Effect of Rule 3 |
|------------|----------------------|-------------------|
| `reviews` | Yes | Filtered by content flags |
| `guides` | Yes | Filtered by content flags |
| `news` | Yes | Filtered by content flags |
| `brands` | No | Skips Rule 3 â€” always included (if not draft/stub) |
| `games` | No | Skips Rule 3 â€” always included (if not draft/stub) |

---

## Category Flags â€” Current State

| Category | Product prod/vite | Content prod/vite |
|----------|:-----------------:|:-----------------:|
| mouse | true/true | true/true |
| keyboard | true/true | true/true |
| monitor | true/true | true/true |
| headset | false/false | false/false |
| mousepad | false/false | false/false |
| controller | false/false | false/false |
| hardware | false/false | true/true |
| game | false/false | false/**true** |
| gpu | false/false | true/true |
| ai | false/false | true/true |

**Read this as:** mouse products appear in both dev and production. Game content only appears in dev (`vite:true` but `production:false`). Hardware has content but no products.

---

## Hub Tools Gateway

**File:** `src/core/hub-tools.ts`
**Pure filter:** `src/core/hub-tools-filter.mjs`
**Type declarations:** `src/core/hub-tools-filter.d.mts`
**Tests:** `test/hub-tools-filter.test.mjs` (15 tests)

```typescript
import { getDesktopTools, getMobileTools } from '@core/hub-tools';

const tools = getDesktopTools();   // flat list, sorted by priority
const groups = getMobileTools();   // grouped by category
```

### What it filters

| Rule | Effect |
|------|--------|
| Category in `CONFIG.categories` | Tools in disabled categories are invisible |
| `enabled === true` | Disabled tools (toggled off in hub-tools-manager) are excluded |

### Sorting

Tools are sorted by **tool type priority** first, then by **category order**:

```
Tool priority: hub â†’ database â†’ shapes â†’ versus â†’ radar
```

Within the same tool type, tools appear in `CONFIG.categories` order (mouse â†’ keyboard â†’ monitor).

### Data source

Reads `config/data/hub-tools.json` (managed by `config/hub-tools-manager.pyw`). The JSON contains tool entries keyed by category ID, plus `_tooltips` and `_index` metadata keys.

---

## Adding a New Category

1. **Open `category-manager.py`** (or edit `config/data/categories.json` directly)
2. **Add the category** with `id`, `label`, `plural`, `color`, and both toggle objects
3. **Update Zod enums** in `src/content.config.ts` â€” add the new ID to the appropriate enum(s):
   - `categories` â€” if it has products
   - `reviewCategories` â€” if it has reviews
   - `newsCategories` â€” must include ALL category IDs (build fails otherwise via SSOT drift check)
4. **Create content directories** if needed:
   - `src/content/data-products/{category}/` â€” for product JSON
   - `src/content/{collection}/{category}/` â€” for articles
   - `public/images/{category}/` â€” for images
5. **No code changes needed** â€” the gateways read `CONFIG` dynamically

### SSOT drift check

`src/content.config.ts` contains a build-time guard (lines 46-59) that compares `categories.json` IDs against the Zod `newsCategories` enum. If they diverge, the **Astro build fails** with:

```
[SSOT DRIFT] categories.json has IDs not in newsCategories enum: newcat.
Update the Zod enums in src/content.config.ts to match.
```

---

## Adding a New Article Collection

If you need a new content type beyond reviews/guides/news/brands/games:

1. **Define the collection** in `src/content.config.ts` with a Zod schema
2. **Add it to the exports** in `collections`
3. **Add it to `ArticleCollection` type** in `src/core/content.ts`
4. **Add a convenience wrapper** (optional):
   ```typescript
   export async function getNewCollection() {
     return getArticles('newCollection');
   }
   ```
5. **Add content files** in `src/content/{collection}/`

The filter automatically handles the new collection â€” if it has `category`, `draft`, or `publish` fields they'll be filtered. If not, entries pass through with just the sort applied.

---

## Testing

Both gateways extract their filter logic into pure `.mjs` files testable with `node --test` (no Astro required).

```sh
# Run all gateway tests
node --test test/products-gateway.test.mjs test/content-filter.test.mjs

# Content filter only (21 tests)
node --test test/content-filter.test.mjs

# Product filter only (7 tests)
node --test test/products-gateway.test.mjs
```

### Test matrix coverage (content)

- publish: `true`, `false`, `undefined`
- draft: `true`, `false`, `undefined`
- category: active, inactive, missing field
- Combined: all three filters together
- Sorting: datePublished desc, nulls last, all nulls
- Edge cases: empty input, immutability, bare entries

---

## File Reference

| File | Purpose |
|------|---------|
| `config/data/categories.json` | SSOT for all category definitions + flags |
| `config/category-manager.py` | GUI tool to edit categories.json |
| `src/core/config.ts` | Reads JSON, exports `CONFIG.categories` / `CONFIG.contentCategories` |
| `src/core/products.ts` | Product gateway â€” `getProducts()` |
| `src/core/products-filter.mjs` | Pure product filter (testable) |
| `src/core/content.ts` | Content gateway â€” `getArticles()` + typed wrappers |
| `src/core/content-filter.mjs` | Pure content filter (testable) |
| `src/core/hub-tools.ts` | Hub tools gateway â€” `getDesktopTools()`, `getMobileTools()`, etc. |
| `src/core/hub-tools-filter.mjs` | Pure hub tools filter/sort (testable) |
| `src/core/hub-tools-filter.d.mts` | TypeScript declarations for hub-tools-filter |
| `config/data/hub-tools.json` | Tool definitions per category (managed by hub-tools-manager) |
| `src/content.config.ts` | Zod schemas + SSOT drift check |
| `test/products-gateway.test.mjs` | 7 product filter tests |
| `test/content-filter.test.mjs` | 21 content filter tests |
| `test/hub-tools-filter.test.mjs` | 15 hub tools filter tests |
