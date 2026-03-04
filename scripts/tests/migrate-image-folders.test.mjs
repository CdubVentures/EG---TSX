/**
 * migrate-image-folders.test.mjs
 *
 * Tests for the pure matching logic that pairs mismatched content files
 * to their likely orphan image folders.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

/**
 * Given a mismatched entry and a list of orphan folders,
 * find the best matching orphan folder to rename.
 *
 * Matching strategies (in priority order):
 * 1. Exact collection + strip category prefix (guides pattern)
 * 2. Exact collection + brand/model nesting → flat slug (review hardware pattern)
 * 3. Fuzzy slug similarity within same collection subdir
 */
function findBestMatch(entry, orphanFolders) {
  const { collection, entryId } = entry;
  const prefix = `images/${collection}/`;
  const relevantOrphans = orphanFolders.filter(f => f.startsWith(prefix));

  // Strategy 1: Strip category prefix from entryId
  // e.g., entryId="mouse/mouse-best-overall" → stripped="mouse/best-overall"
  const parts = entryId.split('/');
  if (parts.length >= 2) {
    const subdir = parts[0];
    const slug = parts.slice(1).join('/');
    // Strip category prefix from slug if it starts with subdir name
    if (slug.startsWith(subdir + '-')) {
      const stripped = subdir + '/' + slug.slice(subdir.length + 1);
      const candidate = `images/${collection}/${stripped}`;
      if (relevantOrphans.includes(candidate)) {
        return candidate;
      }
    }
  }

  // Strategy 2: Brand/model nesting → flat slug (reviews)
  // e.g., entryId="mouse/alienware-aw610m-review" → orphan="mouse/alienware/aw610m"
  // The orphan has brand/model as separate path segments
  if (parts.length >= 2) {
    const subdir = parts[0];
    const slug = parts.slice(1).join('/');
    // Try removing "-review" suffix and splitting by first "-" as brand/model
    const withoutReview = slug.replace(/-review$/, '');
    for (const orphan of relevantOrphans) {
      const orphanRel = orphan.slice(prefix.length);
      const orphanParts = orphanRel.split('/');
      if (orphanParts[0] === subdir && orphanParts.length >= 3) {
        // Reconstruct flat slug from nested: brand/model → brand-model
        const nestedSlug = orphanParts.slice(1).join('-');
        if (nestedSlug === withoutReview) {
          return orphan;
        }
      }
    }
  }

  // Strategy 3: Fuzzy match — find orphan in same subdir with highest overlap
  if (parts.length >= 2) {
    const subdir = parts[0];
    const slug = parts.slice(1).join('/');
    const slugWords = new Set(slug.replace(/-review$/, '').split('-'));

    let bestMatch = null;
    let bestScore = 0;

    for (const orphan of relevantOrphans) {
      const orphanRel = orphan.slice(prefix.length);
      const orphanParts = orphanRel.split('/');
      if (orphanParts[0] !== subdir) continue;

      const orphanSlug = orphanParts.slice(1).join('-');
      const orphanWords = new Set(orphanSlug.split('-'));

      // Count word overlap
      let overlap = 0;
      for (const word of slugWords) {
        if (orphanWords.has(word)) overlap++;
      }
      const score = overlap / Math.max(slugWords.size, orphanWords.size);

      if (score > bestScore && score >= 0.4) {
        bestScore = score;
        bestMatch = orphan;
      }
    }

    if (bestMatch) return bestMatch;
  }

  return null;
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('findBestMatch', () => {
  describe('Strategy 1: strip category prefix (guides)', () => {
    it('matches guide with stripped category prefix', () => {
      const entry = { collection: 'guides', entryId: 'mouse/mouse-best-overall' };
      const orphans = ['images/guides/mouse/best-overall'];
      assert.equal(findBestMatch(entry, orphans), 'images/guides/mouse/best-overall');
    });

    it('matches keyboard guide', () => {
      const entry = { collection: 'guides', entryId: 'keyboard/keyboard-best-budget' };
      const orphans = ['images/guides/keyboard/best-budget'];
      assert.equal(findBestMatch(entry, orphans), 'images/guides/keyboard/best-budget');
    });

    it('matches hardware guide', () => {
      const entry = { collection: 'guides', entryId: 'hardware/hardware-highlighted-products' };
      const orphans = ['images/guides/hardware/highlighted-products'];
      assert.equal(findBestMatch(entry, orphans), 'images/guides/hardware/highlighted-products');
    });
  });

  describe('Strategy 2: brand/model nesting (reviews)', () => {
    it('matches mouse review with brand/model nesting', () => {
      const entry = { collection: 'reviews', entryId: 'mouse/alienware-aw610m-review' };
      const orphans = ['images/reviews/mouse/alienware/aw610m'];
      assert.equal(findBestMatch(entry, orphans), 'images/reviews/mouse/alienware/aw610m');
    });

    it('matches keyboard review', () => {
      const entry = { collection: 'reviews', entryId: 'keyboard/corsair-k100-rgb-review' };
      const orphans = ['images/reviews/keyboard/corsair/k100-rgb'];
      assert.equal(findBestMatch(entry, orphans), 'images/reviews/keyboard/corsair/k100-rgb');
    });

    it('matches monitor review with multi-word brand', () => {
      const entry = { collection: 'reviews', entryId: 'keyboard/logitech-g-g915-tkl-review' };
      const orphans = ['images/reviews/keyboard/logitech-g/g915-tkl'];
      assert.equal(findBestMatch(entry, orphans), 'images/reviews/keyboard/logitech-g/g915-tkl');
    });
  });

  describe('Strategy 3: fuzzy match (game/gpu reviews)', () => {
    it('matches game review by word overlap', () => {
      const entry = { collection: 'reviews', entryId: 'game/capcom-monster-hunter-wilds-review' };
      const orphans = ['images/reviews/game/monster-hunter-wilds-hunt-the-forbidden-lands'];
      assert.equal(
        findBestMatch(entry, orphans),
        'images/reviews/game/monster-hunter-wilds-hunt-the-forbidden-lands'
      );
    });

    it('matches gpu review by word overlap', () => {
      const entry = { collection: 'reviews', entryId: 'gpu/amd-radeon-rx-7900-xtx-review' };
      const orphans = ['images/reviews/gpu/amd-radeon-rx-7900-xtx-rdna-3-powerhouse'];
      assert.equal(
        findBestMatch(entry, orphans),
        'images/reviews/gpu/amd-radeon-rx-7900-xtx-rdna-3-powerhouse'
      );
    });
  });

  describe('News slug mismatches', () => {
    it('matches news with apostrophe difference', () => {
      const entry = { collection: 'news', entryId: 'keyboard/apple-s-new-magic-keyboard-for-ipad-air-enhanced-trackpad-and-lower-price' };
      const orphans = ['images/news/keyboard/apples-new-magic-keyboard-for-ipad-air-enhanced-trackpad-and-lower-price'];
      // Fuzzy match should find this
      assert.equal(
        findBestMatch(entry, orphans),
        'images/news/keyboard/apples-new-magic-keyboard-for-ipad-air-enhanced-trackpad-and-lower-price'
      );
    });

    it('matches news with extra suffix', () => {
      const entry = { collection: 'news', entryId: 'mouse/the-rise-of-lightweight-gaming-mice' };
      const orphans = ['images/news/mouse/the-rise-of-lightweight-gaming-mice-is-less-more'];
      assert.equal(
        findBestMatch(entry, orphans),
        'images/news/mouse/the-rise-of-lightweight-gaming-mice-is-less-more'
      );
    });
  });

  describe('Edge cases', () => {
    it('returns null when no orphans match', () => {
      const entry = { collection: 'games', entryId: 'new-game' };
      const orphans = ['images/brands/razer'];
      assert.equal(findBestMatch(entry, orphans), null);
    });

    it('returns null for empty orphan list', () => {
      const entry = { collection: 'guides', entryId: 'mouse/mouse-best-overall' };
      assert.equal(findBestMatch(entry, []), null);
    });

    it('does not match across collections', () => {
      const entry = { collection: 'guides', entryId: 'mouse/mouse-best-overall' };
      const orphans = ['images/news/mouse/best-overall'];
      assert.equal(findBestMatch(entry, orphans), null);
    });
  });
});
