# Data Gateway Contract — Products & Content

> **Status:** Active — all component developers must follow this contract
> **Last updated:** 2026-03-04
> **Related:** [`DATA-IMAGE-CONTRACT.md`](DATA-IMAGE-CONTRACT.md) (image resolution) | [`ARCHITECTURE.md`](ARCHITECTURE.md) (full system design)

---

## Why This Document Exists

Every component that displays products or articles must respect category visibility flags. Without a central gateway, every component would need to independently filter by environment flags, drafts, and stubs — leading to inconsistencies, forgotten filters, and data leaks in production.

The gateway pattern solves this: **one function per data type, called everywhere.**

---

## The Two Rules

```
RULE 1: NEVER call getCollection('dataProducts') directly.
        Always use getProducts() from @core/products.

RULE 2: NEVER call getCollection('reviews'|'guides'|'news'|'brands'|'games') directly.
        Always use getArticles() from @core/content.

EXCEPTION: GlobalNav may use raw getCollection() for navbar-specific filtering
           (navbar field assignment is a separate concern from content visibility).
```

---

## How It Works

```
config/categories.json          ← Single Source of Truth (edited by category-manager.py)
    │
    │  Each category has TWO toggle objects:
    │    "product": { "production": true, "vite": true }
    │    "content": { "production": true, "vite": true }
    │
    ▼
src/core/config.ts              ← Reads flags at build time
    │
    │  CONFIG.categories         → active PRODUCT category IDs
    │  CONFIG.contentCategories  → active CONTENT category IDs
    │  CONFIG.allCategories      → ALL category IDs (for schema validation)
    │
    │  Environment logic:
    │    active = production:true  OR  (dev mode AND vite:true)
    │
    ├──────────────────────┐
    ▼                      ▼
src/core/products.ts    src/core/content.ts     ← The two gateways
    │                      │
    │  getProducts()       │  getArticles('reviews')
    │                      │  getReviews()
    │                      │  getGuides()
    │                      │  getNews()
    │                      │  getBrands()
    │                      │  getGames()
    │                      │
    ▼                      ▼
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

Products don't have `draft` or `fullArticle` fields — the category gate is the only filter.

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
| 1 | `fullArticle !== false` | Exclude stubs (placeholder entries not ready for display) |
| 2 | `draft !== true` | Exclude drafts (work in progress) |
| 3 | Category in `CONFIG.contentCategories` | Articles in disabled content categories are invisible |
| 4 | Sort `datePublished` desc | Newest first, nulls last |

### Category field behavior

| Collection | Has `category` field? | Effect of Rule 3 |
|------------|----------------------|-------------------|
| `reviews` | Yes | Filtered by content flags |
| `guides` | Yes | Filtered by content flags |
| `news` | Yes | Filtered by content flags |
| `brands` | No | Skips Rule 3 — always included (if not draft/stub) |
| `games` | No | Skips Rule 3 — always included (if not draft/stub) |

---

## Category Flags — Current State

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

## Adding a New Category

1. **Open `category-manager.py`** (or edit `config/categories.json` directly)
2. **Add the category** with `id`, `label`, `plural`, `color`, and both toggle objects
3. **Update Zod enums** in `src/content.config.ts` — add the new ID to the appropriate enum(s):
   - `categories` — if it has products
   - `reviewCategories` — if it has reviews
   - `newsCategories` — must include ALL category IDs (build fails otherwise via SSOT drift check)
4. **Create content directories** if needed:
   - `src/content/data-products/{category}/` — for product JSON
   - `src/content/{collection}/{category}/` — for articles
   - `public/images/{category}/` — for images
5. **No code changes needed** — the gateways read `CONFIG` dynamically

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

The filter automatically handles the new collection — if it has `category`, `draft`, or `fullArticle` fields they'll be filtered. If not, entries pass through with just the sort applied.

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

- fullArticle: `true`, `false`, `undefined`
- draft: `true`, `false`, `undefined`
- category: active, inactive, missing field
- Combined: all three filters together
- Sorting: datePublished desc, nulls last, all nulls
- Edge cases: empty input, immutability, bare entries

---

## File Reference

| File | Purpose |
|------|---------|
| `config/categories.json` | SSOT for all category definitions + flags |
| `config/category-manager.py` | GUI tool to edit categories.json |
| `src/core/config.ts` | Reads JSON, exports `CONFIG.categories` / `CONFIG.contentCategories` |
| `src/core/products.ts` | Product gateway — `getProducts()` |
| `src/core/products-filter.mjs` | Pure product filter (testable) |
| `src/core/content.ts` | Content gateway — `getArticles()` + typed wrappers |
| `src/core/content-filter.mjs` | Pure content filter (testable) |
| `src/content.config.ts` | Zod schemas + SSOT drift check |
| `test/products-gateway.test.mjs` | 7 product filter tests |
| `test/content-filter.test.mjs` | 21 content filter tests |
