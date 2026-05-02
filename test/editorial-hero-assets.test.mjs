import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

import { resolveHero } from '../src/core/article-helpers.ts';

const ROOT = process.cwd();
const CONTENT_ROOT = path.join(ROOT, 'src', 'content');
const EDITORIAL_COLLECTIONS = new Set(['reviews', 'guides', 'news', 'games']);

function heroDerivativePath(heroPath, size = 's') {
  return path.join(ROOT, 'public', heroPath.slice(1) + `_${size}.webp`);
}

function collectEditorialHeroEntries() {
  const entries = [];

  function walk(dir) {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(fullPath);
        continue;
      }
      if (!entry.isFile() || entry.name !== 'index.md') continue;

      const relDir = path.relative(CONTENT_ROOT, path.dirname(fullPath)).replace(/\\/g, '/');
      const [collection, ...rest] = relDir.split('/');
      if (!EDITORIAL_COLLECTIONS.has(collection)) continue;

      const source = readFileSync(fullPath, 'utf8');
      const hero = /^hero:\s*(.+)$/m.exec(source)?.[1]?.trim();
      if (!hero) continue;

      entries.push({
        collection,
        entryId: rest.join('/'),
        hero,
      });
    }
  }

  walk(CONTENT_ROOT);
  return entries;
}

describe('resolveHero asset contract', () => {
  it('keeps direct hero stems unchanged when the derivative already exists', () => {
    const heroPath = resolveHero('reviews', 'mouse/razer-viper-v3-pro-review', 'feature-image');
    assert.equal(
      heroPath,
      '/images/reviews/mouse/razer-viper-v3-pro-review/feature-image'
    );
    assert.equal(existsSync(heroDerivativePath(heroPath)), true);
  });

  it('falls back to a matching variant stem when the direct derivative is missing', () => {
    const heroPath = resolveHero('reviews', 'mouse/alienware-aw610m-review', 'feature-image');
    assert.equal(
      heroPath,
      '/images/reviews/mouse/alienware-aw610m-review/feature-image---white+black'
    );
    assert.equal(existsSync(heroDerivativePath(heroPath)), true);
  });

  it('resolves every editorial hero stem to a real small derivative', () => {
    const missing = collectEditorialHeroEntries()
      .map(({ collection, entryId, hero }) => {
        const heroPath = resolveHero(collection, entryId, hero);
        return {
          entry: `${collection}/${entryId}`,
          hero,
          heroPath,
          exists: existsSync(heroDerivativePath(heroPath)),
        };
      })
      .filter((entry) => !entry.exists);

    assert.deepEqual(missing, []);
  });
});
