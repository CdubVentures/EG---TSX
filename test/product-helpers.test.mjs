import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { productUrl } from '../src/core/product-helpers.ts';

describe('productUrl', () => {
  it('standard slug: razer viper v3 pro', () => {
    assert.equal(
      productUrl({
        slug: 'razer-viper-v3-pro',
        category: 'mouse',
        imagePath: 'images/products/mouse/razer/viper-v3-pro',
      }),
      '/hubs/mouse/razer/viper-v3-pro'
    );
  });

  it('multi-word brand: mad-catz rat-pro-x3', () => {
    assert.equal(
      productUrl({
        slug: 'mad-catz-rat-pro-x3',
        category: 'mouse',
        imagePath: 'images/products/mouse/mad-catz/rat-pro-x3',
      }),
      '/hubs/mouse/mad-catz/rat-pro-x3'
    );
  });

  it('keyboard category', () => {
    assert.equal(
      productUrl({
        slug: 'wooting-80he',
        category: 'keyboard',
        imagePath: 'images/products/keyboard/wooting/80he',
      }),
      '/hubs/keyboard/wooting/80he'
    );
  });

  it('monitor category', () => {
    assert.equal(
      productUrl({
        slug: 'benq-zowie-xl2546x',
        category: 'monitor',
        imagePath: 'images/products/monitor/benq-zowie/xl2546x',
      }),
      '/hubs/monitor/benq-zowie/xl2546x'
    );
  });

  it('falls back to slug when imagePath has fewer than 5 segments', () => {
    assert.equal(
      productUrl({
        slug: 'some-product',
        category: 'mouse',
        imagePath: 'images/products/mouse',
      }),
      '/hubs/mouse//some-product'
    );
  });
});
