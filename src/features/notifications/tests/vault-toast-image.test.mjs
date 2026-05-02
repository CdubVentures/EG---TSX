import { afterEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

const ORIGINAL_CDN_BASE_URL = process.env.CDN_BASE_URL;
let importCounter = 0;

async function freshVaultToast() {
  importCounter += 1;
  return import(`../components/VaultToast.tsx?test=${importCounter}`);
}

function makeNotification(overrides = {}) {
  return {
    id: 'toast-1',
    kind: 'vault',
    action: 'added',
    createdAt: 1_700_000_000_000,
    duration: 3000,
    product: {
      brand: 'Razer',
      model: 'Viper V3 Pro',
      category: 'mouse',
      imagePath: '/images/data-products/mouse/razer/viper-v3-pro',
      thumbnailStem: 'top',
    },
    ...overrides,
  };
}

afterEach(() => {
  if (ORIGINAL_CDN_BASE_URL === undefined) {
    delete process.env.CDN_BASE_URL;
    return;
  }

  process.env.CDN_BASE_URL = ORIGINAL_CDN_BASE_URL;
});

describe('VaultToast image contract', () => {
  it('uses the configured CDN base and normalizes legacy vault image paths', async () => {
    process.env.CDN_BASE_URL = 'https://cdn.example.com';

    const { default: VaultToast } = await freshVaultToast();
    const html = renderToStaticMarkup(
      React.createElement(VaultToast, { notification: makeNotification() }),
    );

    assert.match(
      html,
      /src="https:\/\/cdn\.example\.com\/images\/mouse\/razer\/viper-v3-pro\/top_xs\.webp"/,
    );
    assert.doesNotMatch(html, /d3m2jw9ed15b7k\.cloudfront\.net/);
  });
});
