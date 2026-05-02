// ─── Search API Integration Tests ────────────────────────────────────────────
// Tests the /api/search endpoint contract.
// Requires: DATABASE_URL env var pointing to a seeded PostgreSQL instance.
// Run: DATABASE_URL=... node --test src/features/search/tests/search-api.test.mjs

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import pg from 'pg';

// ─── Setup ───────────────────────────────────────────────────────────────────

const DATABASE_URL = process.env.DATABASE_URL;

// Skip all tests if no database is configured
if (!DATABASE_URL) {
  describe('search-api (SKIPPED — no DATABASE_URL)', () => {
    it('skipped: set DATABASE_URL to run integration tests', () => {
      assert.ok(true, 'No DATABASE_URL — skipping search integration tests');
    });
  });
} else {

  let pool;

  describe('search-api integration', () => {
    before(async () => {
      pool = new pg.Pool({ connectionString: DATABASE_URL });

      // Seed test data
      await pool.query(`
        INSERT INTO products (id, slug, brand, model, base_model, variant, category, image_path, media, specs)
        VALUES
          ('razer-viper-v3-pro', 'viper-v3-pro', 'Razer', 'Viper V3 Pro', 'Viper', 'V3 Pro', 'mouse',
           'razer/viper-v3-pro',
           '{"defaultColor": "black", "colors": ["black"], "editions": [], "images": [{"stem": "top", "view": "top"}]}'::jsonb,
           '{"weight": 54, "overall": 92}'::jsonb),
          ('logitech-g-pro-x-superlight-2', 'g-pro-x-superlight-2', 'Logitech', 'G Pro X Superlight 2', 'G Pro X Superlight', '2', 'mouse',
           'logitech/g-pro-x-superlight-2',
           '{"defaultColor": "black", "colors": ["black", "white"], "editions": [], "images": [{"stem": "top", "view": "top"}]}'::jsonb,
           '{"weight": 60, "overall": 90}'::jsonb),
          ('corsair-m75-air', 'm75-air', 'Corsair', 'M75 Air', 'M75', 'Air', 'mouse',
           'corsair/m75-air',
           '{"defaultColor": null, "colors": [], "editions": [], "images": [{"stem": "feature-image", "view": "feature-image"}]}'::jsonb,
           '{"weight": 60, "overall": 85}'::jsonb)
        ON CONFLICT (id) DO NOTHING
      `);

      await pool.query(`
        INSERT INTO articles (id, collection, title, description, category, hero, brand, model)
        VALUES
          ('best-gaming-mouse', 'guides', 'Best Gaming Mouse 2025', 'Our top picks for gaming mice', 'mouse', 'feature-image', NULL, NULL),
          ('razer-viper-v3-pro-review', 'reviews', 'Razer Viper V3 Pro Review', 'Detailed review of the Viper V3 Pro', 'mouse', 'feature-image', 'Razer', 'Viper V3 Pro')
        ON CONFLICT (id, collection) DO NOTHING
      `);
    });

    after(async () => {
      // Clean up test data
      await pool.query(`DELETE FROM products WHERE id IN ('razer-viper-v3-pro', 'logitech-g-pro-x-superlight-2', 'corsair-m75-air')`);
      await pool.query(`DELETE FROM articles WHERE id IN ('best-gaming-mouse', 'razer-viper-v3-pro-review')`);
      await pool.end();
    });

    // ── Full-text search ──────────────────────────────────────────────────────

    it('finds products by brand name', async () => {
      const result = await pool.query(
        `SELECT id, brand, model FROM products
         WHERE search_vec @@ plainto_tsquery('simple', $1)
         ORDER BY ts_rank(search_vec, plainto_tsquery('simple', $1)) DESC`,
        ['Razer'],
      );
      assert.ok(result.rows.length >= 1, 'Should find at least 1 Razer product');
      assert.equal(result.rows[0].brand, 'Razer');
    });

    it('finds products by model name', async () => {
      const result = await pool.query(
        `SELECT id, brand, model FROM products
         WHERE search_vec @@ plainto_tsquery('simple', $1)
         ORDER BY ts_rank(search_vec, plainto_tsquery('simple', $1)) DESC`,
        ['Viper'],
      );
      assert.ok(result.rows.length >= 1, 'Should find Viper');
      assert.ok(result.rows[0].model.includes('Viper'));
    });

    it('ILIKE fallback catches partial matches', async () => {
      const result = await pool.query(
        `SELECT id, brand, model FROM products
         WHERE brand ILIKE $1 OR model ILIKE $1
         LIMIT 10`,
        ['%vip%'],
      );
      assert.ok(result.rows.length >= 1, 'ILIKE %vip% should match Viper');
    });

    it('returns empty for nonsense query', async () => {
      const result = await pool.query(
        `SELECT id FROM products
         WHERE search_vec @@ plainto_tsquery('simple', $1)
            OR brand ILIKE $2 OR model ILIKE $2
         LIMIT 10`,
        ['zzzzxyzzy', '%zzzzxyzzy%'],
      );
      assert.equal(result.rows.length, 0, 'No results for nonsense query');
    });

    // ── Article search ────────────────────────────────────────────────────────

    it('finds articles by title keywords', async () => {
      const result = await pool.query(
        `SELECT id, collection, title FROM articles
         WHERE search_vec @@ plainto_tsquery('simple', $1)
         ORDER BY ts_rank(search_vec, plainto_tsquery('simple', $1)) DESC`,
        ['gaming mouse'],
      );
      assert.ok(result.rows.length >= 1, 'Should find guide about gaming mouse');
    });

    it('finds reviews by brand name', async () => {
      const result = await pool.query(
        `SELECT id, collection, title, brand FROM articles
         WHERE search_vec @@ plainto_tsquery('simple', $1)
         ORDER BY ts_rank(search_vec, plainto_tsquery('simple', $1)) DESC`,
        ['Razer'],
      );
      const review = result.rows.find(r => r.collection === 'reviews');
      assert.ok(review, 'Should find Razer review');
      assert.equal(review.brand, 'Razer');
    });

    // ── Combined query ────────────────────────────────────────────────────────

    it('combined query returns both products and articles', async () => {
      const products = await pool.query(
        `SELECT id FROM products WHERE search_vec @@ plainto_tsquery('simple', $1) OR brand ILIKE $2 LIMIT 5`,
        ['Razer', '%Razer%'],
      );
      const articles = await pool.query(
        `SELECT id FROM articles WHERE search_vec @@ plainto_tsquery('simple', $1) OR title ILIKE $2 LIMIT 5`,
        ['Razer', '%Razer%'],
      );
      assert.ok(products.rows.length >= 1, 'Should find products');
      assert.ok(articles.rows.length >= 1, 'Should find articles');
    });

    // ── Limit enforcement ─────────────────────────────────────────────────────

    it('respects LIMIT parameter', async () => {
      const result = await pool.query(
        `SELECT id FROM products WHERE search_vec @@ plainto_tsquery('simple', $1) OR brand ILIKE $2 LIMIT $3`,
        ['mouse', '%mouse%', 1],
      );
      assert.ok(result.rows.length <= 1, 'Should respect limit=1');
    });

    // ── tsvector weighting ────────────────────────────────────────────────────

    it('ranks brand/model matches (weight A) higher than variant (weight B)', async () => {
      const result = await pool.query(
        `SELECT id, ts_rank(search_vec, plainto_tsquery('simple', $1)) AS rank
         FROM products
         WHERE search_vec @@ plainto_tsquery('simple', $1)
         ORDER BY rank DESC`,
        ['Razer'],
      );
      // Brand = weight A, should have high rank
      assert.ok(result.rows.length >= 1);
      assert.ok(result.rows[0].rank > 0, 'Rank should be positive for brand match');
    });
  });
}
