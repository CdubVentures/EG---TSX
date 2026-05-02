# Data Gateway Contract â€” Products & Content

> **Status:** Active â€” all component developers must follow this contract
> **Last updated:** 2026-03-11
> **Related:** [`DATA-IMAGE-CONTRACT.md`](DATA-IMAGE-CONTRACT.md) (image resolution) | [`VAULT-IMAGE-REFRESH-CONTRACT.md`](VAULT-IMAGE-REFRESH-CONTRACT.md) (vault image cache refresh)

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

```text
config/data/categories.json     <- Single Source of Truth
    edited by the Categories panel in eg-config.pyw or direct JSON edits

    Each category has:
      "product": { "production": true, "vite": true }
      "content": { "production": true, "vite": true }
      "collections": {
        "dataProducts": true,
        "reviews": true,
        "guides": true,
        "news": true
      }

src/core/category-contract.ts   <- shared validator/reader
    activeProductCategoryIds
    activeContentCategoryIds
    collectionEnumValues
    label()/plural()/categoryColor()

    |-> src/core/config.ts
    |     CONFIG.categories
    |     CONFIG.contentCategories
    |     CONFIG.allCategories
    |
    |-> src/content.config.ts
    |     z.enum(...) values for products/reviews/guides/news
    |
    +-> src/core/products.ts / src/core/content.ts / src/core/hub-tools.ts

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

### Global note: vault image refresh depends on this gateway

`/api/vault/thumbs` resolves live product image stems through `getProducts()` and the media resolver. This is what repairs stale vault snapshots globally (especially color/edition defaults).

See [`VAULT-IMAGE-REFRESH-CONTRACT.md`](VAULT-IMAGE-REFRESH-CONTRACT.md) for the full flow.

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
| `enabled === true` | Disabled tools (toggled off in the Hub Tools panel) are excluded |

### Sorting

Tools are sorted by **tool type priority** first, then by **category order**:

```
Tool priority: hub â†’ database â†’ shapes â†’ versus â†’ radar
```

Within the same tool type, tools appear in `CONFIG.categories` order (mouse â†’ keyboard â†’ monitor).

### Data source

Reads `config/data/hub-tools.json` (managed by the Hub Tools panel in `config/eg-config.pyw`). The JSON contains tool entries keyed by category ID, plus `_tooltips` and `_index` metadata keys.

---

## Adding a New Category

1. **Open the Categories panel in `config/eg-config.pyw`** (or edit `config/data/categories.json` directly).
2. **Add the category** with `id`, `label`, `plural`, `color`, `product`, `content`, and `collections`.
3. **Set the collection contract**:
   - `collections.dataProducts` if product JSON is allowed for this category
   - `collections.reviews` / `guides` / `news` for the editorial collections that may reference it
4. **Create content directories** if needed:
   - `src/content/data-products/{category}/` â€” for product JSON
   - `src/content/{collection}/{category}/` â€” for articles
   - `public/images/{category}/` â€” for images
5. **No manual enum edits are required** â€” `src/content.config.ts` derives from the shared category contract.

### Collection contract guard

`src/content.config.ts` no longer maintains hand-written category enums. It
imports `collectionEnumValues` from `src/core/category-contract.ts`, so the
same JSON file drives:
- which product JSON files validate
- which review/guide/news frontmatter values validate
- which categories are active at runtime

If `categories.json` is missing required collection metadata or contains invalid
values, the Astro build fails from the shared contract instead of silently
drifting.

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

The pure gateway filters remain testable with plain `node --test`. The shared
category contract and config wiring tests import TypeScript and therefore use
`node --import tsx --test`.

```sh
# Run all gateway tests
node --test test/products-gateway.test.mjs test/content-filter.test.mjs

# Content filter only (21 tests)
node --test test/content-filter.test.mjs

# Product filter only (7 tests)
node --test test/products-gateway.test.mjs

# Category SSOT + config wiring
node --import tsx --test test/category-ssot-contract.test.mjs test/config-data-wiring.test.mjs
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
| `config/data/categories.json` | SSOT for category definitions, route flags, and collection capabilities |
| `config/eg-config.pyw` | Unified config app. The Categories panel edits `categories.json` and the Hub Tools panel edits `hub-tools.json` |
| `src/core/category-contract.ts` | Shared validator/reader for category JSON and collection enum values |
| `src/core/config.ts` | Runtime facade over the shared category contract |
| `src/core/products.ts` | Product gateway â€” `getProducts()` |
| `src/core/products-filter.mjs` | Pure product filter (testable) |
| `src/core/content.ts` | Content gateway â€” `getArticles()` + typed wrappers |
| `src/core/content-filter.mjs` | Pure content filter (testable) |
| `src/core/hub-tools.ts` | Hub tools gateway â€” `getDesktopTools()`, `getMobileTools()`, etc. |
| `src/core/hub-tools-filter.mjs` | Pure hub tools filter/sort (testable) |
| `src/core/hub-tools-filter.d.mts` | TypeScript declarations for hub-tools-filter |
| `config/data/hub-tools.json` | Tool definitions per category (managed by the Hub Tools panel in `config/eg-config.pyw`) |
| `src/content.config.ts` | Zod schemas derived from the shared category contract |
| `test/products-gateway.test.mjs` | 7 product filter tests |
| `test/content-filter.test.mjs` | 21 content filter tests |
| `test/hub-tools-filter.test.mjs` | 15 hub tools filter tests |
