import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const FEED_ITEM_PATH = new URL('../components/FeedItem.astro', import.meta.url);

describe('FeedItem.astro source contract', () => {
  it('adds a no-image modifier when hero media is missing', async () => {
    const source = await readFile(FEED_ITEM_PATH, 'utf8');

    assert.match(source, /const hasHero = Boolean\(item\.heroPath\);/);
    assert.match(source, /'feed-item--no-image': !hasHero/);
  });

  it('expands the content column to full width in the no-image state', async () => {
    const source = await readFile(FEED_ITEM_PATH, 'utf8');

    assert.match(source, /\.feed-item--no-image \.feed-item-content \{/);
    assert.match(source, /width: 100%;/);
  });
});
