import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { formatRouteGraphLog } from '../seo/route-graph-log.ts';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeReport(issueOverrides = {}) {
  const defaults = {
    issues: [],
    summary: {
      unresolvedLinks: 0,
      orphanPages: 0,
      canonicalMismatches: 0,
      sitemapMismatches: 0,
      noindexLeaks: 0,
      duplicateCanonicals: 0,
    },
    totalIssueCount: 0,
  };
  return { ...defaults, ...issueOverrides };
}

// ---------------------------------------------------------------------------
// formatRouteGraphLog
// ---------------------------------------------------------------------------

describe('formatRouteGraphLog', () => {
  it('produces correct header for a report with issues', () => {
    const report = makeReport({
      totalIssueCount: 3,
      summary: {
        unresolvedLinks: 1,
        orphanPages: 1,
        canonicalMismatches: 0,
        sitemapMismatches: 1,
        noindexLeaks: 0,
        duplicateCanonicals: 0,
      },
      issues: [
        { type: 'unresolved_link', detail: '/ -> /missing/', sourcePath: '/', targetPath: '/missing/' },
        { type: 'orphan_page', detail: '/orphan/ is not reachable from /', sourcePath: '/orphan/' },
        { type: 'sitemap_mismatch', detail: 'built but not in sitemap: https://eggear.com/orphan/', sourcePath: '/orphan/' },
      ],
    });

    const output = formatRouteGraphLog({
      report,
      timestamp: '2026-03-09 21:14:08',
      mode: 'astro-rebuild',
      buildResult: 'success',
      distPath: 'dist/client',
      sitemapFiles: ['sitemap-index.xml'],
    });

    assert.ok(output.includes('EG-TSX Route Graph Warning Report'));
    assert.ok(output.includes('Timestamp: 2026-03-09 21:14:08'));
    assert.ok(output.includes('Mode: astro-rebuild'));
    assert.ok(output.includes('Build Result: success'));
    assert.ok(output.includes('Audit Result: warnings'));
    assert.ok(output.includes('Total Issues: 3'));
  });

  it('includes summary counts', () => {
    const report = makeReport({
      totalIssueCount: 5,
      summary: {
        unresolvedLinks: 2,
        orphanPages: 1,
        canonicalMismatches: 1,
        sitemapMismatches: 1,
        noindexLeaks: 0,
        duplicateCanonicals: 0,
      },
      issues: [
        { type: 'unresolved_link', detail: '/ -> /a/' },
        { type: 'unresolved_link', detail: '/ -> /b/' },
        { type: 'orphan_page', detail: '/c/ is not reachable from /' },
        { type: 'canonical_mismatch', detail: '/d/ canonical=wrong' },
        { type: 'sitemap_mismatch', detail: 'built but not in sitemap: /e/' },
      ],
    });

    const output = formatRouteGraphLog({
      report,
      timestamp: '2026-03-09 21:14:08',
      mode: 'quick',
      buildResult: 'success',
      distPath: 'dist/client',
      sitemapFiles: [],
    });

    assert.ok(output.includes('- unresolved_links: 2'));
    assert.ok(output.includes('- orphan_pages: 1'));
    assert.ok(output.includes('- canonical_mismatches: 1'));
    assert.ok(output.includes('- sitemap_mismatches: 1'));
    assert.ok(output.includes('- noindex_leaks: 0'));
    assert.ok(output.includes('- duplicate_canonicals: 0'));
  });

  it('includes detail sections grouped by type', () => {
    const report = makeReport({
      totalIssueCount: 2,
      summary: {
        unresolvedLinks: 1,
        orphanPages: 1,
        canonicalMismatches: 0,
        sitemapMismatches: 0,
        noindexLeaks: 0,
        duplicateCanonicals: 0,
      },
      issues: [
        { type: 'unresolved_link', detail: '/ -> /missing/' },
        { type: 'orphan_page', detail: '/orphan/ is not reachable from /' },
      ],
    });

    const output = formatRouteGraphLog({
      report,
      timestamp: '2026-03-09 21:14:08',
      mode: 'full',
      buildResult: 'success',
      distPath: 'dist/client',
      sitemapFiles: ['sitemap-index.xml'],
    });

    assert.ok(output.includes('Unresolved Links'));
    assert.ok(output.includes('- / -> /missing/'));
    assert.ok(output.includes('Orphan Pages'));
    assert.ok(output.includes('- /orphan/ is not reachable from /'));
  });

  it('includes context footer', () => {
    const report = makeReport({ totalIssueCount: 1, issues: [{ type: 'orphan_page', detail: 'test' }] });

    const output = formatRouteGraphLog({
      report,
      timestamp: '2026-03-09 21:14:08',
      mode: 'astro-publish',
      buildResult: 'success',
      distPath: 'dist/client',
      sitemapFiles: ['sitemap-index.xml', 'sitemap-0.xml'],
    });

    assert.ok(output.includes('Dist path: dist/client'));
    assert.ok(output.includes('Sitemap files: sitemap-index.xml, sitemap-0.xml'));
    assert.ok(output.includes('Deploy mode: astro-publish'));
  });

  it('produces minimal output for zero-issue report', () => {
    const report = makeReport();

    const output = formatRouteGraphLog({
      report,
      timestamp: '2026-03-09 21:14:08',
      mode: 'quick',
      buildResult: 'success',
      distPath: 'dist/client',
      sitemapFiles: [],
    });

    assert.ok(output.includes('Audit Result: clean'));
    assert.ok(output.includes('Total Issues: 0'));
    // Should NOT include detail sections
    assert.ok(!output.includes('Unresolved Links'));
    assert.ok(!output.includes('Orphan Pages'));
  });
});
