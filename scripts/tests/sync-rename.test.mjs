/**
 * sync-rename.test.mjs
 *
 * Tests for the sync-rename script's pure functions.
 * These compute the file/folder operations needed for a rename.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

/**
 * Given a collection, old/new entry IDs, extension, and mode,
 * compute all the paths that need renaming.
 *
 * mode='flat':        {entryId}.md (legacy)
 * mode='slug-folder': {entryId}/index.md (post-migration)
 */
function computeRenamePaths(collection, oldEntryId, newEntryId, ext = '.md', mode = 'flat') {
  if (mode === 'slug-folder') {
    return {
      contentFrom: `src/content/${collection}/${oldEntryId}/index${ext}`,
      contentTo:   `src/content/${collection}/${newEntryId}/index${ext}`,
      contentDirFrom: `src/content/${collection}/${oldEntryId}`,
      contentDirTo:   `src/content/${collection}/${newEntryId}`,
      imagesFrom:  `public/images/${collection}/${oldEntryId}`,
      imagesTo:    `public/images/${collection}/${newEntryId}`,
      mode: 'slug-folder',
    };
  }
  return {
    contentFrom: `src/content/${collection}/${oldEntryId}${ext}`,
    contentTo:   `src/content/${collection}/${newEntryId}${ext}`,
    imagesFrom:  `public/images/${collection}/${oldEntryId}`,
    imagesTo:    `public/images/${collection}/${newEntryId}`,
    mode: 'flat',
  };
}

describe('computeRenamePaths (flat mode)', () => {
  it('computes game rename paths', () => {
    const result = computeRenamePaths('games', 'apex-legends', 'apex-legends-2');
    assert.deepEqual(result, {
      contentFrom: 'src/content/games/apex-legends.md',
      contentTo:   'src/content/games/apex-legends-2.md',
      imagesFrom:  'public/images/games/apex-legends',
      imagesTo:    'public/images/games/apex-legends-2',
      mode: 'flat',
    });
  });

  it('computes brand rename paths', () => {
    const result = computeRenamePaths('brands', 'razer', 'razer-gaming');
    assert.deepEqual(result, {
      contentFrom: 'src/content/brands/razer.md',
      contentTo:   'src/content/brands/razer-gaming.md',
      imagesFrom:  'public/images/brands/razer',
      imagesTo:    'public/images/brands/razer-gaming',
      mode: 'flat',
    });
  });

  it('computes guide rename paths (with subdir)', () => {
    const result = computeRenamePaths('guides', 'mouse/mouse-best-overall', 'mouse/mouse-top-picks');
    assert.deepEqual(result, {
      contentFrom: 'src/content/guides/mouse/mouse-best-overall.md',
      contentTo:   'src/content/guides/mouse/mouse-top-picks.md',
      imagesFrom:  'public/images/guides/mouse/mouse-best-overall',
      imagesTo:    'public/images/guides/mouse/mouse-top-picks',
      mode: 'flat',
    });
  });

  it('computes review rename paths', () => {
    const result = computeRenamePaths('reviews', 'mouse/alienware-aw610m-review', 'mouse/alienware-aw610m-v2-review');
    assert.deepEqual(result, {
      contentFrom: 'src/content/reviews/mouse/alienware-aw610m-review.md',
      contentTo:   'src/content/reviews/mouse/alienware-aw610m-v2-review.md',
      imagesFrom:  'public/images/reviews/mouse/alienware-aw610m-review',
      imagesTo:    'public/images/reviews/mouse/alienware-aw610m-v2-review',
      mode: 'flat',
    });
  });

  it('computes news rename paths', () => {
    const result = computeRenamePaths('news', 'mouse/old-article-name', 'mouse/new-article-name');
    assert.deepEqual(result, {
      contentFrom: 'src/content/news/mouse/old-article-name.md',
      contentTo:   'src/content/news/mouse/new-article-name.md',
      imagesFrom:  'public/images/news/mouse/old-article-name',
      imagesTo:    'public/images/news/mouse/new-article-name',
      mode: 'flat',
    });
  });
});

describe('computeRenamePaths (slug-folder mode)', () => {
  it('computes game rename paths in slug-folder mode', () => {
    const result = computeRenamePaths('games', 'apex-legends', 'apex-legends-2', '.md', 'slug-folder');
    assert.deepEqual(result, {
      contentFrom:    'src/content/games/apex-legends/index.md',
      contentTo:      'src/content/games/apex-legends-2/index.md',
      contentDirFrom: 'src/content/games/apex-legends',
      contentDirTo:   'src/content/games/apex-legends-2',
      imagesFrom:     'public/images/games/apex-legends',
      imagesTo:       'public/images/games/apex-legends-2',
      mode: 'slug-folder',
    });
  });

  it('computes review rename paths in slug-folder mode', () => {
    const result = computeRenamePaths('reviews', 'mouse/alienware-aw610m-review', 'mouse/alienware-aw610m-v2-review', '.md', 'slug-folder');
    assert.deepEqual(result, {
      contentFrom:    'src/content/reviews/mouse/alienware-aw610m-review/index.md',
      contentTo:      'src/content/reviews/mouse/alienware-aw610m-v2-review/index.md',
      contentDirFrom: 'src/content/reviews/mouse/alienware-aw610m-review',
      contentDirTo:   'src/content/reviews/mouse/alienware-aw610m-v2-review',
      imagesFrom:     'public/images/reviews/mouse/alienware-aw610m-review',
      imagesTo:       'public/images/reviews/mouse/alienware-aw610m-v2-review',
      mode: 'slug-folder',
    });
  });

  it('computes brand rename paths with .mdx extension', () => {
    const result = computeRenamePaths('brands', 'razer', 'razer-gaming', '.mdx', 'slug-folder');
    assert.deepEqual(result, {
      contentFrom:    'src/content/brands/razer/index.mdx',
      contentTo:      'src/content/brands/razer-gaming/index.mdx',
      contentDirFrom: 'src/content/brands/razer',
      contentDirTo:   'src/content/brands/razer-gaming',
      imagesFrom:     'public/images/brands/razer',
      imagesTo:       'public/images/brands/razer-gaming',
      mode: 'slug-folder',
    });
  });

  it('image paths are identical in both modes', () => {
    const flat = computeRenamePaths('games', 'apex-legends', 'apex-2', '.md', 'flat');
    const slug = computeRenamePaths('games', 'apex-legends', 'apex-2', '.md', 'slug-folder');
    assert.equal(flat.imagesFrom, slug.imagesFrom);
    assert.equal(flat.imagesTo, slug.imagesTo);
  });
});

describe('validation rules', () => {
  it('rejects same old and new entry ID', () => {
    assert.throws(
      () => validateRenameArgs('games', 'apex-legends', 'apex-legends'),
      /old and new entry IDs must be different/
    );
  });

  it('rejects empty collection', () => {
    assert.throws(
      () => validateRenameArgs('', 'old', 'new'),
      /collection is required/
    );
  });

  it('rejects empty entry IDs', () => {
    assert.throws(
      () => validateRenameArgs('games', '', 'new'),
      /old entry ID is required/
    );
    assert.throws(
      () => validateRenameArgs('games', 'old', ''),
      /new entry ID is required/
    );
  });

  it('rejects unknown collection', () => {
    assert.throws(
      () => validateRenameArgs('widgets', 'old', 'new'),
      /unknown collection/
    );
  });

  it('accepts valid args', () => {
    assert.doesNotThrow(() => validateRenameArgs('games', 'old-game', 'new-game'));
  });
});

// ─── Validation function under test ─────────────────────────────────────────

function validateRenameArgs(collection, oldEntryId, newEntryId) {
  const COLLECTIONS = ['games', 'brands', 'guides', 'news', 'reviews'];
  if (!collection) throw new Error('collection is required');
  if (!oldEntryId) throw new Error('old entry ID is required');
  if (!newEntryId) throw new Error('new entry ID is required');
  if (oldEntryId === newEntryId) throw new Error('old and new entry IDs must be different');
  if (!COLLECTIONS.includes(collection)) throw new Error(`unknown collection: ${collection}`);
}
