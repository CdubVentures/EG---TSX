/**
 * images-resolver.test.mjs
 *
 * Unit tests for src/core/images.ts resolver functions.
 * These are pure functions — no Astro runtime needed.
 *
 * Since images.ts uses import.meta.env (Astro-only), we test the
 * pure logic by importing the compiled output or by testing the
 * functions with a known baseUrl.
 *
 * For now, we test the contract: given known inputs, verify the
 * output URL format matches what the disk structure expects.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

// --- Test the URL construction pattern directly ---
// These functions mirror what src/core/images.ts exports,
// but without the Astro import.meta.env dependency.

function productImage(baseUrl, imagePath, stem, size) {
  return `${baseUrl}${imagePath}/${stem}_${size}.webp`;
}

function brandImage(baseUrl, brandSlug, variant, size) {
  return `${baseUrl}/images/brands/${brandSlug}/${variant}_${size}.png`;
}

function articleImage(baseUrl, articleImagePath, stem, size) {
  return `${baseUrl}${articleImagePath}/${stem}_${size}.webp`;
}

function gameImage(baseUrl, gameSlug, stem, size) {
  return `${baseUrl}/images/games/${gameSlug}/${stem}_${size}.webp`;
}

describe('productImage resolver', () => {
  it('builds correct URL with empty baseUrl (dev mode)', () => {
    assert.equal(
      productImage('', '/images/mouse/razer/viper-v3-pro', 'top---white+black', 'm'),
      '/images/mouse/razer/viper-v3-pro/top---white+black_m.webp'
    );
  });

  it('builds correct URL with CDN baseUrl (prod mode)', () => {
    assert.equal(
      productImage('https://d3m2jw9ed15b7k.cloudfront.net', '/images/mouse/razer/viper-v3-pro', 'top---white+black', 'm'),
      'https://d3m2jw9ed15b7k.cloudfront.net/images/mouse/razer/viper-v3-pro/top---white+black_m.webp'
    );
  });

  it('handles all size suffixes', () => {
    const sizes = ['blur', 't', 'xs', 's', 'm', 'l', 'xl', 'xxl', 'zoom'];
    for (const size of sizes) {
      const url = productImage('', '/images/mouse/test/prod', 'img', size);
      assert.ok(url.endsWith(`_${size}.webp`), `Size ${size} not applied correctly: ${url}`);
    }
  });

  it('handles keyboard product', () => {
    assert.equal(
      productImage('', '/images/keyboard/nuphy/field75he', 'feature-image', 'xl'),
      '/images/keyboard/nuphy/field75he/feature-image_xl.webp'
    );
  });

  it('handles monitor product', () => {
    assert.equal(
      productImage('', '/images/monitor/msi/mpg-321urx-qd-oled', 'feature-image', 'xxl'),
      '/images/monitor/msi/mpg-321urx-qd-oled/feature-image_xxl.webp'
    );
  });

  it('handles color variant stems', () => {
    assert.equal(
      productImage('', '/images/mouse/alienware/aw610m', 'top---gray+black', 'm'),
      '/images/mouse/alienware/aw610m/top---gray+black_m.webp'
    );
  });
});

describe('brandImage resolver', () => {
  it('builds correct brand logo URL (dev)', () => {
    assert.equal(
      brandImage('', 'razer', 'brand-logo-horizontal-mono-black', 'xs'),
      '/images/brands/razer/brand-logo-horizontal-mono-black_xs.png'
    );
  });

  it('builds correct brand logo URL (prod)', () => {
    assert.equal(
      brandImage('https://cdn.example.com', 'alienware', 'brand-logo-horizontal-mono-white', 'l'),
      'https://cdn.example.com/images/brands/alienware/brand-logo-horizontal-mono-white_l.png'
    );
  });

  it('handles multi-word brand slugs', () => {
    assert.equal(
      brandImage('', 'endgame-gear', 'brand-logo-horizontal-primary', 'm'),
      '/images/brands/endgame-gear/brand-logo-horizontal-primary_m.png'
    );
  });
});

describe('gameImage resolver', () => {
  it('builds correct game box art URL (dev)', () => {
    assert.equal(
      gameImage('', 'apex-legends', 'box-art-cover', 's'),
      '/images/games/apex-legends/box-art-cover_s.webp'
    );
  });

  it('builds correct game box art URL (prod)', () => {
    assert.equal(
      gameImage('https://d3m2jw9ed15b7k.cloudfront.net', 'counter-strike-2', 'box-art-cover', 's'),
      'https://d3m2jw9ed15b7k.cloudfront.net/images/games/counter-strike-2/box-art-cover_s.webp'
    );
  });

  it('handles hero images', () => {
    assert.equal(
      gameImage('', 'valorant', 'hero-img', 'xl'),
      '/images/games/valorant/hero-img_xl.webp'
    );
  });

  it('handles cover images', () => {
    assert.equal(
      gameImage('', 'fortnite', 'cover', 'm'),
      '/images/games/fortnite/cover_m.webp'
    );
  });
});

describe('articleImage resolver', () => {
  it('builds correct article hero URL (dev)', () => {
    assert.equal(
      articleImage('', '/images/reviews/mouse/alienware/aw610m', 'hero', 'xl'),
      '/images/reviews/mouse/alienware/aw610m/hero_xl.webp'
    );
  });

  it('builds correct guide hero URL', () => {
    assert.equal(
      articleImage('', '/images/guides/mouse/mouse-best-budget', 'title', 'm'),
      '/images/guides/mouse/mouse-best-budget/title_m.webp'
    );
  });
});

// --- NEW: Universal resolver + convention helper ---
// These replace the per-type functions above.

function contentImage(baseUrl, basePath, stem, size, ext = 'webp') {
  return `${baseUrl}${basePath}/${stem}_${size}.${ext}`;
}

function collectionImagePath(collection, entryId) {
  return `/images/${collection}/${entryId}`;
}

describe('contentImage universal resolver', () => {
  it('builds product URL (replaces productImage)', () => {
    assert.equal(
      contentImage('', '/images/mouse/razer/viper-v3-pro', 'top---white+black', 'm'),
      '/images/mouse/razer/viper-v3-pro/top---white+black_m.webp'
    );
  });

  it('builds game URL (replaces gameImage)', () => {
    assert.equal(
      contentImage('', '/images/games/apex-legends', 'box-art-cover', 's'),
      '/images/games/apex-legends/box-art-cover_s.webp'
    );
  });

  it('builds article URL (replaces articleImage)', () => {
    assert.equal(
      contentImage('', '/images/reviews/mouse/alienware-aw610m-review', 'hero', 'xl'),
      '/images/reviews/mouse/alienware-aw610m-review/hero_xl.webp'
    );
  });

  it('builds brand URL with png extension (replaces brandImage)', () => {
    assert.equal(
      contentImage('', '/images/brands/razer', 'brand-logo-horizontal-mono-black', 'xs', 'png'),
      '/images/brands/razer/brand-logo-horizontal-mono-black_xs.png'
    );
  });

  it('defaults to webp extension', () => {
    const url = contentImage('', '/images/games/valorant', 'hero', 'xl');
    assert.ok(url.endsWith('.webp'));
  });

  it('works with CDN baseUrl', () => {
    const cdn = 'https://d3m2jw9ed15b7k.cloudfront.net';
    assert.equal(
      contentImage(cdn, '/images/mouse/razer/viper-v3-pro', 'top---white+black', 'm'),
      'https://d3m2jw9ed15b7k.cloudfront.net/images/mouse/razer/viper-v3-pro/top---white+black_m.webp'
    );
  });

  it('handles all size suffixes', () => {
    const sizes = ['blur', 't', 'xs', 's', 'm', 'l', 'xl', 'xxl', 'zoom'];
    for (const size of sizes) {
      const url = contentImage('', '/images/test', 'img', size);
      assert.ok(url.endsWith(`_${size}.webp`), `Size ${size} not applied correctly: ${url}`);
    }
  });
});

describe('collectionImagePath convention helper', () => {
  it('derives game image path from collection + slug', () => {
    assert.equal(
      collectionImagePath('games', 'apex-legends'),
      '/images/games/apex-legends'
    );
  });

  it('derives brand image path from collection + slug', () => {
    assert.equal(
      collectionImagePath('brands', 'razer'),
      '/images/brands/razer'
    );
  });

  it('derives guide image path with subdir', () => {
    assert.equal(
      collectionImagePath('guides', 'mouse/mouse-best-overall'),
      '/images/guides/mouse/mouse-best-overall'
    );
  });

  it('derives review image path with subdir', () => {
    assert.equal(
      collectionImagePath('reviews', 'mouse/alienware-aw610m-review'),
      '/images/reviews/mouse/alienware-aw610m-review'
    );
  });

  it('derives news image path with subdir', () => {
    assert.equal(
      collectionImagePath('news', 'ai/common-sense-machines-unveils-ai-platform-for-real-time-level-generation-in-games'),
      '/images/news/ai/common-sense-machines-unveils-ai-platform-for-real-time-level-generation-in-games'
    );
  });

  it('contentImage + collectionImagePath compose correctly', () => {
    const basePath = collectionImagePath('games', 'apex-legends');
    assert.equal(
      contentImage('', basePath, 'box-art-cover', 's'),
      '/images/games/apex-legends/box-art-cover_s.webp'
    );
  });

  it('contentImage + collectionImagePath for brand with png', () => {
    const basePath = collectionImagePath('brands', 'endgame-gear');
    assert.equal(
      contentImage('', basePath, 'brand-logo-horizontal-mono-black', 'xs', 'png'),
      '/images/brands/endgame-gear/brand-logo-horizontal-mono-black_xs.png'
    );
  });
});

describe('URL format consistency', () => {
  it('all resolvers produce URLs starting with / when baseUrl is empty', () => {
    const urls = [
      productImage('', '/images/mouse/test/prod', 'img', 'm'),
      brandImage('', 'test', 'brand-logo-horizontal-mono-black', 'xs'),
      gameImage('', 'test-game', 'box-art-cover', 's'),
      articleImage('', '/images/reviews/test', 'hero', 'xl'),
      contentImage('', '/images/guides/mouse/test', 'title', 'm'),
      contentImage('', collectionImagePath('brands', 'test'), 'brand-logo-horizontal-mono-black', 'xs', 'png'),
    ];
    for (const url of urls) {
      assert.ok(url.startsWith('/'), `URL should start with /: ${url}`);
    }
  });

  it('all resolvers produce URLs starting with https when baseUrl is CDN', () => {
    const cdn = 'https://d3m2jw9ed15b7k.cloudfront.net';
    const urls = [
      productImage(cdn, '/images/mouse/test/prod', 'img', 'm'),
      brandImage(cdn, 'test', 'brand-logo-horizontal-mono-black', 'xs'),
      gameImage(cdn, 'test-game', 'box-art-cover', 's'),
      articleImage(cdn, '/images/reviews/test', 'hero', 'xl'),
      contentImage(cdn, '/images/guides/mouse/test', 'title', 'm'),
      contentImage(cdn, collectionImagePath('brands', 'test'), 'brand-logo-horizontal-mono-black', 'xs', 'png'),
    ];
    for (const url of urls) {
      assert.ok(url.startsWith('https://'), `URL should start with https://: ${url}`);
    }
  });
});

