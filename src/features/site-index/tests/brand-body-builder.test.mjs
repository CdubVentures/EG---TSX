import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { buildBrandBodyVm } from '../brand-page-builder.mjs';

// ─── Factories ──────────────────────────────────────────────────────────────

function fakeBrandTile({
  slug = 'razer',
  name = 'Razer',
  url = '/brands/razer/',
  categories,
  navbar = ['mouse', 'keyboard'],
} = {}) {
  return {
    slug,
    name,
    url,
    logoBase: `/images/brands/${slug}/brand-logo-horizontal-index`,
    logoBaseLight: `/images/brands/${slug}/brand-logo-horizontal-primary`,
    categories: categories ?? navbar,
    navbar,
  };
}

const CATEGORIES = ['mouse', 'keyboard', 'monitor'];

function makeFilterCategories(activeCategory = '') {
  return CATEGORIES.map(key => ({
    key,
    label: key.charAt(0).toUpperCase() + key.slice(1),
    url: `/brands/${key}/`,
    count: 10,
    active: key === activeCategory,
  }));
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('buildBrandBodyVm()', () => {
  it('sorts brands A-Z by name (case-insensitive)', () => {
    const brands = [
      fakeBrandTile({ slug: 'zowie', name: 'Zowie' }),
      fakeBrandTile({ slug: 'corsair', name: 'Corsair' }),
      fakeBrandTile({ slug: 'razer', name: 'Razer' }),
      fakeBrandTile({ slug: 'artisan', name: 'Artisan' }),
    ];
    const vm = buildBrandBodyVm({
      brands,
      page: 1,
      perPage: 24,
      category: '',
      filterCategories: makeFilterCategories(),
    });
    const names = vm.pageItems.map(b => b.name);
    assert.deepEqual(names, ['Artisan', 'Corsair', 'Razer', 'Zowie']);
  });

  it('pagination: 29 brands / perPage=24 → page 1 has 24, page 2 has 5', () => {
    const brands = Array.from({ length: 29 }, (_, i) =>
      fakeBrandTile({ slug: `brand-${String(i).padStart(2, '0')}`, name: `Brand ${String.fromCharCode(65 + i)}` })
    );
    const vm1 = buildBrandBodyVm({
      brands,
      page: 1,
      perPage: 24,
      category: '',
      filterCategories: makeFilterCategories(),
    });
    assert.equal(vm1.pageItems.length, 24);
    assert.equal(vm1.allCount, 29);

    const vm2 = buildBrandBodyVm({
      brands,
      page: 2,
      perPage: 24,
      category: '',
      filterCategories: makeFilterCategories(),
    });
    assert.equal(vm2.pageItems.length, 5);
    assert.equal(vm2.allCount, 29);
  });

  it('pagination data has correct total and current', () => {
    const brands = Array.from({ length: 29 }, (_, i) =>
      fakeBrandTile({ slug: `brand-${i}`, name: `Brand ${i}` })
    );
    const vm = buildBrandBodyVm({
      brands,
      page: 1,
      perPage: 24,
      category: '',
      filterCategories: makeFilterCategories(),
    });
    assert.equal(vm.pagination.total, 2);
    assert.equal(vm.pagination.current, 1);
    assert.equal(vm.pagination.baseUrl, '/brands');
  });

  it('pagination baseUrl includes category when filtered', () => {
    const brands = Array.from({ length: 5 }, (_, i) =>
      fakeBrandTile({ slug: `brand-${i}`, name: `Brand ${i}` })
    );
    const vm = buildBrandBodyVm({
      brands,
      page: 1,
      perPage: 24,
      category: 'mouse',
      filterCategories: makeFilterCategories('mouse'),
    });
    assert.equal(vm.pagination.baseUrl, '/brands/mouse');
  });

  it('heading: "All Brands" for all-view', () => {
    const vm = buildBrandBodyVm({
      brands: [fakeBrandTile()],
      page: 1,
      perPage: 24,
      category: '',
      filterCategories: makeFilterCategories(),
    });
    assert.equal(vm.heading, 'All Brands');
  });

  it('heading: "Mouse Brands" for category view', () => {
    const vm = buildBrandBodyVm({
      brands: [fakeBrandTile()],
      page: 1,
      perPage: 24,
      category: 'mouse',
      filterCategories: makeFilterCategories('mouse'),
    });
    assert.equal(vm.heading, 'Mouse Brands');
  });

  it('no dedup — all brands present including dashboard ones', () => {
    const brands = [
      fakeBrandTile({ slug: 'razer', name: 'Razer' }),
      fakeBrandTile({ slug: 'logitech', name: 'Logitech' }),
    ];
    const vm = buildBrandBodyVm({
      brands,
      page: 1,
      perPage: 24,
      category: '',
      filterCategories: makeFilterCategories(),
    });
    assert.equal(vm.pageItems.length, 2);
    assert.ok(vm.pageItems.some(b => b.slug === 'razer'));
    assert.ok(vm.pageItems.some(b => b.slug === 'logitech'));
  });

  it('activeCategory is undefined for all-view', () => {
    const vm = buildBrandBodyVm({
      brands: [fakeBrandTile()],
      page: 1,
      perPage: 24,
      category: '',
      filterCategories: makeFilterCategories(),
    });
    assert.equal(vm.activeCategory, undefined);
  });

  it('activeCategory is set for category view', () => {
    const vm = buildBrandBodyVm({
      brands: [fakeBrandTile()],
      page: 1,
      perPage: 24,
      category: 'mouse',
      filterCategories: makeFilterCategories('mouse'),
    });
    assert.equal(vm.activeCategory, 'mouse');
  });

  it('categoryClass is "mouse-color" for mouse', () => {
    const vm = buildBrandBodyVm({
      brands: [fakeBrandTile()],
      page: 1,
      perPage: 24,
      category: 'mouse',
      filterCategories: makeFilterCategories('mouse'),
    });
    assert.equal(vm.categoryClass, 'mouse-color');
  });

  it('categoryClass is undefined for all-view', () => {
    const vm = buildBrandBodyVm({
      brands: [fakeBrandTile()],
      page: 1,
      perPage: 24,
      category: '',
      filterCategories: makeFilterCategories(),
    });
    assert.equal(vm.categoryClass, undefined);
  });

  it('filterCategories passed through', () => {
    const cats = makeFilterCategories('mouse');
    const vm = buildBrandBodyVm({
      brands: [fakeBrandTile()],
      page: 1,
      perPage: 24,
      category: 'mouse',
      filterCategories: cats,
    });
    assert.deepEqual(vm.filterCategories, cats);
  });

  it('type is always "brands"', () => {
    const vm = buildBrandBodyVm({
      brands: [fakeBrandTile()],
      page: 1,
      perPage: 24,
      category: '',
      filterCategories: makeFilterCategories(),
    });
    assert.equal(vm.type, 'brands');
  });

  it('typeLabel is always "Brands"', () => {
    const vm = buildBrandBodyVm({
      brands: [fakeBrandTile()],
      page: 1,
      perPage: 24,
      category: '',
      filterCategories: makeFilterCategories(),
    });
    assert.equal(vm.typeLabel, 'Brands');
  });

  it('single page → pagination.total = 1', () => {
    const brands = Array.from({ length: 5 }, (_, i) =>
      fakeBrandTile({ slug: `brand-${i}`, name: `Brand ${i}` })
    );
    const vm = buildBrandBodyVm({
      brands,
      page: 1,
      perPage: 24,
      category: '',
      filterCategories: makeFilterCategories(),
    });
    assert.equal(vm.pagination.total, 1);
  });

  it('empty brands → 0 pageItems, allCount = 0', () => {
    const vm = buildBrandBodyVm({
      brands: [],
      page: 1,
      perPage: 24,
      category: '',
      filterCategories: makeFilterCategories(),
    });
    assert.equal(vm.pageItems.length, 0);
    assert.equal(vm.allCount, 0);
  });
});
