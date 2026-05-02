import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  extractInternalLinks,
  findUnresolvedLinks,
  findOrphanPages,
  findCanonicalMismatches,
  findDuplicateCanonicals,
  findSitemapMismatches,
  findNoindexLeaks,
  analyzeRouteGraph,
} from '../seo/route-graph.ts';

const SITE_URL = 'https://eggear.com';

// ---------------------------------------------------------------------------
// Helper — creates a minimal page
// ---------------------------------------------------------------------------

function page(routePath, html = '<html><body></body></html>') {
  return { routePath, html };
}

function pageWithCanonical(routePath, canonicalUrl) {
  return page(routePath, `<html><head><link rel="canonical" href="${canonicalUrl}"></head><body></body></html>`);
}

function pageWithNoindex(routePath) {
  return page(routePath, '<html><head><meta name="robots" content="noindex,nofollow"></head><body></body></html>');
}

function pageWithLinks(routePath, links) {
  const anchors = links.map(href => `<a href="${href}">link</a>`).join('');
  return page(routePath, `<html><body>${anchors}</body></html>`);
}

function pageWithLinksAndCanonical(routePath, links, canonicalUrl) {
  const anchors = links.map(href => `<a href="${href}">link</a>`).join('');
  return page(routePath, `<html><head><link rel="canonical" href="${canonicalUrl}"></head><body>${anchors}</body></html>`);
}

// ---------------------------------------------------------------------------
// extractInternalLinks
// ---------------------------------------------------------------------------

describe('extractInternalLinks', () => {
  it('extracts site-local absolute hrefs', () => {
    const html = '<a href="https://eggear.com/reviews/mouse-1/">Review</a>';
    const links = extractInternalLinks(html, SITE_URL);
    assert.deepEqual(links, ['/reviews/mouse-1/']);
  });

  it('extracts relative hrefs', () => {
    const html = '<a href="/brands/razer/">Razer</a><a href="/guides/mouse/">Guide</a>';
    const links = extractInternalLinks(html, SITE_URL);
    assert.deepEqual(links.sort(), ['/brands/razer/', '/guides/mouse/']);
  });

  it('excludes fragment-only links', () => {
    const html = '<a href="#section">Jump</a>';
    const links = extractInternalLinks(html, SITE_URL);
    assert.deepEqual(links, []);
  });

  it('excludes mailto links', () => {
    const html = '<a href="mailto:test@example.com">Email</a>';
    const links = extractInternalLinks(html, SITE_URL);
    assert.deepEqual(links, []);
  });

  it('excludes tel links', () => {
    const html = '<a href="tel:+1234567890">Call</a>';
    const links = extractInternalLinks(html, SITE_URL);
    assert.deepEqual(links, []);
  });

  it('excludes external links', () => {
    const html = '<a href="https://google.com/search">Google</a>';
    const links = extractInternalLinks(html, SITE_URL);
    assert.deepEqual(links, []);
  });

  it('excludes asset URLs (/images/)', () => {
    const html = '<a href="/images/mice/razer/photo.webp">Photo</a>';
    const links = extractInternalLinks(html, SITE_URL);
    assert.deepEqual(links, []);
  });

  it('excludes API routes', () => {
    const html = '<a href="/api/auth/login">Login</a>';
    const links = extractInternalLinks(html, SITE_URL);
    assert.deepEqual(links, []);
  });

  it('strips fragment from URLs before returning', () => {
    const html = '<a href="/reviews/mouse-1/#specs">Specs</a>';
    const links = extractInternalLinks(html, SITE_URL);
    assert.deepEqual(links, ['/reviews/mouse-1/']);
  });

  it('deduplicates links', () => {
    const html = '<a href="/reviews/">R1</a><a href="/reviews/">R2</a>';
    const links = extractInternalLinks(html, SITE_URL);
    assert.deepEqual(links, ['/reviews/']);
  });

  it('returns empty for page with no anchors', () => {
    const html = '<html><body><p>No links</p></body></html>';
    const links = extractInternalLinks(html, SITE_URL);
    assert.deepEqual(links, []);
  });
});

// ---------------------------------------------------------------------------
// findUnresolvedLinks
// ---------------------------------------------------------------------------

describe('findUnresolvedLinks', () => {
  it('reports links to non-existent routes', () => {
    const pages = [
      pageWithLinks('/', ['/reviews/', '/nonexistent/']),
      page('/reviews/'),
    ];
    const issues = findUnresolvedLinks(pages, SITE_URL);
    assert.equal(issues.length, 1);
    assert.equal(issues[0].type, 'unresolved_link');
    assert.equal(issues[0].sourcePath, '/');
    assert.equal(issues[0].targetPath, '/nonexistent/');
  });

  it('returns empty when all links resolve', () => {
    const pages = [
      pageWithLinks('/', ['/reviews/', '/brands/']),
      page('/reviews/'),
      page('/brands/'),
    ];
    const issues = findUnresolvedLinks(pages, SITE_URL);
    assert.equal(issues.length, 0);
  });

  it('handles pages with no links', () => {
    const pages = [page('/')];
    const issues = findUnresolvedLinks(pages, SITE_URL);
    assert.equal(issues.length, 0);
  });

  it('handles absolute internal links', () => {
    const pages = [
      pageWithLinks('/', ['https://eggear.com/missing/']),
    ];
    const issues = findUnresolvedLinks(pages, SITE_URL);
    assert.equal(issues.length, 1);
    assert.equal(issues[0].targetPath, '/missing/');
  });
});

// ---------------------------------------------------------------------------
// findOrphanPages
// ---------------------------------------------------------------------------

describe('findOrphanPages', () => {
  it('reports indexable pages unreachable from root', () => {
    const pages = [
      pageWithLinks('/', ['/reviews/']),
      page('/reviews/'),
      page('/brands/razer/'),  // orphan — no links point here
    ];
    const issues = findOrphanPages(pages, SITE_URL);
    assert.equal(issues.length, 1);
    assert.equal(issues[0].type, 'orphan_page');
    assert.equal(issues[0].sourcePath, '/brands/razer/');
  });

  it('returns empty when all indexable pages are reachable', () => {
    const pages = [
      pageWithLinks('/', ['/reviews/', '/brands/']),
      pageWithLinks('/reviews/', ['/brands/']),
      page('/brands/'),
    ];
    const issues = findOrphanPages(pages, SITE_URL);
    assert.equal(issues.length, 0);
  });

  it('excludes noindex pages from orphan detection', () => {
    const pages = [
      pageWithLinks('/', ['/reviews/']),
      page('/reviews/'),
      pageWithNoindex('/search/'),  // noindex — should NOT be flagged as orphan
    ];
    const issues = findOrphanPages(pages, SITE_URL);
    assert.equal(issues.length, 0);
  });

  it('follows multi-hop link chains', () => {
    const pages = [
      pageWithLinks('/', ['/level-1/']),
      pageWithLinks('/level-1/', ['/level-2/']),
      pageWithLinks('/level-2/', ['/level-3/']),
      page('/level-3/'),
    ];
    const issues = findOrphanPages(pages, SITE_URL);
    assert.equal(issues.length, 0);
  });

  it('handles site with only root page', () => {
    const pages = [page('/')];
    const issues = findOrphanPages(pages, SITE_URL);
    assert.equal(issues.length, 0);
  });
});

// ---------------------------------------------------------------------------
// findCanonicalMismatches
// ---------------------------------------------------------------------------

describe('findCanonicalMismatches', () => {
  it('reports canonical pointing to non-existent route', () => {
    const pages = [
      pageWithCanonical('/', 'https://eggear.com/'),
      pageWithCanonical('/reviews/mouse-1/', 'https://eggear.com/wrong-path/'),
    ];
    const issues = findCanonicalMismatches(pages, SITE_URL);
    assert.equal(issues.length, 1);
    assert.equal(issues[0].type, 'canonical_mismatch');
    assert.ok(issues[0].detail.includes('/wrong-path/'));
  });

  it('reports canonical pointing to different route family', () => {
    const pages = [
      pageWithCanonical('/', 'https://eggear.com/'),
      pageWithCanonical('/reviews/mouse-1/', 'https://eggear.com/news/mouse-1/'),
      page('/news/mouse-1/'),
    ];
    const issues = findCanonicalMismatches(pages, SITE_URL);
    assert.equal(issues.length, 1);
    assert.equal(issues[0].sourcePath, '/reviews/mouse-1/');
  });

  it('returns empty when all canonicals are self-referencing', () => {
    const pages = [
      pageWithCanonical('/', 'https://eggear.com/'),
      pageWithCanonical('/reviews/', 'https://eggear.com/reviews/'),
    ];
    const issues = findCanonicalMismatches(pages, SITE_URL);
    assert.equal(issues.length, 0);
  });

  it('skips pages without canonical tags', () => {
    const pages = [page('/')];
    const issues = findCanonicalMismatches(pages, SITE_URL);
    assert.equal(issues.length, 0);
  });
});

// ---------------------------------------------------------------------------
// findDuplicateCanonicals
// ---------------------------------------------------------------------------

describe('findDuplicateCanonicals', () => {
  it('reports multiple pages sharing the same canonical', () => {
    const pages = [
      pageWithCanonical('/page-a/', 'https://eggear.com/shared/'),
      pageWithCanonical('/page-b/', 'https://eggear.com/shared/'),
      page('/shared/'),
    ];
    const issues = findDuplicateCanonicals(pages, SITE_URL);
    assert.equal(issues.length, 1);
    assert.equal(issues[0].type, 'duplicate_canonical');
    assert.ok(issues[0].detail.includes('/shared/'));
  });

  it('returns empty when all canonicals are unique', () => {
    const pages = [
      pageWithCanonical('/', 'https://eggear.com/'),
      pageWithCanonical('/reviews/', 'https://eggear.com/reviews/'),
    ];
    const issues = findDuplicateCanonicals(pages, SITE_URL);
    assert.equal(issues.length, 0);
  });

  it('skips pages without canonical tags', () => {
    const pages = [page('/'), page('/reviews/')];
    const issues = findDuplicateCanonicals(pages, SITE_URL);
    assert.equal(issues.length, 0);
  });
});

// ---------------------------------------------------------------------------
// findSitemapMismatches
// ---------------------------------------------------------------------------

describe('findSitemapMismatches', () => {
  it('reports pages missing from sitemap', () => {
    const pages = [
      pageWithCanonical('/', 'https://eggear.com/'),
      pageWithCanonical('/reviews/', 'https://eggear.com/reviews/'),
    ];
    const sitemapUrls = ['https://eggear.com/'];
    const issues = findSitemapMismatches(pages, sitemapUrls, SITE_URL);
    const missing = issues.filter(i => i.detail.includes('built but not in sitemap'));
    assert.equal(missing.length, 1);
  });

  it('reports sitemap URLs not backed by built pages', () => {
    const pages = [
      pageWithCanonical('/', 'https://eggear.com/'),
    ];
    const sitemapUrls = [
      'https://eggear.com/',
      'https://eggear.com/phantom/',
    ];
    const issues = findSitemapMismatches(pages, sitemapUrls, SITE_URL);
    const unexpected = issues.filter(i => i.detail.includes('in sitemap but not built'));
    assert.equal(unexpected.length, 1);
  });

  it('returns empty when sitemap matches built pages', () => {
    const pages = [
      pageWithCanonical('/', 'https://eggear.com/'),
      pageWithCanonical('/reviews/', 'https://eggear.com/reviews/'),
    ];
    const sitemapUrls = [
      'https://eggear.com/',
      'https://eggear.com/reviews/',
    ];
    const issues = findSitemapMismatches(pages, sitemapUrls, SITE_URL);
    assert.equal(issues.length, 0);
  });
});

// ---------------------------------------------------------------------------
// findNoindexLeaks
// ---------------------------------------------------------------------------

describe('findNoindexLeaks', () => {
  it('reports utility routes missing noindex', () => {
    // /api/ route without noindex — should be a leak
    const pages = [
      page('/'),
      page('/api/data/'),  // no noindex — leak
    ];
    const issues = findNoindexLeaks(pages);
    assert.equal(issues.length, 1);
    assert.equal(issues[0].type, 'noindex_leak');
    assert.equal(issues[0].sourcePath, '/api/data/');
  });

  it('returns empty when utility routes have noindex', () => {
    const pages = [
      page('/'),
      pageWithNoindex('/api/data/'),
      pageWithNoindex('/login/'),
      pageWithNoindex('/profile/'),
    ];
    const issues = findNoindexLeaks(pages);
    assert.equal(issues.length, 0);
  });

  it('accepts custom disallow paths', () => {
    const pages = [
      page('/'),
      page('/admin/'),  // no noindex — custom disallow
    ];
    const issues = findNoindexLeaks(pages, ['/admin/']);
    assert.equal(issues.length, 1);
    assert.equal(issues[0].sourcePath, '/admin/');
  });

  it('does not flag normal content pages', () => {
    const pages = [
      page('/'),
      page('/reviews/mouse-1/'),
      page('/brands/razer/'),
    ];
    const issues = findNoindexLeaks(pages);
    assert.equal(issues.length, 0);
  });
});

// ---------------------------------------------------------------------------
// analyzeRouteGraph — orchestrator
// ---------------------------------------------------------------------------

describe('analyzeRouteGraph', () => {
  it('aggregates all check results', () => {
    const pages = [
      pageWithLinksAndCanonical('/', ['/reviews/'], 'https://eggear.com/'),
      pageWithCanonical('/reviews/', 'https://eggear.com/reviews/'),
      page('/orphan/'),         // orphan — unreachable
      page('/api/data/'),       // noindex leak
    ];
    const sitemapUrls = [
      'https://eggear.com/',
      'https://eggear.com/reviews/',
    ];

    const report = analyzeRouteGraph({
      pages,
      sitemapUrls,
      siteUrl: SITE_URL,
    });

    assert.ok(report.totalIssueCount >= 2);
    assert.ok(report.summary.orphanPages >= 1);
    assert.ok(report.summary.noindexLeaks >= 1);
    assert.ok(Array.isArray(report.issues));
  });

  it('returns zero issues for clean site', () => {
    const pages = [
      pageWithLinksAndCanonical('/', ['/reviews/', '/brands/'], 'https://eggear.com/'),
      pageWithCanonical('/reviews/', 'https://eggear.com/reviews/'),
      pageWithCanonical('/brands/', 'https://eggear.com/brands/'),
    ];
    const sitemapUrls = [
      'https://eggear.com/',
      'https://eggear.com/reviews/',
      'https://eggear.com/brands/',
    ];

    const report = analyzeRouteGraph({
      pages,
      sitemapUrls,
      siteUrl: SITE_URL,
    });

    assert.equal(report.totalIssueCount, 0);
    assert.deepEqual(report.summary, {
      unresolvedLinks: 0,
      orphanPages: 0,
      canonicalMismatches: 0,
      sitemapMismatches: 0,
      noindexLeaks: 0,
      duplicateCanonicals: 0,
    });
  });

  it('summary counts match issue array', () => {
    const pages = [
      pageWithLinksAndCanonical('/', ['/reviews/', '/missing/'], 'https://eggear.com/'),
      pageWithCanonical('/reviews/', 'https://eggear.com/reviews/'),
    ];
    const sitemapUrls = [
      'https://eggear.com/',
      'https://eggear.com/reviews/',
    ];

    const report = analyzeRouteGraph({
      pages,
      sitemapUrls,
      siteUrl: SITE_URL,
    });

    const countFromIssues = report.issues.length;
    assert.equal(report.totalIssueCount, countFromIssues);
  });

  it('uses custom robotsDisallowPaths when provided', () => {
    const pages = [
      pageWithLinksAndCanonical('/', ['/admin/'], 'https://eggear.com/'),
      page('/admin/'),
    ];
    const sitemapUrls = ['https://eggear.com/'];

    const report = analyzeRouteGraph({
      pages,
      sitemapUrls,
      siteUrl: SITE_URL,
      robotsDisallowPaths: ['/admin/'],
    });

    const leaks = report.issues.filter(i => i.type === 'noindex_leak');
    assert.equal(leaks.length, 1);
  });
});
