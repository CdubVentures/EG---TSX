#!/usr/bin/env node
// ─── sync-db-remote.mjs — Sync products + articles to the Lambda search DB ──
// Reads local content files, POSTs the data to /api/admin/db-setup then /api/admin/db-sync.
//
// Usage:
//   node scripts/sync-db-remote.mjs                    # uses DEPLOY_COGNITO_CALLBACK_URL domain
//   node scripts/sync-db-remote.mjs --url https://...  # explicit Lambda or CloudFront URL
//   node scripts/sync-db-remote.mjs --token my-token   # custom admin token

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

// ─── CLI args ─────────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
function getArg(flag) {
  const idx = args.indexOf(flag);
  return idx !== -1 && args[idx + 1] ? args[idx + 1] : null;
}

const ADMIN_TOKEN = getArg('--token') || 'eg-setup-2026';

function resolveBaseUrl() {
  const explicit = getArg('--url');
  if (explicit) return explicit.replace(/\/$/, '');

  // Read from .env.deploy
  const envPath = path.join(ROOT, 'tools', 'deploy-dashboard', '.env.deploy');
  if (fs.existsSync(envPath)) {
    const lines = fs.readFileSync(envPath, 'utf-8').split('\n');
    for (const line of lines) {
      const match = line.match(/^DEPLOY_COGNITO_CALLBACK_URL=(.+)/);
      if (match) {
        // Extract domain from callback URL (remove /auth/callback)
        const url = new URL(match[1].trim());
        return url.origin;
      }
    }
  }

  console.error('[sync-db-remote] Cannot determine base URL. Use --url or set DEPLOY_COGNITO_CALLBACK_URL in .env.deploy');
  process.exit(1);
}

const BASE_URL = resolveBaseUrl();
console.log(`[sync-db-remote] Target: ${BASE_URL}`);

// ─── Product scanning ─────────────────────────────────────────────────────────

const PRODUCTS_DIR = path.join(ROOT, 'src', 'content', 'data-products');

function scanProducts() {
  const products = [];
  const categories = fs.readdirSync(PRODUCTS_DIR, { withFileTypes: true })
    .filter(d => d.isDirectory()).map(d => d.name);

  for (const cat of categories) {
    const catDir = path.join(PRODUCTS_DIR, cat);
    const brands = fs.readdirSync(catDir, { withFileTypes: true })
      .filter(d => d.isDirectory()).map(d => d.name);

    for (const brand of brands) {
      const brandDir = path.join(catDir, brand);
      const jsonFiles = fs.readdirSync(brandDir).filter(f => f.endsWith('.json'));
      for (const file of jsonFiles) {
        const raw = JSON.parse(fs.readFileSync(path.join(brandDir, file), 'utf-8'));
        const productSlug = file.replace('.json', '');
        const id = `${brand}-${productSlug}`;
        const { slug, brand: pBrand, model, baseModel, variant, category, imagePath, media, ...specs } = raw;
        products.push({
          id,
          slug: slug ?? productSlug,
          brand: pBrand ?? '',
          model: model ?? '',
          base_model: baseModel ?? '',
          variant: variant ?? '',
          category: category ?? cat,
          image_path: imagePath ?? '',
          media: media ?? { defaultColor: null, colors: [], editions: [], images: [] },
          specs,
        });
      }
    }
  }
  return products;
}

// ─── Article scanning ─────────────────────────────────────────────────────────

const CONTENT_DIR = path.join(ROOT, 'src', 'content');
const ARTICLE_COLLECTIONS = ['reviews', 'guides', 'news', 'brands', 'games'];

function scanArticles() {
  // WHY dynamic import: gray-matter is CJS, need top-level await
  return import('gray-matter').then(({ default: matter }) => {
    const articles = [];
    for (const collection of ARTICLE_COLLECTIONS) {
      const collDir = path.join(CONTENT_DIR, collection);
      if (!fs.existsSync(collDir)) continue;

      const slugDirs = fs.readdirSync(collDir, { withFileTypes: true })
        .filter(d => d.isDirectory()).map(d => d.name);

      for (const slug of slugDirs) {
        const slugDir = path.join(collDir, slug);
        for (const ext of ['index.mdx', 'index.md']) {
          const filePath = path.join(slugDir, ext);
          if (fs.existsSync(filePath)) {
            const raw = fs.readFileSync(filePath, 'utf-8');
            const { data } = matter(raw);
            articles.push({
              id: slug,
              collection,
              title: data.title ?? slug,
              description: data.description ?? null,
              category: data.category ?? null,
              hero: data.hero ?? null,
              brand: data.brand ?? null,
              model: data.model ?? null,
              tags: Array.isArray(data.tags) ? data.tags.map(String) : null,
              date_published: data.datePublished ?? null,
              date_updated: data.dateUpdated ?? null,
            });
            break;
          }
        }
      }
    }
    return articles;
  });
}

// ─── HTTP helpers ─────────────────────────────────────────────────────────────

async function post(endpoint, body) {
  const url = `${BASE_URL}${endpoint}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-admin-token': ADMIN_TOKEN,
    },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`${res.status}: ${JSON.stringify(data)}`);
  return data;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  // Step 1: Create tables
  console.log('[sync-db-remote] Creating tables...');
  const setup = await post('/api/admin/db-setup', {});
  console.log(`[sync-db-remote] Schema: ${setup.message} (tables: ${setup.tables.join(', ')})`);

  // Step 2: Scan local data
  console.log('[sync-db-remote] Scanning products...');
  const products = scanProducts();
  console.log(`[sync-db-remote] Found ${products.length} products`);

  console.log('[sync-db-remote] Scanning articles...');
  const articles = await scanArticles();
  console.log(`[sync-db-remote] Found ${articles.length} articles`);

  // Step 3: Send in batches (Lambda has a 6MB payload limit)
  const BATCH_SIZE = 100;

  let totalProducts = 0;
  for (let i = 0; i < products.length; i += BATCH_SIZE) {
    const batch = products.slice(i, i + BATCH_SIZE);
    const result = await post('/api/admin/db-sync', { products: batch });
    totalProducts += result.products;
    console.log(`[sync-db-remote] Products batch ${Math.floor(i / BATCH_SIZE) + 1}: ${result.products} synced`);
  }

  let totalArticles = 0;
  for (let i = 0; i < articles.length; i += BATCH_SIZE) {
    const batch = articles.slice(i, i + BATCH_SIZE);
    const result = await post('/api/admin/db-sync', { articles: batch });
    totalArticles += result.articles;
    console.log(`[sync-db-remote] Articles batch ${Math.floor(i / BATCH_SIZE) + 1}: ${result.articles} synced`);
  }

  console.log(`[sync-db-remote] Done. ${totalProducts} products + ${totalArticles} articles synced.`);
}

main().catch(err => {
  console.error('[sync-db-remote] Fatal:', err.message);
  process.exit(1);
});
