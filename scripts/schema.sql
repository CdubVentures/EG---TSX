-- EG-TSX Search Database Schema
-- PostgreSQL 16+
-- Run: psql $DATABASE_URL < scripts/schema.sql

-- WHY 'simple' dictionary: 'english' stems words ("gaming" → "game"),
-- breaking exact brand/model matching. 'simple' tokenizes without stemming.

-- ─── Products ────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS products (
  id          TEXT PRIMARY KEY,       -- Astro entry.id (e.g. "razer-viper-v3-pro")
  slug        TEXT NOT NULL,
  brand       TEXT NOT NULL,
  model       TEXT NOT NULL,
  base_model  TEXT NOT NULL,
  variant     TEXT NOT NULL DEFAULT '',
  category    TEXT NOT NULL,
  image_path  TEXT NOT NULL,
  media       JSONB NOT NULL,         -- structured media object
  specs       JSONB NOT NULL,         -- all spec/score fields (passthrough)
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

-- ─── Articles ────────────────────────────────────────────────────────────────
-- reviews, guides, news, brands, games

CREATE TABLE IF NOT EXISTS articles (
  id              TEXT NOT NULL,
  collection      TEXT NOT NULL,       -- 'reviews','guides','news','brands','games'
  title           TEXT NOT NULL,
  description     TEXT,
  category        TEXT,
  hero            TEXT,                -- hero stem for image resolution
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
