import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  buildCdnInvalidationPlan,
  buildImageCdnInvalidationPlan,
  SITE_FULL_INVALIDATION_PATHS,
} from '../invalidation-core.mjs';

describe('buildCdnInvalidationPlan', () => {
  it('covers every non-dynamic cache target in the curated full-site manifest', async () => {
    const { CACHE_CDN_CONTRACT } = await import('../../src/core/cache-cdn-contract.ts');

    const expectedPaths = CACHE_CDN_CONTRACT.targets
      .filter((target) => CACHE_CDN_CONTRACT.pageTypes[target.pageType].policy !== 'dynamicApis')
      .flatMap((target) => target.pathPatterns)
      .filter((pathValue) => pathValue !== '*');

    for (const pathValue of expectedPaths) {
      assert.ok(
        SITE_FULL_INVALIDATION_PATHS.includes(pathValue),
        `full-site invalidation manifest must include ${pathValue} from cache-cdn.json`
      );
    }
  });

  it('maps site sync diff rows into viewer-facing routes and asset wildcards', () => {
    const plan = buildCdnInvalidationPlan({
      s3DiffRows: [
        { path: 'reviews/mouse/logitech-g-pro-x-superlight-2/index.html', status: 'modified' },
        { path: 'reviews/mouse/razer-viper-v3-pro/index.html', status: 'modified' },
        { path: '_astro/app.abc123.js', status: 'modified' },
        { path: 'robots.txt', status: 'modified' },
      ],
    });

    assert.deepEqual(plan, {
      changedCount: 4,
      mode: 'smart',
      paths: [
        '/reviews/mouse/logitech-g-pro-x-superlight-2',
        '/reviews/mouse/razer-viper-v3-pro',
        '/_astro/*',
        '/robots.txt',
      ],
      reason: 'Built CDN-facing routes from the static sync diff.',
    });
  });

  it('prefers concrete sync diff routes over broad source wildcards when publish updates have diff rows', () => {
    const plan = buildCdnInvalidationPlan({
      changedSourcePaths: ['src/content/reviews/mouse/logitech-g-pro-x-superlight-2.mdx'],
      s3DiffRows: [
        { path: 'reviews/mouse/logitech-g-pro-x-superlight-2/index.html', status: 'modified' },
      ],
    });

    assert.deepEqual(plan, {
      changedCount: 2,
      mode: 'smart',
      paths: [
        '/reviews/mouse/logitech-g-pro-x-superlight-2',
        '/_astro/*',
      ],
      reason: 'Built CDN-facing routes from the static sync diff.',
    });
  });

  it('promotes shared shell changes to the curated full-site manifest', () => {
    const plan = buildCdnInvalidationPlan({
      changedSourcePaths: ['src/shared/layouts/MainLayout.astro'],
      s3DiffRows: [],
    });

    assert.deepEqual(plan, {
      changedCount: 1,
      mode: 'full',
      paths: SITE_FULL_INVALIDATION_PATHS,
      reason: 'Shared layout or app shell changes affect the whole site.',
    });
  });

  it('compresses related viewer routes before falling back to the full-site manifest', () => {
    const plan = buildCdnInvalidationPlan({
      s3DiffRows: [
        { path: 'reviews/mouse/logitech-g-pro-x-superlight-2/index.html', status: 'modified' },
        { path: 'reviews/mouse/razer-viper-v3-pro/index.html', status: 'modified' },
        { path: 'robots.txt', status: 'modified' },
      ],
      maxPaths: 2,
    });

    assert.deepEqual(plan, {
      changedCount: 3,
      mode: 'smart',
      paths: [
        '/reviews/mouse/*',
        '/robots.txt',
      ],
      reason: 'Compressed related CDN viewer paths to stay within the publish invalidation budget.',
    });
  });

  it('falls back to the curated full-site manifest when too many viewer paths would be invalidated', () => {
    const plan = buildCdnInvalidationPlan({
      s3DiffRows: [
        { path: 'reviews/mouse/a/index.html', status: 'modified' },
        { path: 'guides/b/index.html', status: 'modified' },
        { path: 'news/c/index.html', status: 'modified' },
      ],
      maxPaths: 2,
    });

    assert.deepEqual(plan, {
      changedCount: 3,
      mode: 'full',
      paths: SITE_FULL_INVALIDATION_PATHS,
      reason: 'The change set spans too many CDN viewer paths.',
    });
  });

  it('returns an empty plan when nothing CDN-facing changed', () => {
    const plan = buildCdnInvalidationPlan({
      changedSourcePaths: ['src/pages/api/auth/sign-in.ts'],
      s3DiffRows: [],
    });

    assert.deepEqual(plan, {
      changedCount: 0,
      mode: 'none',
      paths: [],
      reason: 'No CDN invalidation is required for the current change set.',
    });
  });
});

describe('buildImageCdnInvalidationPlan', () => {
  it('maps overwritten and deleted image keys to owning page wildcards and ignores new uploads', () => {
    const plan = buildImageCdnInvalidationPlan({
      s3DiffRows: [
        { path: 'images/reviews/mouse/razer/viper-v3-pro/thumb.webp', status: 'modified' },
        { path: 'images/news/mice/best-wireless-gaming-mice/hero.webp', status: 'deleted' },
        { path: 'images/brands/logitech/banner.webp', status: 'new' },
      ],
    });

    assert.deepEqual(plan, {
      changedCount: 2,
      mode: 'smart',
      paths: [
        '/reviews/mouse/razer/viper-v3-pro*',
        '/news/mice/best-wireless-gaming-mice*',
      ],
      reason: 'Mapped changed image keys to owning page invalidation patterns.',
    });
  });

  it('compresses related image owner pages before escalating to the namespace wildcard', () => {
    const plan = buildImageCdnInvalidationPlan({
      maxPaths: 1,
      s3DiffRows: [
        { path: 'images/news/mice/best-wireless-gaming-mice/hero.webp', status: 'modified' },
        { path: 'images/news/mice/best-ultralight-gaming-mice/hero.webp', status: 'deleted' },
      ],
    });

    assert.deepEqual(plan, {
      changedCount: 2,
      mode: 'smart',
      paths: ['/news/mice/*'],
      reason: 'Compressed related image owner pages to stay within the publish invalidation budget.',
    });
  });

  it('returns no invalidation when only brand-new image keys were added', () => {
    const plan = buildImageCdnInvalidationPlan({
      s3DiffRows: [
        { path: 'images/brands/logitech/banner.webp', status: 'new' },
      ],
    });

    assert.deepEqual(plan, {
      changedCount: 0,
      mode: 'none',
      paths: [],
      reason: 'No CDN invalidation is required for the current image change set.',
    });
  });
});
