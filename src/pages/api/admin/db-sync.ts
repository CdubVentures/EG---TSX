/** POST /api/admin/db-sync — Upsert products + articles into the search DB. */

import type { APIRoute } from 'astro';
import { pool } from '@core/db';
import { jsonNoIndex } from '@core/seo/indexation-policy';

export const prerender = false;

const ADMIN_TOKEN = process.env.ADMIN_TOKEN || 'eg-setup-2026';

const PRODUCT_UPSERT = `
  INSERT INTO products (id, slug, brand, model, base_model, variant, category, image_path, media, specs, updated_at)
  VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW())
  ON CONFLICT (id) DO UPDATE SET
    slug = EXCLUDED.slug, brand = EXCLUDED.brand, model = EXCLUDED.model,
    base_model = EXCLUDED.base_model, variant = EXCLUDED.variant,
    category = EXCLUDED.category, image_path = EXCLUDED.image_path,
    media = EXCLUDED.media, specs = EXCLUDED.specs, updated_at = NOW()
`;

const ARTICLE_UPSERT = `
  INSERT INTO articles (id, collection, title, description, category, hero, brand, model, tags, date_published, date_updated, updated_at)
  VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW())
  ON CONFLICT (id, collection) DO UPDATE SET
    title = EXCLUDED.title, description = EXCLUDED.description,
    category = EXCLUDED.category, hero = EXCLUDED.hero,
    brand = EXCLUDED.brand, model = EXCLUDED.model, tags = EXCLUDED.tags,
    date_published = EXCLUDED.date_published, date_updated = EXCLUDED.date_updated,
    updated_at = NOW()
`;

export const POST: APIRoute = async ({ request }) => {
  const auth = request.headers.get('x-admin-token');
  if (auth !== ADMIN_TOKEN) {
    return jsonNoIndex({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: { products?: unknown[]; articles?: unknown[] };
  try {
    body = await request.json();
  } catch {
    return jsonNoIndex({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    let productCount = 0;
    if (Array.isArray(body.products)) {
      for (const p of body.products as Record<string, unknown>[]) {
        await client.query(PRODUCT_UPSERT, [
          p.id, p.slug, p.brand, p.model, p.base_model, p.variant,
          p.category, p.image_path, JSON.stringify(p.media), JSON.stringify(p.specs),
        ]);
        productCount++;
      }
    }

    let articleCount = 0;
    if (Array.isArray(body.articles)) {
      for (const a of body.articles as Record<string, unknown>[]) {
        await client.query(ARTICLE_UPSERT, [
          a.id, a.collection, a.title, a.description, a.category,
          a.hero, a.brand, a.model, a.tags,
          a.date_published, a.date_updated,
        ]);
        articleCount++;
      }
    }

    await client.query('COMMIT');
    return jsonNoIndex({
      status: 'ok',
      products: productCount,
      articles: articleCount,
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[db-sync] Error:', err);
    return jsonNoIndex(
      { error: 'Sync failed', detail: (err as Error).message },
      { status: 500 },
    );
  } finally {
    client.release();
  }
};
