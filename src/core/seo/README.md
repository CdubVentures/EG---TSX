# src/core/seo

## Purpose

`src/core/seo/` centralizes SEO, sitemap, canonical URL, robots, and route-graph
contracts used by pages, APIs, and validation scripts.

## Public API (The Contract)

- `indexation-policy.ts`
  Exports robots directives, `buildDocumentIndexation()`,
  `withNoIndexHeaders()`, `jsonNoIndex()`, and `buildRobotsTxt()`.
- `sitemap-manifest.ts`
  Exports sitemap extraction and diff helpers.
- `route-graph.ts`
  Exports internal-link, canonical, orphan-page, and sitemap analysis helpers.
- `route-graph-log.ts`
  Exports `formatRouteGraphLog()`.
- `url-contract.ts`
  Exports stable product/article URL builders and URL contract helpers.

## Dependencies

Allowed imports:

- Other `@core/*` modules
- TypeScript/Node standard library APIs
- Built HTML or XML artifacts for analysis

Forbidden imports:

- `@features/*`
- `@shared/*`
- `src/pages/*`

## Mutation Boundaries

- Read-only by default.
- May format headers and analyze generated artifacts.
- Must not write files, mutate databases, or call external APIs.

## Domain Invariants

- Canonical URL and robots behavior must be defined here once, then reused.
- Route-graph validation analyzes built output; it does not own routing.
- Product URL normalization must preserve established site URL patterns.
