# Route-Graph Warning System

> **Status:** Active
> **Added:** 2026-03-09
> **Related:** [`system-map.md`](../03-architecture/system-map.md) | `../debug/deploy/README.md`

## What It Does

This is an advisory crawl-topology audit that runs after site builds. It checks
for internal link problems, orphan pages, canonical drift, sitemap mismatches,
and indexation leaks, then writes a timestamped warning log when issues are
found. It never blocks builds.

## Architecture

```text
src/core/seo/route-graph.ts         Pure analysis
src/core/seo/route-graph-log.ts     Plain-text formatter
           ->
scripts/lib/seo-io.mjs              Build-output and sitemap readers
scripts/validate-route-graph.mjs    Script gateway
           ->
scripts/deploy-aws.mjs              Post-build advisory check
           ->
debug/deploy/*.txt                  Warning reports for review
```

## Check Types

| Check | What it detects |
|------|------------------|
| `unresolved_link` | Internal links that point to routes missing from the build |
| `orphan_page` | Built indexable pages that are unreachable from `/` |
| `canonical_mismatch` | Canonical URLs pointing at the wrong route family or missing routes |
| `duplicate_canonical` | Multiple built pages sharing the same canonical URL |
| `sitemap_mismatch` | Sitemap URLs that do not match built pages |
| `noindex_leak` | Utility or auth routes that appear indexable when policy says they should not |

## Trigger Modes

The analyzer runs for site-oriented build flows:
- `quick`
- `full`
- `astro-publish`
- `astro-rebuild`
- `quick-sync-only`

It does not run for data-only or image-only publish flows.

## Output Contract

When warnings exist, the script emits a JSON payload and writes a log file.

Example payload:

```json
{
  "egTsxEvent": true,
  "kind": "route_graph_warning",
  "status": "warning",
  "mode": "astro-rebuild",
  "issueCount": 17,
  "logFile": "debug/deploy/2026-03-09_21-14-08_route-graph-warning.txt"
}
```

## Log Files

Written to `debug/deploy/` only when issues are found.

Filename pattern:
- `YYYY-MM-DD_HH-mm-ss_route-graph-warning.txt`

Contents include:
- summary counts by issue type
- per-issue detail sections
- build context such as mode, dist path, and sitemap inputs

## Programmatic API

```javascript
import { validateRouteGraph } from './scripts/validate-route-graph.mjs';

const result = await validateRouteGraph({
  clientDir: 'dist/client',
  siteUrl: 'https://eggear.com',
  mode: 'astro-rebuild',
  logDir: 'debug/deploy',
});
```

Returned shape:
- `result.report` - full issue report
- `result.event` - JSON warning event or `null`
- `result.logFile` - written log path or `null`

## Pure Analysis API

```typescript
import { analyzeRouteGraph } from './src/core/seo/route-graph.ts';

const report = analyzeRouteGraph({
  pages,
  sitemapUrls,
  siteUrl,
});
```

## Reused Modules

The analyzer reuses existing SEO infrastructure:
- `src/core/seo/sitemap-manifest.ts`
- `src/core/seo/indexation-policy.ts`
- `scripts/lib/seo-io.mjs`

## Tests

| Suite | File | Count |
|------|------|-------|
| Core analysis | `src/core/tests/route-graph.test.mjs` | 38 |
| Log formatter | `src/core/tests/route-graph-log.test.mjs` | 5 |
| Shared I/O | `test/seo-io.test.mjs` | 15 |
| Integration | `test/validate-route-graph.test.mjs` | 5 |
