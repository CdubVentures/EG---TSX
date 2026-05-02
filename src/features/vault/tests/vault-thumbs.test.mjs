import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

let importCounter = 0;

async function freshThumbs() {
  importCounter++;
  return import(`../thumbs.ts?test=${importCounter}`);
}

function makeEntry(overrides = {}) {
  return {
    productId: 'mouse/alienware/aw610m',
    category: 'mouse',
    product: {
      id: 'mouse/alienware/aw610m',
      slug: 'aw610m',
      brand: 'Alienware',
      model: 'AW610M',
      category: 'mouse',
      imagePath: '/images/mouse/alienware/aw610m',
      thumbnailStem: '',
    },
    addedAt: 1700000000000,
    ...overrides,
  };
}

describe('vault thumbs helpers', () => {
  it('buildThumbResolveRequest dedupes request ids', async () => {
    const { buildThumbResolveRequest } = await freshThumbs();
    const first = makeEntry();
    const second = makeEntry({ addedAt: 1700000000001 });
    const third = makeEntry({
      productId: 'alienware-aw720m',
      product: {
        ...makeEntry().product,
        id: 'alienware-aw720m',
        slug: 'aw720m',
      },
    });

    const request = buildThumbResolveRequest([first, second, third]);
    assert.equal(request.items.length, 2);
    assert.deepStrictEqual(request.items[0], { requestId: 'mouse/alienware/aw610m', category: 'mouse' });
    assert.deepStrictEqual(request.items[1], { requestId: 'alienware-aw720m', category: 'mouse' });
  });

  it('shouldRefreshThumbCache applies TTL', async () => {
    const { VAULT_THUMB_REFRESH_TTL_MS, shouldRefreshThumbCache } = await freshThumbs();
    const now = 1_000_000;
    assert.equal(shouldRefreshThumbCache(0, now), true);
    assert.equal(shouldRefreshThumbCache(now - 5_000, now), false);
    assert.equal(shouldRefreshThumbCache(now - VAULT_THUMB_REFRESH_TTL_MS, now), true);
  });

  it('applyThumbResolveResult updates product snapshot and canonical identity', async () => {
    const { applyThumbResolveResult } = await freshThumbs();
    const entry = makeEntry();
    const result = applyThumbResolveResult([entry], [
      {
        requestId: 'mouse/alienware/aw610m',
        productId: 'alienware-aw610m',
        category: 'mouse',
        slug: 'aw610m',
        brand: 'Alienware',
        model: 'AW610M',
        imagePath: '/images/mouse/alienware/aw610m',
        thumbnailStem: 'top---white+black',
      },
    ]);

    assert.equal(result.changed, true);
    assert.equal(result.entries.length, 1);
    assert.equal(result.entries[0].productId, 'alienware-aw610m');
    assert.equal(result.entries[0].product.id, 'alienware-aw610m');
    assert.equal(result.entries[0].product.thumbnailStem, 'top---white+black');
  });

  it('applyThumbResolveResult keeps state unchanged when no matches resolve', async () => {
    const { applyThumbResolveResult } = await freshThumbs();
    const entry = makeEntry({ product: { ...makeEntry().product, thumbnailStem: 'top---white+black' } });
    const result = applyThumbResolveResult([entry], []);

    assert.equal(result.changed, false);
    assert.equal(result.entries[0].product.thumbnailStem, 'top---white+black');
  });
});
