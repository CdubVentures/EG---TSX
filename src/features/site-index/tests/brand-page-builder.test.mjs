import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  buildBrandStaticPaths,
  buildBrandBleedVm,
} from '../brand-page-builder.mjs';

function fakeBrand({
  id = 'razer',
  brand = 'Razer',
  displayName,
  categories,
  navbar = ['mouse', 'keyboard'],
} = {}) {
  return {
    id,
    data: {
      brand,
      displayName,
      categories: categories ?? navbar,
      navbar,
      publish: true,
    },
  };
}

const CATEGORIES = ['mouse', 'keyboard', 'monitor'];

describe('brand-page-builder', () => {
  describe('buildBrandStaticPaths()', () => {
    it('generates all-brands view + per-category views', () => {
      const brands = [
        fakeBrand({ id: 'razer', navbar: ['mouse', 'keyboard'] }),
        fakeBrand({ id: 'corsair', navbar: ['mouse'] }),
      ];
      const paths = buildBrandStaticPaths({ brands, categories: CATEGORIES, perPage: 24 });

      // all-view exists
      const allView = paths.find(p => p.params.slug === undefined);
      assert.ok(allView, 'all-brands path should exist');

      // mouse view exists (both brands)
      const mouseView = paths.find(p => p.params.slug === 'mouse');
      assert.ok(mouseView, 'mouse path should exist');

      // keyboard view exists (only razer)
      const kbView = paths.find(p => p.params.slug === 'keyboard');
      assert.ok(kbView, 'keyboard path should exist');

      // monitor view should NOT exist (no brands)
      const monView = paths.find(p => p.params.slug === 'monitor');
      assert.equal(monView, undefined, 'monitor path should not exist (no brands)');
    });

    it('brand with navbar: [mouse,keyboard] appears in both category paths', () => {
      const brands = [
        fakeBrand({ id: 'razer', navbar: ['mouse', 'keyboard'] }),
      ];
      const paths = buildBrandStaticPaths({ brands, categories: CATEGORIES, perPage: 24 });

      const mousePath = paths.find(p => p.params.slug === 'mouse');
      const kbPath = paths.find(p => p.params.slug === 'keyboard');

      assert.ok(mousePath);
      assert.ok(kbPath);
      assert.ok(mousePath.props.brands.some(b => b.id === 'razer'));
      assert.ok(kbPath.props.brands.some(b => b.id === 'razer'));
    });

    it('generates pagination for large brand counts', () => {
      // 30 brands in mouse → 2 pages at perPage=24
      const brands = Array.from({ length: 30 }, (_, i) =>
        fakeBrand({ id: `brand-${i}`, navbar: ['mouse'] })
      );
      const paths = buildBrandStaticPaths({ brands, categories: CATEGORIES, perPage: 24 });

      const mousePage1 = paths.find(p => p.params.slug === 'mouse');
      const mousePage2 = paths.find(p => p.params.slug === 'mouse/page/2');
      assert.ok(mousePage1);
      assert.ok(mousePage2);
    });
  });

  describe('buildBrandBleedVm()', () => {
    it('all-view breadcrumbs: Home > Brands', () => {
      const brands = [fakeBrand()];
      const vm = buildBrandBleedVm({
        brands,
        category: '',
        page: 1,
        categoryList: CATEGORIES,
        headerDek: 'Test dek',
        siteUrl: 'https://eggear.com',

      });
      assert.deepEqual(vm.breadcrumbs, [
        { label: 'Home', href: '/' },
        { label: 'Brands' },
      ]);
    });

    it('category-view breadcrumbs: Home > Brands > Mouse', () => {
      const brands = [fakeBrand()];
      const vm = buildBrandBleedVm({
        brands,
        category: 'mouse',
        page: 1,
        categoryList: CATEGORIES,
        headerDek: 'Test dek',
        siteUrl: 'https://eggear.com',

      });
      assert.deepEqual(vm.breadcrumbs, [
        { label: 'Home', href: '/' },
        { label: 'Brands', href: '/brands/' },
        { label: 'Mouse' },
      ]);
    });

    it('all-view heading: "Brands"', () => {
      const brands = [fakeBrand()];
      const vm = buildBrandBleedVm({
        brands,
        category: '',
        page: 1,
        categoryList: CATEGORIES,
        headerDek: 'Test dek',
        siteUrl: 'https://eggear.com',

      });
      assert.equal(vm.heading, 'Brands');
    });

    it('category-view heading: "Mouse Brands"', () => {
      const brands = [fakeBrand()];
      const vm = buildBrandBleedVm({
        brands,
        category: 'mouse',
        page: 1,
        categoryList: CATEGORIES,
        headerDek: 'Test dek',
        siteUrl: 'https://eggear.com',

      });
      assert.equal(vm.heading, 'Mouse Brands');
    });

    it('dashboard items populated for page 1', () => {
      const brands = Array.from({ length: 10 }, (_, i) =>
        fakeBrand({ id: `brand-${i}`, navbar: ['mouse'] })
      );
      const vm = buildBrandBleedVm({
        brands,
        category: '',
        page: 1,
        categoryList: CATEGORIES,
        headerDek: 'Test dek',
        siteUrl: 'https://eggear.com',

      });
      assert.ok(vm.brandDashboardItems.length > 0, 'page 1 should have dashboard items');
      assert.ok(vm.brandDashboardItems.length <= 6);
    });

    it('dashboard items empty for page 2+', () => {
      const brands = Array.from({ length: 10 }, (_, i) =>
        fakeBrand({ id: `brand-${i}`, navbar: ['mouse'] })
      );
      const vm = buildBrandBleedVm({
        brands,
        category: '',
        page: 2,
        categoryList: CATEGORIES,
        headerDek: 'Test dek',
        siteUrl: 'https://eggear.com',

      });
      assert.deepEqual(vm.brandDashboardItems, []);
    });

    it('passes through headerDek', () => {
      const vm = buildBrandBleedVm({
        brands: [fakeBrand()],
        category: '',
        page: 1,
        categoryList: CATEGORIES,
        headerDek: 'Browse gaming brands.',
        siteUrl: 'https://eggear.com',

      });
      assert.equal(vm.headerDek, 'Browse gaming brands.');
    });

    it('includes categoryClass for category view', () => {
      const vm = buildBrandBleedVm({
        brands: [fakeBrand()],
        category: 'mouse',
        page: 1,
        categoryList: CATEGORIES,
        headerDek: 'Test',
        siteUrl: 'https://eggear.com',

      });
      assert.equal(vm.categoryClass, 'mouse-color');
    });
  });
});
