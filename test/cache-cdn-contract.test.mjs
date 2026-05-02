import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const ROOT = resolve(import.meta.dirname, '..');
const DATA_DIR = join(ROOT, 'config', 'data');

function readJson(relPath) {
  return JSON.parse(readFileSync(join(ROOT, relPath), 'utf-8'));
}

function readText(relPath) {
  return readFileSync(join(ROOT, relPath), 'utf-8');
}

describe('cache/CDN single source of truth contract', () => {
  it('defines the shared cache-cdn.json contract in config/data/', () => {
    const path = join(DATA_DIR, 'cache-cdn.json');
    assert.ok(existsSync(path), 'Missing: config/data/cache-cdn.json');
  });

  it('declares the required logical cache policies', () => {
    const contract = readJson('config/data/cache-cdn.json');
    const expectedPolicies = [
      'staticPages',
      'hubPages',
      'staticAssets',
      'images',
      'searchApi',
      'dynamicApis',
    ];

    assert.deepEqual(
      Object.keys(contract.policies ?? {}),
      expectedPolicies,
      'cache-cdn.json must define the canonical cache policy set'
    );
  });

  it('declares page types that map site semantics to document types', () => {
    const contract = readJson('config/data/cache-cdn.json');
    const expectedPageTypes = [
      'sitePages',
      'hubPages',
      'staticAssets',
      'images',
      'searchApi',
      'authAndSession',
      'userData',
      'apiFallback',
    ];

    assert.deepEqual(
      Object.keys(contract.pageTypes ?? {}),
      expectedPageTypes,
      'cache-cdn.json must define the canonical page type set'
    );

    const policyNames = new Set(Object.keys(contract.policies ?? {}));
    for (const [pageTypeName, pageType] of Object.entries(contract.pageTypes ?? {})) {
      assert.equal(typeof pageType.label, 'string', `${pageTypeName}.label must be string`);
      assert.equal(typeof pageType.description, 'string', `${pageTypeName}.description must be string`);
      assert.ok(policyNames.has(pageType.policy), `${pageTypeName}.policy must reference a defined policy`);
    }
  });

  it('uses explicit policy fields instead of magic behavior', () => {
    const contract = readJson('config/data/cache-cdn.json');

    for (const [policyName, policy] of Object.entries(contract.policies ?? {})) {
      assert.equal(typeof policy.browserMaxAge, 'number', `${policyName}.browserMaxAge must be number`);
      assert.equal(typeof policy.edgeMaxAge, 'number', `${policyName}.edgeMaxAge must be number`);
      assert.equal(typeof policy.staleWhileRevalidate, 'number', `${policyName}.staleWhileRevalidate must be number`);
      assert.equal(typeof policy.mustRevalidate, 'boolean', `${policyName}.mustRevalidate must be boolean`);
      assert.equal(typeof policy.immutable, 'boolean', `${policyName}.immutable must be boolean`);
      assert.equal(typeof policy.noStore, 'boolean', `${policyName}.noStore must be boolean`);
      assert.ok(['none', 'all'].includes(policy.varyQuery), `${policyName}.varyQuery must be "none" or "all"`);
      assert.ok(Array.isArray(policy.varyHeaders), `${policyName}.varyHeaders must be array`);
      assert.equal(typeof policy.invalidationGroup, 'string', `${policyName}.invalidationGroup must be string`);
    }
  });

  it('uses best-practice defaults for HTML revalidation and image cache keys', () => {
    const contract = readJson('config/data/cache-cdn.json');

    assert.equal(contract.policies.staticPages.mustRevalidate, true);
    assert.equal(contract.policies.hubPages.mustRevalidate, true);
    assert.equal(contract.policies.images.varyQuery, 'none');
    assert.deepEqual(contract.policies.images.varyHeaders, ['Accept']);
  });

  it('maps CDN-facing targets to shared page types', () => {
    const contract = readJson('config/data/cache-cdn.json');
    const pageTypeNames = new Set(Object.keys(contract.pageTypes ?? {}));
    const targets = contract.targets ?? [];

    assert.ok(Array.isArray(targets), 'cache-cdn.json must define targets[]');
    assert.ok(targets.length >= 6, 'cache-cdn.json must map the core CDN targets');

    for (const target of targets) {
      assert.equal(typeof target.id, 'string', 'target.id must be string');
      assert.equal(typeof target.label, 'string', `${target.id}.label must be string`);
      assert.ok(Array.isArray(target.pathPatterns), `${target.id}.pathPatterns must be array`);
      assert.ok(target.pathPatterns.length > 0, `${target.id}.pathPatterns must not be empty`);
      assert.ok(pageTypeNames.has(target.pageType), `${target.id}.pageType must reference a defined page type`);
      assert.equal(
        Object.prototype.hasOwnProperty.call(target, 'policy'),
        false,
        `${target.id} must not duplicate policy on the target when pageType is present`
      );
    }
  });
});

describe('cache/CDN contract module', () => {
  it('exposes validated policy accessors and header builders', async () => {
    const module = await import('../src/core/cache-cdn-contract.ts');

    assert.deepEqual(module.CACHE_POLICY_NAMES, [
      'staticPages',
      'hubPages',
      'staticAssets',
      'images',
      'searchApi',
      'dynamicApis',
    ]);

    assert.deepEqual(module.CACHE_PAGE_TYPE_NAMES, [
      'sitePages',
      'hubPages',
      'staticAssets',
      'images',
      'searchApi',
      'authAndSession',
      'userData',
      'apiFallback',
    ]);

    assert.equal(module.getPageTypePolicyName('userData'), 'dynamicApis');
    assert.equal(module.resolveTargetPolicyName('images'), 'images');

    assert.equal(
      module.buildCacheControlHeader('staticPages'),
      'public, max-age=0, s-maxage=86400, must-revalidate'
    );

    assert.equal(
      module.buildCacheControlHeader('searchApi'),
      'public, max-age=60, s-maxage=300, stale-while-revalidate=300'
    );

    assert.equal(
      module.buildCacheControlHeader('dynamicApis'),
      'no-store'
    );

    const headers = module.withCachePolicyHeaders('images');
    assert.equal(headers.get('Cache-Control'), 'public, max-age=31536000, s-maxage=31536000, immutable');
    assert.equal(headers.get('Vary'), 'Accept');
  });
});

describe('cache/CDN consumer wiring', () => {
  it('core domain exposes the shared cache/CDN contract', () => {
    const content = readText('src/core/README.md');

    assert.match(
      content,
      /cache-cdn-contract\.ts/,
      'src/core/README.md must document the shared cache/CDN contract module'
    );
  });

  it('search route reads its cache policy from the shared contract', () => {
    const content = readText('src/pages/api/search.ts');

    assert.match(
      content,
      /from ['"]@core\/cache-cdn-contract['"]/,
      'src/pages/api/search.ts must import the shared cache/CDN contract'
    );

    assert.match(
      content,
      /withCachePolicyHeaders\('searchApi'\)/,
      'src/pages/api/search.ts must use the shared searchApi policy'
    );

    assert.doesNotMatch(
      content,
      /public, max-age=60, s-maxage=300/,
      'src/pages/api/search.ts must not hardcode cache headers'
    );
  });

  it('auth status route reads its cache policy from the shared contract', () => {
    const content = readText('src/pages/api/auth/me.ts');

    assert.match(
      content,
      /from ['"]@core\/cache-cdn-contract['"]/,
      'src/pages/api/auth/me.ts must import the shared cache/CDN contract'
    );

    assert.match(
      content,
      /withCachePolicyHeaders\('dynamicApis'\)/,
      'src/pages/api/auth/me.ts must use the shared dynamicApis policy'
    );

    assert.doesNotMatch(
      content,
      /Cache-Control': 'no-store'/,
      'src/pages/api/auth/me.ts must not hardcode no-store headers'
    );
  });

  it('user vault route reads its cache policy from the shared contract', () => {
    const content = readText('src/pages/api/user/vault.ts');

    assert.match(
      content,
      /from ['"]@core\/cache-cdn-contract['"]/,
      'src/pages/api/user/vault.ts must import the shared cache/CDN contract'
    );

    assert.match(
      content,
      /withCachePolicyHeaders\('dynamicApis'\)/,
      'src/pages/api/user/vault.ts must use the shared dynamicApis policy'
    );
  });

  it('auth sign-in route reads its cache policy from the shared contract', () => {
    const content = readText('src/pages/api/auth/sign-in.ts');

    assert.match(
      content,
      /from ['"]@core\/cache-cdn-contract['"]/,
      'src/pages/api/auth/sign-in.ts must import the shared cache/CDN contract'
    );

    assert.match(
      content,
      /withCachePolicyHeaders\('dynamicApis'\)/,
      'src/pages/api/auth/sign-in.ts must use the shared dynamicApis policy'
    );
  });
});
