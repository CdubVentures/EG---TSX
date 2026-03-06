# src/core â€” Domain

Cross-cutting logic that any feature or layout may import.
No feature-specific knowledge lives here.

## Public API

### config.ts
- `CONFIG` â€” centralized behavioral knobs (pagination, timeouts, scores, CDN, categories)
- `categoryColor(cat)` â€” hex color for a category ID
- `plural(cat)` â€” canonical plural label ("Mice", "Keyboards", etc.)
- `siteColors` â€” primary/secondary gradient colors from `categories.json`
- `Category`, `Genre` â€” derived union types

### categories.ts
- `deriveCategoryColors(hex)` â€” derive all color variants from a single base hex
- `getCategoryColors(cat)` â€” shorthand: `deriveCategoryColors(categoryColor(cat))`
- `buildCategoryVarsBlock()` â€” complete CSS block for `<style>` injection (`:root` + `.cat-color` classes)
- `buildAllCategoryVars()` / `buildAllCategoryClasses()` â€” individual pieces
- `deriveSiteVars(primary, secondary)` â€” site-wide `--site-*` CSS variables
- `categoryColorClass(id)` â€” `.{id}-color { --card-*: var(--cat-{id}-*) }` indirection
- `catVar(cat)` â€” returns `var(--cat-{cat})`

### images.ts
- `contentImage(basePath, stem, size, ext?)` â€” universal image URL resolver
- `collectionImagePath(collection, entryId)` â€” convention-based image folder path

### media.ts
- `getImage(media, view, options?)` â€” find a specific product image by view
- `getCarouselImages(media)` â€” ordered images for product carousel
- `getAvailableColors(media)` â€” list of available color options
- `hasColorVariants(media)` â€” boolean check
- `getImageForColor(media, color)` â€” feature image for a specific color

### products.ts (product gateway)
- `getProducts()` â€” returns all products filtered by `CONFIG.categories`
- Rule: Never call `getCollection('dataProducts')` directly. Always use `getProducts()`.

### content.ts (content gateway)
- `getArticles(collection)` â€” returns filtered, sorted entries for any article collection
- `getReviews()` / `getGuides()` / `getNews()` / `getBrands()` / `getGames()` â€” typed convenience wrappers
- Filters: `publish !== false`, `draft !== true`, category in `CONFIG.contentCategories`
- Sort: `datePublished` descending, nulls last
- Rule: Never call `getCollection('reviews'|'guides'|'news'|'brands'|'games')` directly. Always use `getArticles()`.
- Exception: GlobalNav may use raw `getCollection()` for navbar-specific filtering (navbar field assignment)

### hub-tools.ts (hub tools gateway)
- `getDesktopTools()` â€” flat list of enabled tools, sorted by tool priority then category order
- `getMobileTools()` â€” grouped by category, each group sorted by tool priority
- `getToolsForCategory(catId)` â€” tools for a specific category (hub sidebar)
- `getToolTooltip(toolType)` â€” shared tooltip text for a tool type
- Rule: Never read `hub-tools.json` directly. Always use the gateway functions.

### hub-tools-filter.mjs (pure filter/sort logic)
- `filterHubTools(tools, activeCategories)` â€” filter by active categories + enabled flag
- `sortDesktopTools(tools, categoryOrder?)` â€” sort by tool priority (hubâ†’databaseâ†’shapesâ†’versusâ†’radar), then category order
- `groupMobileTools(tools, categoryOrder?)` â€” group by category, sort groups by category order, sort tools within each group by priority
- `TOOL_PRIORITY` â€” canonical tool type sort order
- Tests: `test/hub-tools-filter.test.mjs` (15 tests)

### routing/slugs.ts
- URL slug generation and normalization utilities

## Dependencies
- Reads `config/data/categories.json` (SSOT for category definitions + site colors)
- Reads `config/data/hub-tools.json` (tool definitions per category)
- No feature imports allowed â€” core is a leaf dependency

## Empty stubs (reserved)
- `auth/` â€” reserved for server-side auth utilities (JWT verification, etc.)
- `seo/` â€” reserved for SEO/meta-tag generation helpers
