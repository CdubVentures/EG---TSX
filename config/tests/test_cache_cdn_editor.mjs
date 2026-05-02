/**
 * test_cache_cdn_editor.mjs — Tests for Cache/CDN pure editor functions.
 * TDD RED phase: all tests written before implementation.
 * Runner: node --test config/tests/test_cache_cdn_editor.mjs
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  setPolicyField,
  setPageTypeField,
  setTargetField,
  addTarget,
  deleteTarget,
  coerceInt,
  cleanHeaders,
  cleanPatterns,
  buildPolicyPreview,
  buildPreviewText,
  auditConfig,
  listPageTypeTargets,
} from '../ui/cache-cdn-editor.mjs';

// ── Factories ───────────────────────────────────────────────────────────

function makeConfig(overrides = {}) {
  return {
    policies: {
      staticPages: {
        browserMaxAge: 0,
        edgeMaxAge: 86400,
        staleWhileRevalidate: 0,
        mustRevalidate: true,
        immutable: false,
        noStore: false,
        varyQuery: 'none',
        varyHeaders: [],
        invalidationGroup: 'pages',
      },
      hubPages: {
        browserMaxAge: 0,
        edgeMaxAge: 86400,
        staleWhileRevalidate: 0,
        mustRevalidate: true,
        immutable: false,
        noStore: false,
        varyQuery: 'none',
        varyHeaders: [],
        invalidationGroup: 'hubs',
      },
      staticAssets: {
        browserMaxAge: 31536000,
        edgeMaxAge: 31536000,
        staleWhileRevalidate: 0,
        mustRevalidate: false,
        immutable: true,
        noStore: false,
        varyQuery: 'none',
        varyHeaders: [],
        invalidationGroup: 'assets',
      },
      images: {
        browserMaxAge: 31536000,
        edgeMaxAge: 31536000,
        staleWhileRevalidate: 0,
        mustRevalidate: false,
        immutable: true,
        noStore: false,
        varyQuery: 'none',
        varyHeaders: ['Accept'],
        invalidationGroup: 'images',
      },
      searchApi: {
        browserMaxAge: 60,
        edgeMaxAge: 300,
        staleWhileRevalidate: 300,
        mustRevalidate: false,
        immutable: false,
        noStore: false,
        varyQuery: 'all',
        varyHeaders: [],
        invalidationGroup: 'api-search',
      },
      dynamicApis: {
        browserMaxAge: 0,
        edgeMaxAge: 0,
        staleWhileRevalidate: 0,
        mustRevalidate: false,
        immutable: false,
        noStore: true,
        varyQuery: 'none',
        varyHeaders: [],
        invalidationGroup: 'dynamic',
      },
    },
    pageTypes: {
      sitePages: {
        label: 'Site Pages',
        description: 'Default static HTML pages.',
        policy: 'staticPages',
      },
      hubPages: {
        label: 'Hub Pages',
        description: 'Static hub shells.',
        policy: 'hubPages',
      },
      staticAssets: {
        label: 'Static Assets',
        description: 'Hashed client bundles.',
        policy: 'staticAssets',
      },
      images: {
        label: 'Images',
        description: 'Product images.',
        policy: 'images',
      },
      searchApi: {
        label: 'Search API',
        description: 'Public search JSON.',
        policy: 'searchApi',
      },
      authAndSession: {
        label: 'Auth And Session',
        description: 'Auth routes.',
        policy: 'dynamicApis',
      },
      userData: {
        label: 'User Data',
        description: 'User routes.',
        policy: 'dynamicApis',
      },
      apiFallback: {
        label: 'API Fallback',
        description: 'Catch-all dynamic API routes.',
        policy: 'dynamicApis',
      },
    },
    targets: [
      { id: 'static-pages', label: 'Static Pages', pathPatterns: ['*'], pageType: 'sitePages' },
      { id: 'hub-pages', label: 'Hub Pages', pathPatterns: ['/hubs/*'], pageType: 'hubPages' },
      { id: 'static-assets', label: 'Static Assets', pathPatterns: ['/assets/*', '/_astro/*'], pageType: 'staticAssets' },
    ],
    ...overrides,
  };
}

// ── setPolicyField ──────────────────────────────────────────────────────

describe('setPolicyField', () => {
  it('sets an integer field on a policy', () => {
    const config = makeConfig();
    const result = setPolicyField(config, 'staticPages', 'edgeMaxAge', 3600);
    assert.equal(result.policies.staticPages.edgeMaxAge, 3600);
  });

  it('sets a boolean field on a policy', () => {
    const config = makeConfig();
    const result = setPolicyField(config, 'staticPages', 'noStore', true);
    assert.equal(result.policies.staticPages.noStore, true);
  });

  it('sets a string field on a policy', () => {
    const config = makeConfig();
    const result = setPolicyField(config, 'staticPages', 'varyQuery', 'all');
    assert.equal(result.policies.staticPages.varyQuery, 'all');
  });

  it('does not mutate the original config', () => {
    const config = makeConfig();
    const originalEdge = config.policies.staticPages.edgeMaxAge;
    setPolicyField(config, 'staticPages', 'edgeMaxAge', 999);
    assert.equal(config.policies.staticPages.edgeMaxAge, originalEdge);
  });

  it('preserves other policies when setting a field', () => {
    const config = makeConfig();
    const result = setPolicyField(config, 'staticPages', 'edgeMaxAge', 999);
    assert.equal(result.policies.hubPages.edgeMaxAge, 86400);
  });

  it('preserves other fields on the same policy', () => {
    const config = makeConfig();
    const result = setPolicyField(config, 'staticPages', 'edgeMaxAge', 999);
    assert.equal(result.policies.staticPages.mustRevalidate, true);
  });
});

// ── setPageTypeField ────────────────────────────────────────────────────

describe('setPageTypeField', () => {
  it('sets label on a page type', () => {
    const config = makeConfig();
    const result = setPageTypeField(config, 'sitePages', 'label', 'HTML Pages');
    assert.equal(result.pageTypes.sitePages.label, 'HTML Pages');
  });

  it('sets description on a page type', () => {
    const config = makeConfig();
    const result = setPageTypeField(config, 'sitePages', 'description', 'New desc');
    assert.equal(result.pageTypes.sitePages.description, 'New desc');
  });

  it('sets policy reference on a page type', () => {
    const config = makeConfig();
    const result = setPageTypeField(config, 'sitePages', 'policy', 'dynamicApis');
    assert.equal(result.pageTypes.sitePages.policy, 'dynamicApis');
  });

  it('does not mutate the original config', () => {
    const config = makeConfig();
    setPageTypeField(config, 'sitePages', 'label', 'Changed');
    assert.equal(config.pageTypes.sitePages.label, 'Site Pages');
  });

  it('preserves other page types', () => {
    const config = makeConfig();
    const result = setPageTypeField(config, 'sitePages', 'label', 'Changed');
    assert.equal(result.pageTypes.hubPages.label, 'Hub Pages');
  });
});

// ── setTargetField ──────────────────────────────────────────────────────

describe('setTargetField', () => {
  it('sets id on a target by index', () => {
    const config = makeConfig();
    const result = setTargetField(config, 0, 'id', 'renamed-target');
    assert.equal(result.targets[0].id, 'renamed-target');
  });

  it('sets label on a target by index', () => {
    const config = makeConfig();
    const result = setTargetField(config, 1, 'label', 'My Hubs');
    assert.equal(result.targets[1].label, 'My Hubs');
  });

  it('sets pageType on a target by index', () => {
    const config = makeConfig();
    const result = setTargetField(config, 0, 'pageType', 'hubPages');
    assert.equal(result.targets[0].pageType, 'hubPages');
  });

  it('sets pathPatterns on a target by index', () => {
    const config = makeConfig();
    const result = setTargetField(config, 0, 'pathPatterns', ['/foo/*', '/bar/*']);
    assert.deepStrictEqual(result.targets[0].pathPatterns, ['/foo/*', '/bar/*']);
  });

  it('does not mutate the original config', () => {
    const config = makeConfig();
    setTargetField(config, 0, 'id', 'changed');
    assert.equal(config.targets[0].id, 'static-pages');
  });

  it('preserves other targets', () => {
    const config = makeConfig();
    const result = setTargetField(config, 0, 'id', 'changed');
    assert.equal(result.targets[1].id, 'hub-pages');
  });
});

// ── addTarget ───────────────────────────────────────────────────────────

describe('addTarget', () => {
  it('appends a new target with defaults', () => {
    const config = makeConfig();
    const result = addTarget(config);
    assert.equal(result.targets.length, config.targets.length + 1);
  });

  it('new target has a unique id', () => {
    const config = makeConfig();
    const result = addTarget(config);
    const newTarget = result.targets[result.targets.length - 1];
    assert.equal(typeof newTarget.id, 'string');
    assert.ok(newTarget.id.length > 0);
    // Should not collide with existing ids
    const existingIds = config.targets.map((t) => t.id);
    assert.ok(!existingIds.includes(newTarget.id));
  });

  it('new target has default pathPatterns', () => {
    const config = makeConfig();
    const result = addTarget(config);
    const newTarget = result.targets[result.targets.length - 1];
    assert.deepStrictEqual(newTarget.pathPatterns, ['/new-path/*']);
  });

  it('new target has default pageType sitePages', () => {
    const config = makeConfig();
    const result = addTarget(config);
    const newTarget = result.targets[result.targets.length - 1];
    assert.equal(newTarget.pageType, 'sitePages');
  });

  it('does not mutate the original config', () => {
    const config = makeConfig();
    const originalLength = config.targets.length;
    addTarget(config);
    assert.equal(config.targets.length, originalLength);
  });
});

// ── deleteTarget ────────────────────────────────────────────────────────

describe('deleteTarget', () => {
  it('removes a target by index', () => {
    const config = makeConfig();
    const result = deleteTarget(config, 1);
    assert.equal(result.targets.length, config.targets.length - 1);
    assert.equal(result.targets[0].id, 'static-pages');
    assert.equal(result.targets[1].id, 'static-assets');
  });

  it('no-op when only 1 target remains', () => {
    const config = makeConfig({
      targets: [
        { id: 'only-one', label: 'Only', pathPatterns: ['*'], pageType: 'sitePages' },
      ],
    });
    const result = deleteTarget(config, 0);
    assert.equal(result.targets.length, 1);
    assert.equal(result.targets[0].id, 'only-one');
  });

  it('does not mutate the original config', () => {
    const config = makeConfig();
    const originalLength = config.targets.length;
    deleteTarget(config, 0);
    assert.equal(config.targets.length, originalLength);
  });
});

// ── coerceInt ───────────────────────────────────────────────────────────

describe('coerceInt', () => {
  it('parses a valid integer string', () => {
    assert.equal(coerceInt('42', 0), 42);
  });

  it('clamps negative to 0', () => {
    assert.equal(coerceInt('-5', 0), 0);
  });

  it('returns default for NaN', () => {
    assert.equal(coerceInt('abc', 10), 10);
  });

  it('returns default for empty string', () => {
    assert.equal(coerceInt('', 5), 5);
  });

  it('passes through a valid number', () => {
    assert.equal(coerceInt(300, 0), 300);
  });

  it('trims whitespace before parsing', () => {
    assert.equal(coerceInt(' 100 ', 0), 100);
  });
});

// ── cleanHeaders ────────────────────────────────────────────────────────

describe('cleanHeaders', () => {
  it('splits comma-separated string', () => {
    assert.deepStrictEqual(cleanHeaders('Accept, Content-Type'), ['Accept', 'Content-Type']);
  });

  it('trims whitespace', () => {
    assert.deepStrictEqual(cleanHeaders('  Accept  ,  Content-Type  '), ['Accept', 'Content-Type']);
  });

  it('removes empty entries', () => {
    assert.deepStrictEqual(cleanHeaders('Accept,,'), ['Accept']);
  });

  it('passes through array', () => {
    assert.deepStrictEqual(cleanHeaders(['Accept', 'Vary']), ['Accept', 'Vary']);
  });

  it('returns empty array for empty string', () => {
    assert.deepStrictEqual(cleanHeaders(''), []);
  });
});

// ── cleanPatterns ───────────────────────────────────────────────────────

describe('cleanPatterns', () => {
  it('splits newline-separated string', () => {
    assert.deepStrictEqual(cleanPatterns('/api/*\n/hubs/*'), ['/api/*', '/hubs/*']);
  });

  it('trims whitespace', () => {
    assert.deepStrictEqual(cleanPatterns('  /api/*  \n  /hubs/*  '), ['/api/*', '/hubs/*']);
  });

  it('removes empty lines', () => {
    assert.deepStrictEqual(cleanPatterns('/api/*\n\n/hubs/*\n'), ['/api/*', '/hubs/*']);
  });

  it('passes through array', () => {
    assert.deepStrictEqual(cleanPatterns(['/api/*', '/hubs/*']), ['/api/*', '/hubs/*']);
  });

  it('returns empty array for empty string', () => {
    assert.deepStrictEqual(cleanPatterns(''), []);
  });
});

// ── buildPolicyPreview ──────────────────────────────────────────────────

describe('buildPolicyPreview', () => {
  it('staticPages → "public, max-age=0, s-maxage=86400, must-revalidate"', () => {
    const config = makeConfig();
    assert.equal(
      buildPolicyPreview(config.policies.staticPages),
      'public, max-age=0, s-maxage=86400, must-revalidate',
    );
  });

  it('searchApi → "public, max-age=60, s-maxage=300, stale-while-revalidate=300"', () => {
    const config = makeConfig();
    assert.equal(
      buildPolicyPreview(config.policies.searchApi),
      'public, max-age=60, s-maxage=300, stale-while-revalidate=300',
    );
  });

  it('dynamicApis → "no-store"', () => {
    const config = makeConfig();
    assert.equal(buildPolicyPreview(config.policies.dynamicApis), 'no-store');
  });

  it('staticAssets → "public, max-age=31536000, s-maxage=31536000, immutable"', () => {
    const config = makeConfig();
    assert.equal(
      buildPolicyPreview(config.policies.staticAssets),
      'public, max-age=31536000, s-maxage=31536000, immutable',
    );
  });

  it('images → "public, max-age=31536000, s-maxage=31536000, immutable"', () => {
    const config = makeConfig();
    assert.equal(
      buildPolicyPreview(config.policies.images),
      'public, max-age=31536000, s-maxage=31536000, immutable',
    );
  });

  it('hubPages → "public, max-age=0, s-maxage=86400, must-revalidate"', () => {
    const config = makeConfig();
    assert.equal(
      buildPolicyPreview(config.policies.hubPages),
      'public, max-age=0, s-maxage=86400, must-revalidate',
    );
  });
});

// ── buildPreviewText ────────────────────────────────────────────────────

describe('buildPreviewText', () => {
  it('includes all policy names', () => {
    const config = makeConfig();
    const text = buildPreviewText(config);
    assert.ok(text.includes('staticPages'));
    assert.ok(text.includes('hubPages'));
    assert.ok(text.includes('staticAssets'));
    assert.ok(text.includes('images'));
    assert.ok(text.includes('searchApi'));
    assert.ok(text.includes('dynamicApis'));
  });

  it('includes Cache-Control strings', () => {
    const config = makeConfig();
    const text = buildPreviewText(config);
    assert.ok(text.includes('no-store'));
    assert.ok(text.includes('must-revalidate'));
  });

  it('includes page type mappings', () => {
    const config = makeConfig();
    const text = buildPreviewText(config);
    assert.ok(text.includes('sitePages'));
    assert.ok(text.includes('hubPages'));
  });

  it('includes "Document Types" heading', () => {
    const config = makeConfig();
    const text = buildPreviewText(config);
    assert.ok(text.includes('Document Types'));
  });

  it('includes "Page Types" heading', () => {
    const config = makeConfig();
    const text = buildPreviewText(config);
    assert.ok(text.includes('Page Types'));
  });
});

// ── auditConfig ─────────────────────────────────────────────────────────

describe('auditConfig', () => {
  it('returns empty array for clean config', () => {
    const config = makeConfig();
    const issues = auditConfig(config);
    assert.deepStrictEqual(issues, []);
  });

  it('flags noStore with non-zero TTL', () => {
    const config = makeConfig();
    config.policies.dynamicApis = {
      ...config.policies.dynamicApis,
      browserMaxAge: 60,
      noStore: true,
    };
    const issues = auditConfig(config);
    assert.ok(issues.some((i) => i.includes('no-store') && i.includes('zero TTL')));
  });

  it('flags noStore + immutable', () => {
    const config = makeConfig();
    config.policies.dynamicApis = {
      ...config.policies.dynamicApis,
      immutable: true,
      noStore: true,
    };
    const issues = auditConfig(config);
    assert.ok(issues.some((i) => i.includes('no-store') && i.includes('immutable')));
  });

  it('flags noStore + mustRevalidate', () => {
    const config = makeConfig();
    config.policies.dynamicApis = {
      ...config.policies.dynamicApis,
      mustRevalidate: true,
      noStore: true,
    };
    const issues = auditConfig(config);
    assert.ok(issues.some((i) => i.includes('no-store') && i.includes('revalidation')));
  });

  it('flags missing mustRevalidate warning', () => {
    const config = makeConfig();
    // browser=0, edge>0, no mustRevalidate, not noStore, not immutable
    config.policies.staticPages = {
      ...config.policies.staticPages,
      mustRevalidate: false,
      browserMaxAge: 0,
      edgeMaxAge: 86400,
      immutable: false,
      noStore: false,
    };
    const issues = auditConfig(config);
    assert.ok(issues.some((i) => i.includes('must-revalidate')));
  });

  it('flags duplicate path patterns across targets', () => {
    const config = makeConfig({
      targets: [
        { id: 'a', label: 'A', pathPatterns: ['/api/*'], pageType: 'sitePages' },
        { id: 'b', label: 'B', pathPatterns: ['/api/*'], pageType: 'sitePages' },
      ],
    });
    const issues = auditConfig(config);
    assert.ok(issues.some((i) => i.includes('Duplicate') && i.includes('/api/*')));
  });

  it('flags unknown policy reference in page type', () => {
    const config = makeConfig();
    config.pageTypes.sitePages = { ...config.pageTypes.sitePages, policy: 'nonexistent' };
    const issues = auditConfig(config);
    assert.ok(issues.some((i) => i.includes('unknown policy') && i.includes('nonexistent')));
  });

  it('flags unknown page type reference in target', () => {
    const config = makeConfig({
      targets: [
        { id: 'x', label: 'X', pathPatterns: ['*'], pageType: 'nonexistent' },
      ],
    });
    const issues = auditConfig(config);
    assert.ok(issues.some((i) => i.includes('unknown page type') && i.includes('nonexistent')));
  });
});

// ── listPageTypeTargets ─────────────────────────────────────────────────

describe('listPageTypeTargets', () => {
  it('returns correct patterns for a matched page type', () => {
    const config = makeConfig();
    const patterns = listPageTypeTargets(config, 'sitePages');
    assert.deepStrictEqual(patterns, ['*']);
  });

  it('returns patterns from multiple targets with same page type', () => {
    const config = makeConfig({
      targets: [
        { id: 'a', label: 'A', pathPatterns: ['/foo/*'], pageType: 'sitePages' },
        { id: 'b', label: 'B', pathPatterns: ['/bar/*'], pageType: 'sitePages' },
      ],
    });
    const patterns = listPageTypeTargets(config, 'sitePages');
    assert.deepStrictEqual(patterns, ['/foo/*', '/bar/*']);
  });

  it('returns empty array for unmatched page type', () => {
    const config = makeConfig();
    const patterns = listPageTypeTargets(config, 'apiFallback');
    assert.deepStrictEqual(patterns, []);
  });
});
