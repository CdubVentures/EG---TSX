// test/build-pagination.test.mjs — Pagination builder unit tests
// RED phase: tests written before implementation.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { buildPagination } from '../src/features/site-index/build-pagination.mjs';

// ── Helpers ──────────────────────────────────────────────────────────────────
const pg = (opts) => buildPagination(opts);

// ── Contract ─────────────────────────────────────────────────────────────────
// buildPagination({ baseUrl: string, current: number, total: number })
// Returns: { pages[], prevUrl, nextUrl, total, current, baseUrl }
// pages[]: { num, url, active?, ellipsis? }

describe('buildPagination', () => {

  // ── Single page ──────────────────────────────────────────────────────────
  describe('single page (total=1)', () => {
    it('returns pages array with single active page', () => {
      const r = pg({ baseUrl: '/reviews', current: 1, total: 1 });
      assert.equal(r.pages.length, 1);
      assert.equal(r.pages[0].num, 1);
      assert.equal(r.pages[0].active, true);
    });

    it('has empty prevUrl and nextUrl', () => {
      const r = pg({ baseUrl: '/reviews', current: 1, total: 1 });
      assert.equal(r.prevUrl, '');
      assert.equal(r.nextUrl, '');
    });
  });

  // ── ≤7 pages — show all ──────────────────────────────────────────────────
  describe('≤7 pages — show all page numbers', () => {
    it('shows all 5 pages for total=5', () => {
      const r = pg({ baseUrl: '/reviews', current: 3, total: 5 });
      const nums = r.pages.map(p => p.num);
      assert.deepEqual(nums, [1, 2, 3, 4, 5]);
    });

    it('shows all 7 pages for total=7', () => {
      const r = pg({ baseUrl: '/reviews', current: 1, total: 7 });
      const nums = r.pages.map(p => p.num);
      assert.deepEqual(nums, [1, 2, 3, 4, 5, 6, 7]);
    });

    it('marks only current page as active', () => {
      const r = pg({ baseUrl: '/reviews', current: 3, total: 5 });
      const active = r.pages.filter(p => p.active);
      assert.equal(active.length, 1);
      assert.equal(active[0].num, 3);
    });
  });

  // ── >7 pages — ellipsis window ───────────────────────────────────────────
  describe('>7 pages — ellipsis window', () => {
    it('page 1 of 8: [1*, 2, …, 7, 8]', () => {
      const r = pg({ baseUrl: '/reviews', current: 1, total: 8 });
      const repr = r.pages.map(p => p.ellipsis ? '…' : p.num);
      assert.deepEqual(repr, [1, 2, '…', 7, 8]);
      assert.equal(r.pages[0].active, true);
    });

    it('page 4 of 8: [1, 2, 3, 4*, 5, …, 7, 8]', () => {
      const r = pg({ baseUrl: '/reviews', current: 4, total: 8 });
      const repr = r.pages.map(p => p.ellipsis ? '…' : p.num);
      assert.deepEqual(repr, [1, 2, 3, 4, 5, '…', 7, 8]);
      assert.equal(r.pages.find(p => p.num === 4).active, true);
    });

    it('page 8 of 8: [1, 2, …, 7, 8*]', () => {
      const r = pg({ baseUrl: '/reviews', current: 8, total: 8 });
      const repr = r.pages.map(p => p.ellipsis ? '…' : p.num);
      assert.deepEqual(repr, [1, 2, '…', 7, 8]);
      assert.equal(r.pages.find(p => p.num === 8).active, true);
    });

    it('page 5 of 10: [1, 2, …, 4, 5*, 6, …, 9, 10]', () => {
      const r = pg({ baseUrl: '/reviews', current: 5, total: 10 });
      const repr = r.pages.map(p => p.ellipsis ? '…' : p.num);
      assert.deepEqual(repr, [1, 2, '…', 4, 5, 6, '…', 9, 10]);
      assert.equal(r.pages.find(p => p.num === 5).active, true);
    });
  });

  // ── URL generation ───────────────────────────────────────────────────────
  describe('URL generation', () => {
    it('page 1 URL has no /page/1/ segment', () => {
      const r = pg({ baseUrl: '/reviews', current: 2, total: 5 });
      const p1 = r.pages.find(p => p.num === 1);
      assert.equal(p1.url, '/reviews/');
      assert.ok(!p1.url.includes('/page/'));
    });

    it('page 2+ URL uses /page/N/ format', () => {
      const r = pg({ baseUrl: '/reviews', current: 1, total: 5 });
      const p3 = r.pages.find(p => p.num === 3);
      assert.equal(p3.url, '/reviews/page/3/');
    });

    it('category baseUrl generates correct URLs', () => {
      const r = pg({ baseUrl: '/reviews/mice', current: 1, total: 3 });
      assert.equal(r.pages[0].url, '/reviews/mice/');
      assert.equal(r.pages[2].url, '/reviews/mice/page/3/');
    });

    it('ellipsis entries have empty url', () => {
      const r = pg({ baseUrl: '/reviews', current: 1, total: 8 });
      const ellipses = r.pages.filter(p => p.ellipsis);
      assert.ok(ellipses.length > 0);
      for (const e of ellipses) {
        assert.equal(e.url, '');
      }
    });
  });

  // ── prev/next URLs ───────────────────────────────────────────────────────
  describe('prev/next URLs', () => {
    it('page 1: prevUrl empty, nextUrl points to page 2', () => {
      const r = pg({ baseUrl: '/reviews', current: 1, total: 3 });
      assert.equal(r.prevUrl, '');
      assert.equal(r.nextUrl, '/reviews/page/2/');
    });

    it('page 2: prevUrl points to page 1 (no /page/1/)', () => {
      const r = pg({ baseUrl: '/reviews', current: 2, total: 3 });
      assert.equal(r.prevUrl, '/reviews/');
      assert.equal(r.nextUrl, '/reviews/page/3/');
    });

    it('last page: nextUrl empty', () => {
      const r = pg({ baseUrl: '/reviews', current: 3, total: 3 });
      assert.equal(r.prevUrl, '/reviews/page/2/');
      assert.equal(r.nextUrl, '');
    });
  });

  // ── Pass-through fields ──────────────────────────────────────────────────
  describe('pass-through fields', () => {
    it('returns total, current, baseUrl', () => {
      const r = pg({ baseUrl: '/news', current: 2, total: 5 });
      assert.equal(r.total, 5);
      assert.equal(r.current, 2);
      assert.equal(r.baseUrl, '/news');
    });
  });

  // ── Edge: trailing slash on baseUrl ──────────────────────────────────────
  describe('trailing slash handling', () => {
    it('strips trailing slash from baseUrl before building URLs', () => {
      const r = pg({ baseUrl: '/reviews/', current: 1, total: 3 });
      assert.equal(r.pages[0].url, '/reviews/');
      assert.equal(r.pages[2].url, '/reviews/page/3/');
    });
  });
});
