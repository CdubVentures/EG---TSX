import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { filterArticles, filterNavbarEntries } from '../content-filter.mjs';

function entry(id, data) {
  return {
    data,
    id,
  };
}

describe('core/content-filter', () => {
  describe('filterArticles', () => {
    it('excludes unpublished, draft, and disabled-category entries', () => {
      const entries = [
        entry('published-review', {
          category: 'mouse',
          datePublished: new Date('2025-01-03T00:00:00Z'),
          draft: false,
          publish: true,
        }),
        entry('draft-review', {
          category: 'mouse',
          datePublished: new Date('2025-01-04T00:00:00Z'),
          draft: true,
          publish: true,
        }),
        entry('hidden-review', {
          category: 'mouse',
          datePublished: new Date('2025-01-05T00:00:00Z'),
          draft: false,
          publish: false,
        }),
        entry('disabled-category', {
          category: 'controller',
          datePublished: new Date('2025-01-06T00:00:00Z'),
          draft: false,
          publish: true,
        }),
      ];

      assert.deepEqual(
        filterArticles(entries, ['mouse']).map((article) => article.id),
        ['published-review']
      );
    });
  });

  describe('filterNavbarEntries', () => {
    it('applies the shared visibility rules before navbar inclusion', () => {
      const entries = [
        entry('visible-game', {
          category: 'mouse',
          draft: false,
          navbar: true,
          publish: true,
        }),
        entry('draft-game', {
          category: 'mouse',
          draft: true,
          navbar: true,
          publish: true,
        }),
        entry('hidden-game', {
          category: 'mouse',
          draft: false,
          navbar: true,
          publish: false,
        }),
        entry('disabled-guide', {
          category: 'keyboard',
          draft: false,
          navbar: ['Best'],
          publish: true,
        }),
        entry('no-navbar', {
          category: 'mouse',
          draft: false,
          navbar: [],
          publish: true,
        }),
      ];

      assert.deepEqual(
        filterNavbarEntries(entries, ['mouse']).map((article) => article.id),
        ['visible-game']
      );
    });

    it('accepts array-based navbar assignments for category-grouped menus', () => {
      const entries = [
        entry('brand-with-navbar', {
          brand: 'Razer',
          navbar: ['mouse'],
          publish: true,
        }),
        entry('brand-without-navbar', {
          brand: 'Hidden',
          navbar: [],
          publish: true,
        }),
      ];

      assert.deepEqual(
        filterNavbarEntries(entries, ['mouse']).map((article) => article.id),
        ['brand-with-navbar']
      );
    });
  });
});
