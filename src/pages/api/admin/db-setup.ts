/** POST /api/admin/db-setup — Create database tables (schema DDL). */

import type { APIRoute } from 'astro';
import { pool } from '@core/db';
import { jsonNoIndex } from '@core/seo/indexation-policy';

export const prerender = false;

// WHY: Simple token gate — prevents accidental public access.
// Not a security boundary (no secrets in the schema), just an operator guard.
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || 'eg-setup-2026';

const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS products (
  id          TEXT PRIMARY KEY,
  slug        TEXT NOT NULL,
  brand       TEXT NOT NULL,
  model       TEXT NOT NULL,
  base_model  TEXT NOT NULL,
  variant     TEXT NOT NULL DEFAULT '',
  category    TEXT NOT NULL,
  image_path  TEXT NOT NULL,
  media       JSONB NOT NULL,
  specs       JSONB NOT NULL,
  search_vec  tsvector GENERATED ALWAYS AS (
    setweight(to_tsvector('simple', brand), 'A') ||
    setweight(to_tsvector('simple', model), 'A') ||
    setweight(to_tsvector('simple', coalesce(base_model, '')), 'B') ||
    setweight(to_tsvector('simple', coalesce(variant, '')), 'B')
  ) STORED,
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);
CREATE INDEX IF NOT EXISTS idx_products_search ON products USING GIN(search_vec);
CREATE INDEX IF NOT EXISTS idx_products_specs ON products USING GIN(specs jsonb_path_ops);

CREATE TABLE IF NOT EXISTS articles (
  id              TEXT NOT NULL,
  collection      TEXT NOT NULL,
  title           TEXT NOT NULL,
  description     TEXT,
  category        TEXT,
  hero            TEXT,
  brand           TEXT,
  model           TEXT,
  tags            TEXT[],
  date_published  TIMESTAMPTZ,
  date_updated    TIMESTAMPTZ,
  search_vec      tsvector GENERATED ALWAYS AS (
    setweight(to_tsvector('simple', title), 'A') ||
    setweight(to_tsvector('simple', coalesce(brand, '')), 'A') ||
    setweight(to_tsvector('simple', coalesce(model, '')), 'A') ||
    setweight(to_tsvector('simple', coalesce(description, '')), 'B')
  ) STORED,
  updated_at      TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (id, collection)
);

CREATE INDEX IF NOT EXISTS idx_articles_collection ON articles(collection);
CREATE INDEX IF NOT EXISTS idx_articles_search ON articles USING GIN(search_vec);
`;

export const POST: APIRoute = async ({ request }) => {
  const auth = request.headers.get('x-admin-token');
  if (auth !== ADMIN_TOKEN) {
    return jsonNoIndex({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    await pool.query(SCHEMA_SQL);

    // Verify tables exist
    const tables = await pool.query(`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name IN ('products', 'articles')
      ORDER BY table_name
    `);

    return jsonNoIndex({
      status: 'ok',
      tables: tables.rows.map(r => r.table_name),
      message: 'Schema applied successfully',
    });
  } catch (err) {
    console.error('[db-setup] Error:', err);
    return jsonNoIndex(
      { error: 'Schema setup failed', detail: (err as Error).message },
      { status: 500 },
    );
  }
};
