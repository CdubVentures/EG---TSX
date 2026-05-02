import { afterEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';

const ORIGINAL_CDN_BASE_URL = process.env.CDN_BASE_URL;
const ORIGINAL_NODE_ENV = process.env.NODE_ENV;
let importCounter = 0;

async function freshImages() {
  importCounter += 1;
  return import(`../images.ts?test=${importCounter}`);
}

async function freshConfig() {
  importCounter += 1;
  return import(`../config.ts?test=${importCounter}`);
}

afterEach(() => {
  if (ORIGINAL_CDN_BASE_URL === undefined) {
    delete process.env.CDN_BASE_URL;
  } else {
    process.env.CDN_BASE_URL = ORIGINAL_CDN_BASE_URL;
  }

  if (ORIGINAL_NODE_ENV === undefined) {
    delete process.env.NODE_ENV;
    return;
  }

  process.env.NODE_ENV = ORIGINAL_NODE_ENV;
});

describe('core/images', () => {
  it('falls back to process.env in node tests and normalizes legacy data-products paths', async () => {
    process.env.CDN_BASE_URL = 'https://cdn.example.com';

    const { contentImage } = await freshImages();

    assert.equal(
      contentImage('/images/data-products/mouse/razer/viper-v3-pro', 'top', 'm'),
      'https://cdn.example.com/images/mouse/razer/viper-v3-pro/top_m.webp',
    );
  });

  it('ignores CDN_BASE_URL in development runtime', async () => {
    process.env.NODE_ENV = 'development';
    process.env.CDN_BASE_URL = 'https://cdn.example.com';

    const { CONFIG } = await freshConfig();

    assert.equal(CONFIG.cdn.baseUrl, '');
  });
});
