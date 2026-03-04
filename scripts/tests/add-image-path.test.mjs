import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { deriveImagePath, addImagePathToProducts } from '../add-image-path.mjs';

describe('deriveImagePath', () => {
  it('converts hub url to image path for mouse', () => {
    assert.equal(
      deriveImagePath('/hubs/mouse/alienware/aw610m'),
      '/images/mouse/alienware/aw610m'
    );
  });

  it('converts hub url to image path for keyboard', () => {
    assert.equal(
      deriveImagePath('/hubs/keyboard/nuphy/field75he'),
      '/images/keyboard/nuphy/field75he'
    );
  });

  it('converts hub url to image path for monitor', () => {
    assert.equal(
      deriveImagePath('/hubs/monitor/msi/mpg-321urx-qd-oled'),
      '/images/monitor/msi/mpg-321urx-qd-oled'
    );
  });

  it('handles multi-word brand slugs', () => {
    assert.equal(
      deriveImagePath('/hubs/mouse/endgame-gear/xm2we'),
      '/images/mouse/endgame-gear/xm2we'
    );
  });

  it('throws on missing url', () => {
    assert.throws(() => deriveImagePath(undefined), /url is required/);
  });

  it('throws on url that does not start with /hubs/', () => {
    assert.throws(() => deriveImagePath('/other/path'), /must start with \/hubs\//);
  });

  it('throws on url with fewer than 4 segments', () => {
    assert.throws(() => deriveImagePath('/hubs/mouse'), /must have at least 4 segments/);
  });
});

describe('addImagePathToProducts', () => {
  const products = [
    { slug: 'alienware-aw610m', brand: 'Alienware', url: '/hubs/mouse/alienware/aw610m', weight: 120 },
    { slug: 'razer-viper-v3-pro', brand: 'Razer', url: '/hubs/mouse/razer/viper-v3-pro', weight: 54 },
  ];

  it('adds imagePath field to every product', () => {
    const result = addImagePathToProducts(products);
    assert.equal(result[0].imagePath, '/images/mouse/alienware/aw610m');
    assert.equal(result[1].imagePath, '/images/mouse/razer/viper-v3-pro');
  });

  it('preserves all existing fields', () => {
    const result = addImagePathToProducts(products);
    assert.equal(result[0].slug, 'alienware-aw610m');
    assert.equal(result[0].brand, 'Alienware');
    assert.equal(result[0].weight, 120);
    assert.equal(result[0].url, '/hubs/mouse/alienware/aw610m');
  });

  it('does not mutate the original array', () => {
    const original = [{ slug: 'test', url: '/hubs/mouse/brand/model' }];
    const result = addImagePathToProducts(original);
    assert.equal(original[0].imagePath, undefined);
    assert.notEqual(original, result);
  });

  it('places imagePath right after url field', () => {
    const result = addImagePathToProducts(products);
    const keys = Object.keys(result[0]);
    const urlIdx = keys.indexOf('url');
    const imgIdx = keys.indexOf('imagePath');
    assert.equal(imgIdx, urlIdx + 1, 'imagePath should immediately follow url');
  });

  it('skips products that already have imagePath', () => {
    const withExisting = [
      { slug: 'test', url: '/hubs/mouse/brand/model', imagePath: '/images/mouse/brand/model' },
    ];
    const result = addImagePathToProducts(withExisting);
    assert.equal(result[0].imagePath, '/images/mouse/brand/model');
  });

  it('throws on product without url field', () => {
    assert.throws(
      () => addImagePathToProducts([{ slug: 'no-url' }]),
      /url is required/
    );
  });

  it('returns empty array for empty input', () => {
    const result = addImagePathToProducts([]);
    assert.deepEqual(result, []);
  });
});
