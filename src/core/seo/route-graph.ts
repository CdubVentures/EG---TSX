/**
 * Route-graph analysis — pure functions that inspect pre-read page data
 * and produce a structured report of crawl-topology issues.
 *
 * No filesystem I/O. Fully testable with synthetic data.
 */

import {
  extractCanonicalUrl,
  isNoIndexHtml,
  buildExpectedSitemapUrls,
  diffSitemapUrls,
  toAbsoluteUrl,
  type BuiltHtmlPage,
} from './sitemap-manifest.ts';

import { DEFAULT_ROBOTS_TXT_DISALLOWS } from './indexation-policy.ts';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface RouteGraphAnalysisInput {
  pages: BuiltHtmlPage[];
  sitemapUrls: string[];
  siteUrl: string;
  robotsDisallowPaths?: string[];
}

export interface RouteGraphIssue {
  type:
    | 'unresolved_link'
    | 'orphan_page'
    | 'canonical_mismatch'
    | 'sitemap_mismatch'
    | 'noindex_leak'
    | 'duplicate_canonical';
  detail: string;
  sourcePath?: string;
  targetPath?: string;
}

export interface RouteGraphReport {
  issues: RouteGraphIssue[];
  summary: {
    unresolvedLinks: number;
    orphanPages: number;
    canonicalMismatches: number;
    sitemapMismatches: number;
    noindexLeaks: number;
    duplicateCanonicals: number;
  };
  totalIssueCount: number;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function normalizeSiteUrl(siteUrl: string): string {
  return siteUrl.endsWith('/') ? siteUrl.slice(0, -1) : siteUrl;
}

function routePathFromAbsoluteUrl(absoluteUrl: string, siteUrl: string): string | null {
  const base = normalizeSiteUrl(siteUrl);
  if (!absoluteUrl.startsWith(base)) return null;
  const path = absoluteUrl.slice(base.length);
  return path || '/';
}

function isAssetPath(path: string): boolean {
  return path.startsWith('/images/');
}

function isApiPath(path: string): boolean {
  return path.startsWith('/api/');
}

function getRouteFamily(routePath: string): string {
  const segments = routePath.split('/').filter(Boolean);
  return segments[0] ?? '';
}

// ---------------------------------------------------------------------------
// extractInternalLinks
// ---------------------------------------------------------------------------

/**
 * Extracts internal (same-site) link hrefs from HTML.
 * Excludes fragments, mailto, tel, assets, API routes, and external links.
 */
export function extractInternalLinks(html: string, siteUrl: string): string[] {
  const base = normalizeSiteUrl(siteUrl);
  const hrefPattern = /<a\b[^>]*\bhref=["']([^"']+)["'][^>]*>/gi;
  const seen = new Set<string>();
  const results: string[] = [];

  let match: RegExpExecArray | null;
  while ((match = hrefPattern.exec(html)) !== null) {
    let href = match[1]!.trim();

    // Skip non-navigable schemes
    if (href.startsWith('mailto:') || href.startsWith('tel:') || href.startsWith('javascript:')) continue;
    // Skip fragment-only links
    if (href.startsWith('#')) continue;

    let routePath: string;

    if (href.startsWith('http://') || href.startsWith('https://')) {
      // Absolute URL — must be same site
      if (!href.startsWith(base)) continue;
      const parsed = new URL(href);
      routePath = parsed.pathname;
    } else if (href.startsWith('/')) {
      // Site-relative path — strip fragment
      const hashIndex = href.indexOf('#');
      routePath = hashIndex >= 0 ? href.slice(0, hashIndex) : href;
    } else {
      // Relative path — skip
      continue;
    }

    // Normalize: ensure trailing slash for non-file paths
    if (!routePath.endsWith('/') && !routePath.includes('.')) {
      routePath = routePath + '/';
    }

    // Skip assets and API routes
    if (isAssetPath(routePath) || isApiPath(routePath)) continue;

    if (!seen.has(routePath)) {
      seen.add(routePath);
      results.push(routePath);
    }
  }

  return results;
}

// ---------------------------------------------------------------------------
// findUnresolvedLinks
// ---------------------------------------------------------------------------

/**
 * Reports links from built pages that point to routes not in the built set.
 */
export function findUnresolvedLinks(pages: BuiltHtmlPage[], siteUrl: string): RouteGraphIssue[] {
  const knownRoutes = new Set(pages.map(p => p.routePath));
  const issues: RouteGraphIssue[] = [];

  for (const page of pages) {
    const links = extractInternalLinks(page.html, siteUrl);
    for (const target of links) {
      if (!knownRoutes.has(target)) {
        issues.push({
          type: 'unresolved_link',
          detail: `${page.routePath} -> ${target}`,
          sourcePath: page.routePath,
          targetPath: target,
        });
      }
    }
  }

  return issues;
}

// ---------------------------------------------------------------------------
// findOrphanPages
// ---------------------------------------------------------------------------

/**
 * Reports indexable pages that cannot be reached via BFS from `/`.
 * Noindex pages are excluded from orphan detection.
 */
export function findOrphanPages(pages: BuiltHtmlPage[], siteUrl: string): RouteGraphIssue[] {
  const indexablePages = pages.filter(p => !isNoIndexHtml(p.html));

  // Build adjacency list from links
  const adjacency = new Map<string, string[]>();
  for (const page of pages) {
    adjacency.set(page.routePath, extractInternalLinks(page.html, siteUrl));
  }

  // BFS from root
  const visited = new Set<string>();
  const queue: string[] = ['/'];
  visited.add('/');

  while (queue.length > 0) {
    const current = queue.shift()!;
    const neighbors = adjacency.get(current) ?? [];
    for (const neighbor of neighbors) {
      if (!visited.has(neighbor)) {
        visited.add(neighbor);
        queue.push(neighbor);
      }
    }
  }

  const issues: RouteGraphIssue[] = [];
  for (const page of indexablePages) {
    if (page.routePath === '/') continue;
    if (!visited.has(page.routePath)) {
      issues.push({
        type: 'orphan_page',
        detail: `${page.routePath} is not reachable from /`,
        sourcePath: page.routePath,
      });
    }
  }

  return issues;
}

// ---------------------------------------------------------------------------
// findCanonicalMismatches
// ---------------------------------------------------------------------------

/**
 * Reports pages where canonical points to a different route family
 * or to a non-existent route.
 */
export function findCanonicalMismatches(pages: BuiltHtmlPage[], siteUrl: string): RouteGraphIssue[] {
  const knownRoutes = new Set(pages.map(p => p.routePath));
  const issues: RouteGraphIssue[] = [];

  for (const page of pages) {
    const canonical = extractCanonicalUrl(page.html);
    if (!canonical) continue;

    const canonicalRoute = routePathFromAbsoluteUrl(canonical, siteUrl);
    if (!canonicalRoute) continue; // External canonical — not our concern

    // Self-referencing canonical is fine
    if (canonicalRoute === page.routePath) continue;

    // Canonical points to different route family
    const pageFamily = getRouteFamily(page.routePath);
    const canonicalFamily = getRouteFamily(canonicalRoute);

    if (pageFamily !== canonicalFamily) {
      issues.push({
        type: 'canonical_mismatch',
        detail: `${page.routePath} canonical=${canonical} (different family: ${pageFamily} → ${canonicalFamily})`,
        sourcePath: page.routePath,
        targetPath: canonicalRoute,
      });
      continue;
    }

    // Canonical points to non-existent route
    if (!knownRoutes.has(canonicalRoute)) {
      issues.push({
        type: 'canonical_mismatch',
        detail: `${page.routePath} canonical=${canonical} (target does not exist)`,
        sourcePath: page.routePath,
        targetPath: canonicalRoute,
      });
    }
  }

  return issues;
}

// ---------------------------------------------------------------------------
// findDuplicateCanonicals
// ---------------------------------------------------------------------------

/**
 * Reports when multiple pages share the same canonical URL.
 */
export function findDuplicateCanonicals(pages: BuiltHtmlPage[], _siteUrl: string): RouteGraphIssue[] {
  const canonicalMap = new Map<string, string[]>();

  for (const page of pages) {
    const canonical = extractCanonicalUrl(page.html);
    if (!canonical) continue;

    const existing = canonicalMap.get(canonical);
    if (existing) {
      existing.push(page.routePath);
    } else {
      canonicalMap.set(canonical, [page.routePath]);
    }
  }

  const issues: RouteGraphIssue[] = [];
  for (const [canonical, routePaths] of canonicalMap) {
    if (routePaths.length > 1) {
      issues.push({
        type: 'duplicate_canonical',
        detail: `${routePaths.join(', ')} share canonical ${canonical}`,
        sourcePath: routePaths[0],
        targetPath: canonical,
      });
    }
  }

  return issues;
}

// ---------------------------------------------------------------------------
// findSitemapMismatches
// ---------------------------------------------------------------------------

/**
 * Reports drift between built pages and sitemap URLs.
 * Reuses diffSitemapUrls from sitemap-manifest.ts.
 */
export function findSitemapMismatches(
  pages: BuiltHtmlPage[],
  sitemapUrls: string[],
  siteUrl: string,
): RouteGraphIssue[] {
  const expected = buildExpectedSitemapUrls({ siteUrl, pages });
  const diff = diffSitemapUrls({ expected, actual: sitemapUrls });

  const issues: RouteGraphIssue[] = [];

  for (const url of diff.missing) {
    issues.push({
      type: 'sitemap_mismatch',
      detail: `built but not in sitemap: ${url}`,
      sourcePath: routePathFromAbsoluteUrl(url, siteUrl) ?? url,
    });
  }

  for (const url of diff.unexpected) {
    issues.push({
      type: 'sitemap_mismatch',
      detail: `in sitemap but not built: ${url}`,
      targetPath: url,
    });
  }

  return issues;
}

// ---------------------------------------------------------------------------
// findNoindexLeaks
// ---------------------------------------------------------------------------

/**
 * Reports routes that should be excluded by indexation policy
 * but appear indexable in the built output.
 */
export function findNoindexLeaks(
  pages: BuiltHtmlPage[],
  robotsDisallowPaths?: string[],
): RouteGraphIssue[] {
  const disallowPaths = robotsDisallowPaths ?? DEFAULT_ROBOTS_TXT_DISALLOWS;
  const issues: RouteGraphIssue[] = [];

  for (const page of pages) {
    const shouldBeNoindex = disallowPaths.some(
      disallow => page.routePath.startsWith(disallow),
    );

    if (shouldBeNoindex && !isNoIndexHtml(page.html)) {
      issues.push({
        type: 'noindex_leak',
        detail: `${page.routePath} is indexable but should be noindexed per policy`,
        sourcePath: page.routePath,
      });
    }
  }

  return issues;
}

// ---------------------------------------------------------------------------
// analyzeRouteGraph — orchestrator
// ---------------------------------------------------------------------------

/**
 * Runs all route-graph checks and produces an aggregated report.
 */
export function analyzeRouteGraph(input: RouteGraphAnalysisInput): RouteGraphReport {
  const { pages, sitemapUrls, siteUrl, robotsDisallowPaths } = input;

  const unresolvedLinkIssues = findUnresolvedLinks(pages, siteUrl);
  const orphanIssues = findOrphanPages(pages, siteUrl);
  const canonicalIssues = findCanonicalMismatches(pages, siteUrl);
  const duplicateCanonicalIssues = findDuplicateCanonicals(pages, siteUrl);
  const sitemapIssues = findSitemapMismatches(pages, sitemapUrls, siteUrl);
  const noindexIssues = findNoindexLeaks(pages, robotsDisallowPaths);

  const issues = [
    ...unresolvedLinkIssues,
    ...orphanIssues,
    ...canonicalIssues,
    ...duplicateCanonicalIssues,
    ...sitemapIssues,
    ...noindexIssues,
  ];

  return {
    issues,
    summary: {
      unresolvedLinks: unresolvedLinkIssues.length,
      orphanPages: orphanIssues.length,
      canonicalMismatches: canonicalIssues.length,
      sitemapMismatches: sitemapIssues.length,
      noindexLeaks: noindexIssues.length,
      duplicateCanonicals: duplicateCanonicalIssues.length,
    },
    totalIssueCount: issues.length,
  };
}
