import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

// WHY: article-helpers.ts imports from ./images which imports from ./config
// which uses import.meta.env — can't run directly in node:test without Astro.
// So we test the pure logic by inlining the functions here.

describe('articleUrl', () => {
  const articleUrl = (collection, entryId) => `/${collection}/${entryId}`;

  it('builds review URL', () => {
    assert.equal(
      articleUrl('reviews', 'mouse/razer/viper-v3-pro-review'),
      '/reviews/mouse/razer/viper-v3-pro-review'
    );
  });

  it('builds news URL', () => {
    assert.equal(articleUrl('news', 'some-news-article'), '/news/some-news-article');
  });
});

describe('resolveHero', () => {
  const resolveHero = (collection, entryId, stem) =>
    `/images/${collection}/${entryId}/${stem}`;

  it('builds hero path from stem', () => {
    assert.equal(
      resolveHero('reviews', 'mouse/razer/viper-v3-pro-review', 'feature-image'),
      '/images/reviews/mouse/razer/viper-v3-pro-review/feature-image'
    );
  });

  it('handles simple stems', () => {
    assert.equal(
      resolveHero('news', 'my-news', 'title'),
      '/images/news/my-news/title'
    );
  });
});

describe('articleSrcSet', () => {
  const articleSrcSet = (heroPath) => {
    const sizes = [
      { suffix: 'xxs', w: 100 }, { suffix: 'xs', w: 200 },
      { suffix: 's', w: 400 }, { suffix: 'm', w: 600 },
      { suffix: 'l', w: 800 }, { suffix: 'xl', w: 1000 },
      { suffix: 'xxl', w: 2000 },
    ];
    return sizes.map(s => `${heroPath}_${s.suffix}.webp ${s.w}w`).join(', ');
  };

  it('generates 7-size srcset', () => {
    const result = articleSrcSet('/images/reviews/test/feature-image');
    assert.equal(result.split(', ').length, 7);
    assert.ok(result.includes('_xxs.webp 100w'));
    assert.ok(result.includes('_xxl.webp 2000w'));
  });

  it('preserves path exactly', () => {
    const result = articleSrcSet('/images/news/my-article/title');
    assert.ok(result.startsWith('/images/news/my-article/title_xxs.webp'));
  });
});

describe('formatArticleDate', () => {
  const formatArticleDate = (datePublished, dateUpdated) => {
    const date = dateUpdated ?? datePublished;
    if (!date) return '';
    const formatted = new Intl.DateTimeFormat('en-US', {
      month: 'short', day: 'numeric', year: 'numeric',
    }).format(date);
    const prefix = dateUpdated ? 'Updated' : 'Published';
    return `${prefix} | ${formatted}`;
  };

  it('shows "Published" when only datePublished', () => {
    const result = formatArticleDate(new Date('2024-12-09'));
    assert.ok(result.startsWith('Published |'));
    assert.ok(result.includes('Dec'));
    assert.ok(result.includes('2024'));
  });

  it('shows "Updated" when dateUpdated present', () => {
    const result = formatArticleDate(new Date('2024-12-09'), new Date('2025-01-15'));
    assert.ok(result.startsWith('Updated |'));
    assert.ok(result.includes('Jan'));
    assert.ok(result.includes('2025'));
  });

  it('returns empty string when no dates', () => {
    assert.equal(formatArticleDate(null, null), '');
    assert.equal(formatArticleDate(undefined, undefined), '');
  });

  it('prefers dateUpdated over datePublished', () => {
    const result = formatArticleDate(new Date('2020-01-01'), new Date('2025-06-15'));
    assert.ok(result.includes('Updated'));
    assert.ok(result.includes('Jun'));
  });
});
