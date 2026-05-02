#!/usr/bin/env node
// ─── sync-db.mjs — Sync product JSON + article frontmatter → PostgreSQL ─────
// Run: node scripts/sync-db.mjs --full
// Run: node scripts/sync-db.mjs --incremental (default)
//
// Reads product JSON from src/content/data-products/{category}/{brand}/{slug}.json
// Reads article frontmatter from src/content/{collection}/{slug}/index.{md,mdx}
// Upserts into PostgreSQL using INSERT ... ON CONFLICT DO UPDATE.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import matter from 'gray-matter';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

// ─── Config ──────────────────────────────────────────────────────────────────

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('[sync-db] DATABASE_URL not set. Add it to .env');
  process.exit(1);
}

const PRODUCTS_DIR = path.join(ROOT, 'src', 'content', 'data-products');
const CONTENT_DIR = path.join(ROOT, 'src', 'content');
const ARTICLE_COLLECTIONS = ['reviews', 'guides', 'news', 'brands', 'games'];
const args = process.argv.slice(2);
const fullMode = args.includes('--full');

// ─── Product Helpers ─────────────────────────────────────────────────────────

function findProductFiles() {
  const files = [];
  const categories = fs.readdirSync(PRODUCTS_DIR, { withFileTypes: true })
    .filter(d => d.isDirectory())
    .map(d => d.name);

  for (const cat of categories) {
    const catDir = path.join(PRODUCTS_DIR, cat);
    const brands = fs.readdirSync(catDir, { withFileTypes: true })
      .filter(d => d.isDirectory())
      .map(d => d.name);

    for (const brand of brands) {
      const brandDir = path.join(catDir, brand);
      const jsonFiles = fs.readdirSync(brandDir).filter(f => f.endsWith('.json'));
      for (const file of jsonFiles) {
        files.push({
          path: path.join(brandDir, file),
          category: cat,
          brandSlug: brand,
          productSlug: file.replace('.json', ''),
        });
      }
    }
  }
  return files;
}

function parseProduct(filePath, meta) {
  const raw = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  const id = `${meta.brandSlug}-${meta.productSlug}`;

  // Extract identity fields, put everything else in specs
  const { slug, brand, model, baseModel, variant, category, imagePath, media, ...specs } = raw;

  return {
    id,
    slug: slug ?? meta.productSlug,
    brand: brand ?? '',
    model: model ?? '',
    base_model: baseModel ?? '',
    variant: variant ?? '',
    category: category ?? meta.category,
    image_path: imagePath ?? '',
    media: media ?? { defaultColor: null, colors: [], editions: [], images: [] },
    specs,
  };
}

// ─── Article Helpers ─────────────────────────────────────────────────────────

function findArticleFiles() {
  const files = [];
  for (const collection of ARTICLE_COLLECTIONS) {
    const collDir = path.join(CONTENT_DIR, collection);
    if (!fs.existsSync(collDir)) continue;

    const slugDirs = fs.readdirSync(collDir, { withFileTypes: true })
      .filter(d => d.isDirectory())
      .map(d => d.name);

    for (const slug of slugDirs) {
      const slugDir = path.join(collDir, slug);
      // Look for index.md or index.mdx
      for (const ext of ['index.mdx', 'index.md']) {
        const filePath = path.join(slugDir, ext);
        if (fs.existsSync(filePath)) {
          files.push({ path: filePath, collection, slug });
          break;
        }
      }
    }
  }
  return files;
}

function parseArticle(filePath, meta) {
  const raw = fs.readFileSync(filePath, 'utf-8');
  const { data } = matter(raw);

  return {
    id: meta.slug,
    collection: meta.collection,
    title: data.title ?? meta.slug,
    description: data.description ?? null,
    category: data.category ?? null,
    hero: data.hero ?? null,
    brand: data.brand ?? null,
    model: data.model ?? null,
    tags: Array.isArray(data.tags) ? data.tags.map(String) : null,
    date_published: data.datePublished ?? null,
    date_updated: data.dateUpdated ?? null,
  };
}

// ─── Database Operations ─────────────────────────────────────────────────────

async function syncProducts(client, products) {
  const upsertSQL = `
    INSERT INTO products (id, slug, brand, model, base_model, variant, category, image_path, media, specs, updated_at)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW())
    ON CONFLICT (id) DO UPDATE SET
      slug = EXCLUDED.slug,
      brand = EXCLUDED.brand,
      model = EXCLUDED.model,
      base_model = EXCLUDED.base_model,
      variant = EXCLUDED.variant,
      category = EXCLUDED.category,
      image_path = EXCLUDED.image_path,
      media = EXCLUDED.media,
      specs = EXCLUDED.specs,
      updated_at = NOW()
  `;

  let count = 0;
  for (const p of products) {
    await client.query(upsertSQL, [
      p.id, p.slug, p.brand, p.model, p.base_model, p.variant,
      p.category, p.image_path, JSON.stringify(p.media), JSON.stringify(p.specs),
    ]);
    count++;
  }
  return count;
}

async function syncArticles(client, articles) {
  const upsertSQL = `
    INSERT INTO articles (id, collection, title, description, category, hero, brand, model, tags, date_published, date_updated, updated_at)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW())
    ON CONFLICT (id, collection) DO UPDATE SET
      title = EXCLUDED.title,
      description = EXCLUDED.description,
      category = EXCLUDED.category,
      hero = EXCLUDED.hero,
      brand = EXCLUDED.brand,
      model = EXCLUDED.model,
      tags = EXCLUDED.tags,
      date_published = EXCLUDED.date_published,
      date_updated = EXCLUDED.date_updated,
      updated_at = NOW()
  `;

  let count = 0;
  for (const a of articles) {
    await client.query(upsertSQL, [
      a.id, a.collection, a.title, a.description, a.category,
      a.hero, a.brand, a.model, a.tags,
      a.date_published, a.date_updated,
    ]);
    count++;
  }
  return count;
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`[sync-db] Mode: ${fullMode ? 'FULL (truncate + insert)' : 'INCREMENTAL (upsert)'}`);

  const pool = new pg.Pool({ connectionString: DATABASE_URL });
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    if (fullMode) {
      await client.query('TRUNCATE products, articles');
      console.log('[sync-db] Truncated products and articles tables');
    }

    // Products
    console.log('[sync-db] Scanning product JSON files...');
    const productFiles = findProductFiles();
    const products = productFiles.map(f => parseProduct(f.path, f));
    const productCount = await syncProducts(client, products);
    console.log(`[sync-db] Synced ${productCount} products`);

    // Articles
    console.log('[sync-db] Scanning article frontmatter...');
    const articleFiles = findArticleFiles();
    const articles = articleFiles.map(f => parseArticle(f.path, f));
    const articleCount = await syncArticles(client, articles);
    console.log(`[sync-db] Synced ${articleCount} articles`);

    await client.query('COMMIT');
    console.log(`[sync-db] Done. ${productCount} products + ${articleCount} articles`);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[sync-db] Error:', err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

main();
