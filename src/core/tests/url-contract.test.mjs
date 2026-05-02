import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

describe('core/seo/url-contract', () => {
  it('builds a canonical product URL from a normalized image path', async () => {
    const { productUrlFromImagePath } = await import('../seo/url-contract.ts');

    assert.equal(
      productUrlFromImagePath({
        category: 'mouse',
        imagePath: '/images/mouse/logitech-g/pro-x-superlight-2',
      }),
      '/hubs/mouse/logitech-g/pro-x-superlight-2',
    );
  });

  it('normalizes legacy data-products image paths before building the canonical URL', async () => {
    const { productUrlFromImagePath } = await import('../seo/url-contract.ts');

    assert.equal(
      productUrlFromImagePath({
        category: 'keyboard',
        imagePath: 'images/data-products/keyboard/wooting/60he',
      }),
      '/hubs/keyboard/wooting/60he',
    );
  });

  it('falls back to an explicit model slug when the image path has no model segment', async () => {
    const { productUrlFromImagePath } = await import('../seo/url-contract.ts');

    assert.equal(
      productUrlFromImagePath({
        category: 'monitor',
        imagePath: '/images/monitor/dell',
        fallbackSlug: 'aw2725q',
      }),
      '/hubs/monitor/dell/aw2725q',
    );
  });

  it('accepts relative brand and model image paths used by existing search fixtures', async () => {
    const { productUrlFromImagePath } = await import('../seo/url-contract.ts');

    assert.equal(
      productUrlFromImagePath({
        category: 'mouse',
        imagePath: 'razer/viper-v3-pro',
      }),
      '/hubs/mouse/razer/viper-v3-pro',
    );
  });

  it('throws when the category does not match the image path category', async () => {
    const { productUrlFromImagePath } = await import('../seo/url-contract.ts');

    assert.throws(
      () => productUrlFromImagePath({
        category: 'keyboard',
        imagePath: '/images/mouse/razer/viper-v3-pro',
      }),
      /category/i,
    );
  });

  it('throws when the image path does not contain a brand segment', async () => {
    const { productUrlFromImagePath } = await import('../seo/url-contract.ts');

    assert.throws(
      () => productUrlFromImagePath({
        category: 'mouse',
        imagePath: '/images/mouse',
      }),
      /brand/i,
    );
  });
});

describe('core/product-helpers', () => {
  it('preserves the product object wrapper and delegates to the canonical contract', async () => {
    const { productUrl } = await import('../product-helpers.ts');

    assert.equal(
      productUrl({
        slug: 'viper-v3-pro',
        category: 'mouse',
        imagePath: '/images/mouse/razer/viper-v3-pro',
      }),
      '/hubs/mouse/razer/viper-v3-pro',
    );
  });

  it('uses the product slug as a fallback model slug when the image path is truncated', async () => {
    const { productUrl } = await import('../product-helpers.ts');

    assert.equal(
      productUrl({
        slug: 'aw2725q',
        category: 'monitor',
        imagePath: '/images/monitor/dell',
      }),
      '/hubs/monitor/dell/aw2725q',
    );
  });
});
