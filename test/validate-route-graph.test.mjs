import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';

import { validateRouteGraph } from '../scripts/validate-route-graph.mjs';

// ---------------------------------------------------------------------------
// Helpers — synthetic dist directory
// ---------------------------------------------------------------------------

async function makeTempDist(structure) {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'route-graph-test-'));
  for (const [relPath, content] of Object.entries(structure)) {
    const fullPath = path.join(tmpDir, relPath);
    await fs.mkdir(path.dirname(fullPath), { recursive: true });
    await fs.writeFile(fullPath, content, 'utf8');
  }
  return tmpDir;
}

function htmlPage(canonical, links = [], noindex = false) {
  const canonicalTag = canonical ? `<link rel="canonical" href="${canonical}">` : '';
  const robotsTag = noindex ? '<meta name="robots" content="noindex,nofollow">' : '';
  const anchors = links.map(href => `<a href="${href}">link</a>`).join('');
  return `<html><head>${canonicalTag}${robotsTag}</head><body>${anchors}</body></html>`;
}

const SITE_URL = 'https://eggear.com';

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('validateRouteGraph', () => {
  it('returns structured result with issues', async () => {
    const clientDir = await makeTempDist({
      'index.html': htmlPage('https://eggear.com/', ['/reviews/']),
      'reviews/index.html': htmlPage('https://eggear.com/reviews/'),
      'orphan/index.html': htmlPage('https://eggear.com/orphan/'),
      'sitemap-index.xml': `<?xml version="1.0"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>https://eggear.com/</loc></url>
  <url><loc>https://eggear.com/reviews/</loc></url>
  <url><loc>https://eggear.com/orphan/</loc></url>
</urlset>`,
    });

    const result = await validateRouteGraph({
      clientDir,
      siteUrl: SITE_URL,
      mode: 'astro-rebuild',
    });

    assert.ok(result.report);
    assert.ok(result.report.totalIssueCount >= 1);
    assert.ok(result.report.summary.orphanPages >= 1);

    // Event should be emitted since there are issues
    assert.ok(result.event);
    assert.equal(result.event.egTsxEvent, true);
    assert.equal(result.event.kind, 'route_graph_warning');
    assert.equal(result.event.status, 'warning');
    assert.equal(result.event.mode, 'astro-rebuild');
    assert.ok(typeof result.event.issueCount === 'number');
    assert.ok(result.event.summary);
    assert.ok(typeof result.event.logText === 'string');
    assert.ok(result.event.logText.includes('EG-TSX Route Graph Warning Report'));

    await fs.rm(clientDir, { recursive: true });
  });

  it('writes log file when issues found', async () => {
    const clientDir = await makeTempDist({
      'index.html': htmlPage('https://eggear.com/'),
      'orphan/index.html': htmlPage('https://eggear.com/orphan/'),
      'sitemap-index.xml': `<?xml version="1.0"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>https://eggear.com/</loc></url>
  <url><loc>https://eggear.com/orphan/</loc></url>
</urlset>`,
    });

    const logDir = await fs.mkdtemp(path.join(os.tmpdir(), 'route-graph-log-'));

    const result = await validateRouteGraph({
      clientDir,
      siteUrl: SITE_URL,
      mode: 'quick',
      logDir,
    });

    assert.ok(result.logFile);
    const logContent = await fs.readFile(result.logFile, 'utf8');
    assert.ok(logContent.includes('EG-TSX Route Graph Warning Report'));
    assert.ok(logContent.includes('Mode: quick'));

    await fs.rm(clientDir, { recursive: true });
    await fs.rm(logDir, { recursive: true });
  });

  it('returns null event and no log file when zero issues', async () => {
    const clientDir = await makeTempDist({
      'index.html': htmlPage('https://eggear.com/', ['/reviews/']),
      'reviews/index.html': htmlPage('https://eggear.com/reviews/'),
      'sitemap-index.xml': `<?xml version="1.0"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>https://eggear.com/</loc></url>
  <url><loc>https://eggear.com/reviews/</loc></url>
</urlset>`,
    });

    const logDir = await fs.mkdtemp(path.join(os.tmpdir(), 'route-graph-log-'));

    const result = await validateRouteGraph({
      clientDir,
      siteUrl: SITE_URL,
      mode: 'full',
      logDir,
    });

    assert.equal(result.event, null);
    assert.equal(result.logFile, null);
    assert.equal(result.report.totalIssueCount, 0);

    // Verify no log file was created
    const files = await fs.readdir(logDir);
    assert.equal(files.length, 0);

    await fs.rm(clientDir, { recursive: true });
    await fs.rm(logDir, { recursive: true });
  });

  it('log filename follows YYYY-MM-DD_HH-mm-ss_route-graph-warning.txt format', async () => {
    const clientDir = await makeTempDist({
      'index.html': htmlPage('https://eggear.com/'),
      'orphan/index.html': htmlPage('https://eggear.com/orphan/'),
      'sitemap-index.xml': `<?xml version="1.0"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>https://eggear.com/</loc></url>
  <url><loc>https://eggear.com/orphan/</loc></url>
</urlset>`,
    });

    const logDir = await fs.mkdtemp(path.join(os.tmpdir(), 'route-graph-log-'));

    const result = await validateRouteGraph({
      clientDir,
      siteUrl: SITE_URL,
      mode: 'astro-rebuild',
      logDir,
    });

    const filename = path.basename(result.logFile);
    assert.match(filename, /^\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2}_route-graph-warning\.txt$/);

    await fs.rm(clientDir, { recursive: true });
    await fs.rm(logDir, { recursive: true });
  });

  it('event summary matches report summary', async () => {
    const clientDir = await makeTempDist({
      'index.html': htmlPage('https://eggear.com/', ['/reviews/', '/broken/']),
      'reviews/index.html': htmlPage('https://eggear.com/reviews/'),
      'sitemap-index.xml': `<?xml version="1.0"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>https://eggear.com/</loc></url>
  <url><loc>https://eggear.com/reviews/</loc></url>
</urlset>`,
    });

    const result = await validateRouteGraph({
      clientDir,
      siteUrl: SITE_URL,
      mode: 'quick',
    });

    assert.deepEqual(result.event.summary, result.report.summary);
    assert.equal(result.event.issueCount, result.report.totalIssueCount);

    await fs.rm(clientDir, { recursive: true });
  });
});
