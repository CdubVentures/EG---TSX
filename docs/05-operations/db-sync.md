# Database Sync - Search DB Pipeline

> **Status:** Operational
> **Last updated:** 2026-03-11

## Overview

The site search endpoint (`/api/search`) runs against PostgreSQL on AWS RDS.
Product specs and article metadata must be synced from the local content files
into that database whenever searchable content changes.

## Architecture

```text
Local content files (JSON + MDX frontmatter)
    -> scripts/sync-db-remote.mjs reads files
    -> POSTs batches to Lambda admin endpoints
Lambda /api/admin/db-setup -> CREATE TABLE IF NOT EXISTS
Lambda /api/admin/db-sync  -> UPSERT products + articles into RDS
    ->
PostgreSQL RDS (private, VPC-only)
    ->
/api/search queries RDS via full-text search
```

Why it goes through Lambda:
- RDS is private and not publicly reachable
- the Lambda runtime lives in the same VPC and can reach RDS directly
- local sync only needs HTTPS access to the deployed app entrypoint

## Files

| File | Purpose |
|------|---------|
| `scripts/sync-db-remote.mjs` | Local sync script that scans content and POSTs batches to Lambda |
| `scripts/sync-db.mjs` | Direct DB sync for environments with database access |
| `scripts/schema.sql` | Reference DDL for the search tables and indexes |
| `src/pages/api/admin/db-setup.ts` | Admin endpoint that creates tables idempotently |
| `src/pages/api/admin/db-sync.ts` | Admin endpoint that upserts products and articles |
| `src/core/db.ts` | PostgreSQL connection pool used by the search runtime |

## Running The Sync

```sh
# Uses domain from .env.deploy DEPLOY_COGNITO_CALLBACK_URL
node scripts/sync-db-remote.mjs

# Explicit target URL
node scripts/sync-db-remote.mjs --url https://example.cloudfront.net

# Custom admin token
node scripts/sync-db-remote.mjs --token my-secret-token
```

Expected flow:
- create tables if needed
- scan product JSON
- scan article metadata
- send batches to `/api/admin/db-sync`
- report final product/article totals synced

## When To Sync

| Change | Action needed |
|--------|---------------|
| New product JSON added | Run sync |
| Product spec or score updated | Run sync |
| New article MDX created | Run sync |
| Article title, description, brand, model, or dates changed | Run sync |
| New searchable category added | Run sync |
| CSS, component, or layout change only | No sync needed |
| Image-only change | No sync needed |

## Admin Endpoints

### POST /api/admin/db-setup

Creates the `products` and `articles` tables if they do not exist. Safe to run
repeatedly because the DDL is idempotent.

Auth:
- `x-admin-token` must match `ADMIN_TOKEN`

### POST /api/admin/db-sync

Upserts products and articles with `INSERT ... ON CONFLICT DO UPDATE`.

Auth:
- same `x-admin-token` header

Body shape:

```json
{
  "products": [{ "id": "razer-viper-v3-pro", "slug": "viper-v3-pro" }],
  "articles": [{ "id": "razer-viper-v3-pro-review", "collection": "reviews" }]
}
```

Batching:
- the sync script sends bounded batches to stay within Lambda payload limits

## Database Schema

Two tables back the current search index:

**`products`**
- one row per product
- identity fields such as `id`, `slug`, `brand`, `model`, `category`, `image_path`
- `media` stored as `JSONB`
- `specs` stored as `JSONB`
- generated `search_vec` for full-text search

**`articles`**
- one row per article plus collection
- fields such as `id`, `collection`, `title`, `description`, `category`, `hero`, `brand`, `model`, `tags`
- publication/update timestamps
- generated `search_vec` for full-text search

Canonical DDL lives in `../scripts/schema.sql`.

## Adding A New Category

No sync-specific config is required. The sync scripts scan the content tree and
pick up new products and supported article collections automatically.

1. Add product files under `src/content/data-products/{category}/...`
2. Add article files under `src/content/{collection}/...`
3. Run `node scripts/sync-db-remote.mjs`
4. Verify the new rows are searchable through `/api/search`

## Security

- admin endpoints are gated by `x-admin-token`
- RDS remains private and VPC-only
- Lambda connects to RDS over the VPC
- `/api/admin/*` stays part of the dynamic Lambda route surface
