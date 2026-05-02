import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { resolveSlideshowDeal } from '../slideshow-deal.ts';

describe('resolveSlideshowDeal', () => {
  it('uses the explicit primary affiliate link when present', () => {
    const deal = resolveSlideshowDeal({
      brand: 'Corsair',
      model: 'Sabre v2 Pro',
      category: 'mouse',
      affiliateLinks: [
        {
          url: 'https://www.amazon.com/dp/B0PRIMARY',
          retailer: 'amazon',
          slug: 'amazon',
          variant: 'black',
          isPrimary: true,
        },
        {
          url: 'https://www.bestbuy.com/site/backup',
          retailer: 'bestbuy',
          slug: 'bestbuy',
          isPrimary: false,
        },
      ],
    });

    assert.deepEqual(deal, {
      kind: 'primary-affiliate',
      href: 'https://www.amazon.com/dp/B0PRIMARY',
      label: 'View Deal',
      retailer: 'amazon',
      slug: 'amazon',
      variant: 'black',
    });
  });

  it('falls back to the first valid explicit affiliate when no primary exists', () => {
    const deal = resolveSlideshowDeal({
      brand: 'Logitech G',
      model: 'Pro X Superlight 2c',
      category: 'mouse',
      affiliateLinks: [
        {
          url: 'not-a-url',
          retailer: 'amazon',
          slug: 'amazon',
        },
        {
          url: 'https://www.amazon.com/dp/B0FALLBACK',
          retailer: 'amazon',
          slug: 'amazon',
          variant: 'white',
        },
      ],
    });

    assert.deepEqual(deal, {
      kind: 'affiliate-fallback',
      href: 'https://www.amazon.com/dp/B0FALLBACK',
      label: 'View Deal',
      retailer: 'amazon',
      slug: 'amazon',
      variant: 'white',
    });
  });

  it('builds an honest Amazon search fallback when no valid affiliate link exists', () => {
    const deal = resolveSlideshowDeal({
      brand: 'Mountain',
      model: 'Everest 60',
      category: 'keyboard',
      affiliateLinks: [],
    });

    assert.equal(deal.kind, 'search-fallback');
    assert.equal(deal.label, 'Search Amazon');
    assert.equal(deal.retailer, 'amazon');
    assert.equal(deal.slug, 'amazon');
    assert.match(
      deal.href,
      /^https:\/\/www\.amazon\.com\/s\?k=Mountain\+Everest\+60\+keyboard&tag=eggear-20$/
    );
  });

  it('returns null when product identity is too incomplete to build any link', () => {
    const deal = resolveSlideshowDeal({
      brand: '',
      model: '',
      category: 'mouse',
      affiliateLinks: [],
    });

    assert.equal(deal, null);
  });
});
