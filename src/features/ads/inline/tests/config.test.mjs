import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';

// ─── inlineCadenceSchema ────────────────────────────────────────────────
describe('inlineCadenceSchema', () => {
  it('parses valid full config', async () => {
    const { inlineAdsConfigSchema } = await import('../config.ts');
    const valid = {
      defaults: { position: 'in_content', desktop: true, mobile: true },
      collections: {
        reviews: {
          enabled: true,
          desktop: { firstAfter: 3, every: 5, max: 8 },
          mobile: { firstAfter: 3, every: 4, max: 10 },
          wordScaling: {
            enabled: true,
            desktopWordsPerAd: 450,
            mobileWordsPerAd: 350,
            minFirstAdWords: 150,
          },
        },
      },
    };
    const result = inlineAdsConfigSchema.parse(valid);
    assert.equal(result.collections.reviews.enabled, true);
    assert.equal(result.collections.reviews.desktop.firstAfter, 3);
  });

  it('rejects missing firstAfter field on enabled collection', async () => {
    const { inlineAdsConfigSchema } = await import('../config.ts');
    const bad = {
      defaults: { position: 'in_content', desktop: true, mobile: true },
      collections: {
        reviews: {
          enabled: true,
          desktop: { every: 5, max: 8 },
          mobile: { firstAfter: 3, every: 4, max: 10 },
          wordScaling: {
            enabled: true,
            desktopWordsPerAd: 450,
            mobileWordsPerAd: 350,
            minFirstAdWords: 150,
          },
        },
      },
    };
    assert.throws(() => inlineAdsConfigSchema.parse(bad));
  });

  it('rejects negative every value', async () => {
    const { inlineAdsConfigSchema } = await import('../config.ts');
    const bad = {
      defaults: { position: 'in_content', desktop: true, mobile: true },
      collections: {
        reviews: {
          enabled: true,
          desktop: { firstAfter: 3, every: -1, max: 8 },
          mobile: { firstAfter: 3, every: 4, max: 10 },
          wordScaling: {
            enabled: true,
            desktopWordsPerAd: 450,
            mobileWordsPerAd: 350,
            minFirstAdWords: 150,
          },
        },
      },
    };
    assert.throws(() => inlineAdsConfigSchema.parse(bad));
  });

  it('rejects max of 0 when enabled', async () => {
    const { inlineAdsConfigSchema } = await import('../config.ts');
    const bad = {
      defaults: { position: 'in_content', desktop: true, mobile: true },
      collections: {
        reviews: {
          enabled: true,
          desktop: { firstAfter: 3, every: 5, max: 0 },
          mobile: { firstAfter: 3, every: 4, max: 10 },
          wordScaling: {
            enabled: true,
            desktopWordsPerAd: 450,
            mobileWordsPerAd: 350,
            minFirstAdWords: 150,
          },
        },
      },
    };
    assert.throws(() => inlineAdsConfigSchema.parse(bad));
  });

  it('allows disabled collection with no cadence fields', async () => {
    const { inlineAdsConfigSchema } = await import('../config.ts');
    const valid = {
      defaults: { position: 'in_content', desktop: true, mobile: true },
      collections: {
        games: { enabled: false },
      },
    };
    const result = inlineAdsConfigSchema.parse(valid);
    assert.equal(result.collections.games.enabled, false);
  });

  it('allows multiple collections mixed enabled/disabled', async () => {
    const { inlineAdsConfigSchema } = await import('../config.ts');
    const valid = {
      defaults: { position: 'in_content', desktop: true, mobile: true },
      collections: {
        reviews: {
          enabled: true,
          desktop: { firstAfter: 3, every: 5, max: 8 },
          mobile: { firstAfter: 3, every: 4, max: 10 },
          wordScaling: {
            enabled: true,
            desktopWordsPerAd: 450,
            mobileWordsPerAd: 350,
            minFirstAdWords: 150,
          },
        },
        games: { enabled: false },
        brands: { enabled: false },
      },
    };
    const result = inlineAdsConfigSchema.parse(valid);
    assert.equal(result.collections.reviews.enabled, true);
    assert.equal(result.collections.games.enabled, false);
  });
});

// ─── INLINE_ADS_CONFIG export ───────────────────────────────────────────
describe('INLINE_ADS_CONFIG', () => {
  it('is loaded and validated from JSON', async () => {
    const { INLINE_ADS_CONFIG } = await import('../config.ts');
    assert.ok(INLINE_ADS_CONFIG);
    assert.ok(INLINE_ADS_CONFIG.defaults);
    assert.ok(INLINE_ADS_CONFIG.collections);
    assert.equal(INLINE_ADS_CONFIG.defaults.position, 'in_content');
  });

  it('reviews collection is enabled with cadence fields', async () => {
    const { INLINE_ADS_CONFIG } = await import('../config.ts');
    const reviews = INLINE_ADS_CONFIG.collections.reviews;
    assert.equal(reviews.enabled, true);
    assert.equal(typeof reviews.desktop?.firstAfter, 'number');
    assert.equal(typeof reviews.desktop?.every, 'number');
    assert.equal(typeof reviews.desktop?.max, 'number');
  });

  it('games collection is disabled', async () => {
    const { INLINE_ADS_CONFIG } = await import('../config.ts');
    assert.equal(INLINE_ADS_CONFIG.collections.games.enabled, false);
  });
});
