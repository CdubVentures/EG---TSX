import { afterEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';

const ORIGINAL_CDN_BASE_URL = process.env.CDN_BASE_URL;
let importCounter = 0;

async function freshSearchRoute() {
  importCounter += 1;
  return import(`../../../pages/api/search.ts?test=${importCounter}`);
}

function makeMedia() {
  return {
    defaultColor: null,
    colors: [],
    editions: [],
    images: [
      { stem: 'top', view: 'top' },
    ],
  };
}

afterEach(() => {
  if (ORIGINAL_CDN_BASE_URL === undefined) {
    delete process.env.CDN_BASE_URL;
    return;
  }

  process.env.CDN_BASE_URL = ORIGINAL_CDN_BASE_URL;
});

describe('search product thumbnails', () => {
  it('uses the stored product imagePath directly instead of prefixing /images twice', async () => {
    process.env.CDN_BASE_URL = 'https://cdn.example.com';

    const { resolveProductImage } = await freshSearchRoute();
    const image = resolveProductImage(
      makeMedia(),
      '/images/mouse/razer/viper-v3-pro',
      'mouse',
    );

    assert.equal(
      image?.imageUrl,
      'https://cdn.example.com/images/mouse/razer/viper-v3-pro/top_xxs.webp',
    );
    assert.ok(!image?.imageUrl.includes('/images//images/'));
  });
});
