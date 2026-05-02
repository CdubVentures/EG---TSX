import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  packBrand,
  brandLogoSrcSet,
  buildBrandCategoryCounts,
  buildBrandFilterCategories,
} from '../brand-helpers.mjs';

function fakeBrandEntry({
  id = 'razer',
  brand = 'Razer',
  displayName,
  categories,
  navbar = ['mouse', 'keyboard'],
  iDashboard,
  iFilteredDashboard,
  logoStyle,
} = {}) {
  return {
    id,
    data: {
      brand,
      displayName,
      categories: categories ?? navbar,
      navbar,
      iDashboard,
      iFilteredDashboard,
      logoStyle,
    },
  };
}

describe('brand-helpers', () => {
  describe('packBrand()', () => {
    it('uses displayName when available', () => {
      const entry = fakeBrandEntry({ displayName: 'Razer Inc.' });
      const result = packBrand(entry);
      assert.equal(result.name, 'Razer Inc.');
    });

    it('falls back to brand when displayName is missing', () => {
      const entry = fakeBrandEntry({ displayName: undefined });
      const result = packBrand(entry);
      assert.equal(result.name, 'Razer');
    });

    it('produces correct url: /brands/{slug}/', () => {
      const entry = fakeBrandEntry({ id: 'logitech-g' });
      const result = packBrand(entry);
      assert.equal(result.url, '/brands/logitech-g/');
    });

    it('produces correct logoBase', () => {
      const entry = fakeBrandEntry({ id: 'corsair' });
      const result = packBrand(entry);
      assert.equal(result.logoBase, '/images/brands/corsair/brand-logo-horizontal-index');
    });

    it('produces correct logoBaseLight using primary variant', () => {
      const entry = fakeBrandEntry({ id: 'corsair' });
      const result = packBrand(entry);
      assert.equal(result.logoBaseLight, '/images/brands/corsair/brand-logo-horizontal-primary');
    });

    it('passes through categories array', () => {
      const entry = fakeBrandEntry({ categories: ['mouse', 'keyboard', 'monitor'], navbar: ['mouse', 'keyboard', 'monitor'] });
      const result = packBrand(entry);
      assert.deepEqual(result.categories, ['mouse', 'keyboard', 'monitor']);
    });

    it('passes through navbar array', () => {
      const entry = fakeBrandEntry({ navbar: ['mouse', 'keyboard', 'monitor'] });
      const result = packBrand(entry);
      assert.deepEqual(result.navbar, ['mouse', 'keyboard', 'monitor']);
    });

    it('passes through iDashboard', () => {
      const entry = fakeBrandEntry({ iDashboard: 'all_1' });
      const result = packBrand(entry);
      assert.equal(result.iDashboard, 'all_1');
    });

    it('passes through iFilteredDashboard', () => {
      const entry = fakeBrandEntry({ iFilteredDashboard: 'mouse_3' });
      const result = packBrand(entry);
      assert.equal(result.iFilteredDashboard, 'mouse_3');
    });

    it('includes slug from entry.id', () => {
      const entry = fakeBrandEntry({ id: 'endgame-gear' });
      const result = packBrand(entry);
      assert.equal(result.slug, 'endgame-gear');
    });
  });

  describe('brandLogoSrcSet()', () => {
    it('produces 7-size PNG srcset with correct widths', () => {
      const srcset = brandLogoSrcSet('/images/brands/razer/brand-logo-horizontal-index');
      const parts = srcset.split(', ');
      assert.equal(parts.length, 7);
      assert.ok(parts[0].endsWith('_xxs.png 100w'));
      assert.ok(parts[1].endsWith('_xs.png 150w'));
      assert.ok(parts[2].endsWith('_s.png 200w'));
      assert.ok(parts[3].endsWith('_m.png 250w'));
      assert.ok(parts[4].endsWith('_l.png 300w'));
      assert.ok(parts[5].endsWith('_xl.png 400w'));
      assert.ok(parts[6].endsWith('_xxl.png 500w'));
    });

    it('uses the logoBase as path prefix', () => {
      const srcset = brandLogoSrcSet('/images/brands/corsair/brand-logo-horizontal-index');
      assert.ok(srcset.includes('/images/brands/corsair/brand-logo-horizontal-index_s.png'));
    });
  });

  describe('buildBrandCategoryCounts()', () => {
    it('counts a brand in every category it spans via categories', () => {
      const brands = [
        { categories: ['mouse', 'keyboard'] },
        { categories: ['mouse'] },
      ];
      const counts = buildBrandCategoryCounts(brands, ['mouse', 'keyboard', 'monitor']);
      assert.equal(counts.get('mouse'), 2);
      assert.equal(counts.get('keyboard'), 1);
      assert.equal(counts.get('monitor'), 0);
    });

    it('returns zeroes for categories with no brands', () => {
      const counts = buildBrandCategoryCounts([], ['mouse']);
      assert.equal(counts.get('mouse'), 0);
    });
  });

  describe('buildBrandFilterCategories()', () => {
    it('produces correct FilterCategory[] with active flag', () => {
      const brands = [
        { categories: ['mouse', 'keyboard'] },
        { categories: ['mouse'] },
      ];
      const cats = buildBrandFilterCategories(brands, ['mouse', 'keyboard', 'monitor'], 'mouse');
      const mouseFilter = cats.find(c => c.key === 'mouse');
      const kbFilter = cats.find(c => c.key === 'keyboard');
      assert.ok(mouseFilter);
      assert.equal(mouseFilter.active, true);
      assert.equal(mouseFilter.count, 2);
      assert.equal(mouseFilter.url, '/brands/mouse/');
      assert.ok(kbFilter);
      assert.equal(kbFilter.active, false);
      assert.equal(kbFilter.count, 1);
    });

    it('excludes categories with zero brands', () => {
      const brands = [{ categories: ['mouse'] }];
      const cats = buildBrandFilterCategories(brands, ['mouse', 'keyboard'], '');
      assert.equal(cats.length, 1);
      assert.equal(cats[0].key, 'mouse');
    });

    it('no active category — all flags false', () => {
      const brands = [{ categories: ['mouse'] }];
      const cats = buildBrandFilterCategories(brands, ['mouse'], '');
      assert.equal(cats[0].active, false);
    });
  });
});
