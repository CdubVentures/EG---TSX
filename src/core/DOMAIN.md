# src/core — Domain

Cross-cutting logic that any feature or layout may import.
No feature-specific knowledge lives here.

## Public API

### config.ts
- `CONFIG` — centralized behavioral knobs (pagination, timeouts, scores, CDN, categories)
- `categoryColor(cat)` — hex color for a category ID
- `plural(cat)` — canonical plural label ("Mice", "Keyboards", etc.)
- `siteColors` — primary/secondary gradient colors from `categories.json`
- `Category`, `Genre` — derived union types

### categories.ts
- `deriveCategoryColors(hex)` — derive all color variants from a single base hex
- `getCategoryColors(cat)` — shorthand: `deriveCategoryColors(categoryColor(cat))`
- `buildCategoryVarsBlock()` — complete CSS block for `<style>` injection (`:root` + `.cat-color` classes)
- `buildAllCategoryVars()` / `buildAllCategoryClasses()` — individual pieces
- `deriveSiteVars(primary, secondary)` — site-wide `--site-*` CSS variables
- `categoryColorClass(id)` — `.{id}-color { --card-*: var(--cat-{id}-*) }` indirection
- `catVar(cat)` — returns `var(--cat-{cat})`

### images.ts
- `contentImage(basePath, stem, size, ext?)` — universal image URL resolver
- `collectionImagePath(collection, entryId)` — convention-based image folder path

### media.ts
- `getImage(media, view, options?)` — find a specific product image by view
- `getCarouselImages(media)` — ordered images for product carousel
- `getAvailableColors(media)` — list of available color options
- `hasColorVariants(media)` — boolean check
- `getImageForColor(media, color)` — feature image for a specific color

### products.ts (product gateway)
- `getProducts()` — returns all products filtered by `CONFIG.categories`
- Rule: Never call `getCollection('dataProducts')` directly. Always use `getProducts()`.

### content.ts (content gateway)
- `getArticles(collection)` — returns filtered, sorted entries for any article collection
- `getReviews()` / `getGuides()` / `getNews()` / `getBrands()` / `getGames()` — typed convenience wrappers
- Filters: `fullArticle !== false`, `draft !== true`, category in `CONFIG.contentCategories`
- Sort: `datePublished` descending, nulls last
- Rule: Never call `getCollection('reviews'|'guides'|'news'|'brands'|'games')` directly. Always use `getArticles()`.
- Exception: GlobalNav may use raw `getCollection()` for navbar-specific filtering (navbar field assignment)

### routing/slugs.ts
- URL slug generation and normalization utilities

## Dependencies
- Reads `config/categories.json` (SSOT for category definitions + site colors)
- No feature imports allowed — core is a leaf dependency

## Empty stubs (reserved)
- `auth/` — reserved for server-side auth utilities (JWT verification, etc.)
- `seo/` — reserved for SEO/meta-tag generation helpers
