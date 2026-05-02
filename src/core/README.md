# src/core

## Purpose

`src/core/` is the shared kernel for EG - TSX. It owns validated config/data
contracts, collection gateways, image helpers, routing helpers, and SEO/cache
policies that any page, layout, or feature may consume.

## Public API (The Contract)

- `config.ts`
  Exports `CONFIG`, `imageDefaults()`, `viewObjectFit()`, `Category`, `Genre`,
  and re-exports category helpers such as `siteColors`, `label()`, `plural()`,
  `categoryColor()`, `allCategoryIds`, `activeProductCategoryIds`, and
  `activeContentCategoryIds`.
- `category-contract.ts`
  Exports the validated category types and lookups:
  `CategoryToggle`, `CategoryCollections`, `CategoryDef`, `CategoryCollection`,
  `Category`, `siteColors`, `allCategoryDefs`, `allCategoryIds`,
  `activeProductCategoryIds`, `activeContentCategoryIds`, `collectionCategoryIds`,
  `collectionEnumValues`, `isProductActive()`, `isContentActive()`, `label()`,
  `plural()`, and `categoryColor()`.
- `cache-cdn-contract.ts`
  Exports `CACHE_POLICY_NAMES`, `CACHE_PAGE_TYPE_NAMES`,
  `CACHE_CDN_CONTRACT`, `getCachePolicy()`, `getCachePageType()`,
  `getPageTypePolicyName()`, `resolveTargetPolicyName()`,
  `buildCacheControlHeader()`, and `withCachePolicyHeaders()`.
- `content.ts`
  Exports `getArticles()`, `getReviews()`, `getGuides()`, `getNews()`,
  `getBrands()`, and `getGames()`.
- `products.ts`
  Exports `getProducts()`.
- `hub-tools.ts`
  Exports `HubTool`, `HubToolGroup`, `getDesktopTools()`, `getMobileTools()`,
  `getToolsForCategory()`, and `getToolTooltip()`.
- `article-helpers.ts`
  Exports `ArticleCollection`, `DashboardEntry`, `articleUrl()`,
  `resolveHero()`, `articleSrcSet()`, and `formatArticleDate()`.
- `images.ts`
  Exports `ImageSize`, `contentImage()`, `collectionImagePath()`,
  and `tryImageFallback()`.
- `image-path.ts`
  Exports `BuildContentImageUrlOptions`, `normalizeContentImagePath()`,
  and `buildContentImageUrl()`.
- `media.ts`
  Exports `ProductImage`, `ProductMedia`, `getCarouselImages()`, `getImage()`,
  `getImageWithFallback()`, `resolveImage()`, `getImageForColor()`,
  `getAvailableColors()`, and `hasColorVariants()`.
- `routing/slugs.ts`
  Exports `fileNameToSlug()`, `productToSlug()`, `toSlug()`,
  `brandNameToSlug()`, and `gameNameToSlug()`.
- `seo/indexation-policy.ts`
  Exports `INDEXABLE_ROBOTS_DIRECTIVES`, `NOINDEX_ROBOTS_DIRECTIVES`,
  `DEFAULT_ROBOTS_TXT_DISALLOWS`, `buildDocumentIndexation()`,
  `withNoIndexHeaders()`, `jsonNoIndex()`, and `buildRobotsTxt()`.
- `seo/sitemap-manifest.ts`
  Exports `BuiltHtmlPage`, `BuildExpectedSitemapUrlsOptions`,
  `DiffSitemapUrlsOptions`, `SitemapDiffReport`, `extractCanonicalUrl()`,
  `isNoIndexHtml()`, `toAbsoluteUrl()`, `buildExpectedSitemapUrls()`,
  `extractLocUrls()`, and `diffSitemapUrls()`.
- `seo/route-graph.ts`
  Exports `RouteGraphAnalysisInput`, `RouteGraphIssue`, `RouteGraphReport`,
  `extractInternalLinks()`, `findUnresolvedLinks()`, `findOrphanPages()`,
  `findCanonicalMismatches()`, `findDuplicateCanonicals()`,
  `findSitemapMismatches()`, `findNoindexLeaks()`, and `analyzeRouteGraph()`.
- `seo/route-graph-log.ts`
  Exports `FormatRouteGraphLogOptions` and `formatRouteGraphLog()`.

## Dependencies

Allowed imports:

- TypeScript/Node standard library APIs
- `astro:content`
- `zod`
- `config/data/*.json`
- `public/images/**` for build-time image resolution
- Other `src/core/**` modules

Forbidden imports:

- `src/features/**`
- `src/shared/**`
- `src/pages/**`

## Mutation Boundaries

- Read-only by default.
- May read checked-in JSON and image assets.
- Must not write files, emit network mutations, or own UI state.

## Domain Invariants

- Core is a leaf dependency; feature code depends on core, never the reverse.
- Collection consumers must go through `getProducts()` or `getArticles()`
  helpers instead of raw collection access.
- Shared cache/CDN behavior must come from `cache-cdn-contract.ts`, not
  hardcoded headers in routes.
- Category labels, colors, and active-state rules are single-sourced from
  `category-contract.ts`.

## Local Sub-Boundaries

- [seo/README.md](seo/README.md)
- [routing/README.md](routing/README.md)
- [tests/README.md](tests/README.md)
