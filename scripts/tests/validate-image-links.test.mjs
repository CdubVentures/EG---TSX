/**
 * validate-image-links.test.mjs
 *
 * Tests for the pure functions used by the image link validator.
 * These functions derive expected image paths from content file paths
 * and compare them against what exists on disk.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

// ─── Pure functions under test ──────────────────────────────────────────────
// These will be exported from validate-image-links.mjs

/**
 * Given a content file path relative to src/content/,
 * derive the collection name and entry ID.
 *
 * Example: "guides/mouse/mouse-best-overall.md"
 *   → { collection: "guides", entryId: "mouse/mouse-best-overall" }
 */
function parseContentPath(relPath) {
  const parts = relPath.replace(/\\/g, '/').split('/');
  const collection = parts[0];
  let rest = parts.slice(1).join('/').replace(/\.(md|mdx)$/, '');
  rest = rest.replace(/\/index$/, '');
  return { collection, entryId: rest };
}

/**
 * Derive expected image folder from collection + entryId.
 * Convention: /images/{collection}/{entryId}
 */
function expectedImageFolder(collection, entryId) {
  return `images/${collection}/${entryId}`;
}

/**
 * Given a list of content entries and a list of image folders that exist,
 * return { matched, mismatched, orphanFolders }.
 * - matched: entries whose expected folder exists
 * - mismatched: entries whose expected folder is missing
 * - orphanFolders: image folders with no matching content entry
 */
function compareEntriesToFolders(entries, existingFolders) {
  const folderSet = new Set(existingFolders.map(f => f.replace(/\\/g, '/')));
  const expectedSet = new Set();

  const matched = [];
  const mismatched = [];

  for (const entry of entries) {
    const expected = expectedImageFolder(entry.collection, entry.entryId);
    expectedSet.add(expected);
    if (folderSet.has(expected)) {
      matched.push({ ...entry, expectedFolder: expected });
    } else {
      mismatched.push({ ...entry, expectedFolder: expected });
    }
  }

  const orphanFolders = existingFolders
    .map(f => f.replace(/\\/g, '/'))
    .filter(f => !expectedSet.has(f));

  return { matched, mismatched, orphanFolders };
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('parseContentPath', () => {
  it('parses game content path', () => {
    const result = parseContentPath('games/apex-legends.md');
    assert.deepEqual(result, { collection: 'games', entryId: 'apex-legends' });
  });

  it('parses brand content path', () => {
    const result = parseContentPath('brands/razer.md');
    assert.deepEqual(result, { collection: 'brands', entryId: 'razer' });
  });

  it('parses guide with subdirectory', () => {
    const result = parseContentPath('guides/mouse/mouse-best-overall.md');
    assert.deepEqual(result, { collection: 'guides', entryId: 'mouse/mouse-best-overall' });
  });

  it('parses review with subdirectory', () => {
    const result = parseContentPath('reviews/mouse/alienware-aw610m-review.md');
    assert.deepEqual(result, { collection: 'reviews', entryId: 'mouse/alienware-aw610m-review' });
  });

  it('parses news with subdirectory', () => {
    const result = parseContentPath('news/ai/common-sense-machines-unveils-ai-platform-for-real-time-level-generation-in-games.md');
    assert.deepEqual(result, {
      collection: 'news',
      entryId: 'ai/common-sense-machines-unveils-ai-platform-for-real-time-level-generation-in-games'
    });
  });

  it('strips .mdx extension', () => {
    const result = parseContentPath('guides/mouse/mouse-grip-guide.mdx');
    assert.deepEqual(result, { collection: 'guides', entryId: 'mouse/mouse-grip-guide' });
  });

  it('normalizes backslashes to forward slashes', () => {
    const result = parseContentPath('guides\\mouse\\mouse-best-overall.md');
    assert.deepEqual(result, { collection: 'guides', entryId: 'mouse/mouse-best-overall' });
  });

  // ─── Slug-folder paths (post-migration) ─────────────────────────────────

  it('parses review slug-folder path (index.md)', () => {
    const result = parseContentPath('reviews/mouse/alienware-aw610m-review/index.md');
    assert.deepEqual(result, { collection: 'reviews', entryId: 'mouse/alienware-aw610m-review' });
  });

  it('parses brand slug-folder path (index.md)', () => {
    const result = parseContentPath('brands/razer/index.md');
    assert.deepEqual(result, { collection: 'brands', entryId: 'razer' });
  });

  it('parses guide slug-folder path (index.mdx)', () => {
    const result = parseContentPath('guides/mouse/mouse-grip-guide/index.mdx');
    assert.deepEqual(result, { collection: 'guides', entryId: 'mouse/mouse-grip-guide' });
  });
});

describe('expectedImageFolder', () => {
  it('builds game image folder', () => {
    assert.equal(expectedImageFolder('games', 'apex-legends'), 'images/games/apex-legends');
  });

  it('builds brand image folder', () => {
    assert.equal(expectedImageFolder('brands', 'razer'), 'images/brands/razer');
  });

  it('builds guide image folder with subdir', () => {
    assert.equal(
      expectedImageFolder('guides', 'mouse/mouse-best-overall'),
      'images/guides/mouse/mouse-best-overall'
    );
  });

  it('builds review image folder with subdir', () => {
    assert.equal(
      expectedImageFolder('reviews', 'mouse/alienware-aw610m-review'),
      'images/reviews/mouse/alienware-aw610m-review'
    );
  });
});

describe('compareEntriesToFolders', () => {
  it('matches entries to existing folders', () => {
    const entries = [
      { collection: 'games', entryId: 'apex-legends', file: 'apex-legends.md' },
      { collection: 'games', entryId: 'valorant', file: 'valorant.md' },
    ];
    const folders = ['images/games/apex-legends', 'images/games/valorant'];
    const result = compareEntriesToFolders(entries, folders);

    assert.equal(result.matched.length, 2);
    assert.equal(result.mismatched.length, 0);
    assert.equal(result.orphanFolders.length, 0);
  });

  it('reports mismatched entries (missing folder)', () => {
    const entries = [
      { collection: 'games', entryId: 'apex-legends', file: 'apex-legends.md' },
      { collection: 'games', entryId: 'new-game', file: 'new-game.md' },
    ];
    const folders = ['images/games/apex-legends'];
    const result = compareEntriesToFolders(entries, folders);

    assert.equal(result.matched.length, 1);
    assert.equal(result.mismatched.length, 1);
    assert.equal(result.mismatched[0].entryId, 'new-game');
    assert.equal(result.mismatched[0].expectedFolder, 'images/games/new-game');
  });

  it('reports orphan folders (no matching content)', () => {
    const entries = [
      { collection: 'games', entryId: 'apex-legends', file: 'apex-legends.md' },
    ];
    const folders = ['images/games/apex-legends', 'images/games/old-deleted-game'];
    const result = compareEntriesToFolders(entries, folders);

    assert.equal(result.matched.length, 1);
    assert.equal(result.orphanFolders.length, 1);
    assert.equal(result.orphanFolders[0], 'images/games/old-deleted-game');
  });

  it('handles mixed matched, mismatched, and orphans', () => {
    const entries = [
      { collection: 'guides', entryId: 'mouse/mouse-best-overall', file: 'mouse-best-overall.md' },
      { collection: 'guides', entryId: 'mouse/mouse-grip-guide', file: 'mouse-grip-guide.md' },
    ];
    const folders = [
      'images/guides/mouse/mouse-best-overall',
      'images/guides/mouse/best-budget',  // orphan — old name
    ];
    const result = compareEntriesToFolders(entries, folders);

    assert.equal(result.matched.length, 1);
    assert.equal(result.matched[0].entryId, 'mouse/mouse-best-overall');
    assert.equal(result.mismatched.length, 1);
    assert.equal(result.mismatched[0].entryId, 'mouse/mouse-grip-guide');
    assert.equal(result.orphanFolders.length, 1);
    assert.equal(result.orphanFolders[0], 'images/guides/mouse/best-budget');
  });

  it('normalizes backslashes in folder paths', () => {
    const entries = [
      { collection: 'games', entryId: 'apex-legends', file: 'apex-legends.md' },
    ];
    const folders = ['images\\games\\apex-legends'];
    const result = compareEntriesToFolders(entries, folders);

    assert.equal(result.matched.length, 1);
    assert.equal(result.mismatched.length, 0);
  });

  it('returns empty arrays when no entries', () => {
    const result = compareEntriesToFolders([], ['images/games/apex-legends']);
    assert.equal(result.matched.length, 0);
    assert.equal(result.mismatched.length, 0);
    assert.equal(result.orphanFolders.length, 1);
  });
});
