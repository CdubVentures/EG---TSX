# Database Schema

Validated against:

- `src/content.config.ts`
- `src/core/products.ts`
- `src/core/db.ts`
- `scripts/schema.sql`
- `scripts/sync-db.mjs`
- `src/pages/api/search.ts`
- `src/pages/api/admin/db-setup.ts`
- `src/pages/api/admin/db-sync.ts`
- `src/features/vault/server/db.ts`
- `src/features/vault/server/schema.ts`
- `src/pages/api/user/vault.ts`
- `src/pages/api/vault/thumbs.ts`

See also:

- [System Map](system-map.md)
- [Environment and Config](../02-dependencies/environment-and-config.md)
- [Search Feature Flow](../04-features/search.md)
- [Auth Feature Flow](../04-features/auth.md)
- [Vault Feature Flow](../04-features/vault.md)
- [DB Sync Pipeline](../05-operations/db-sync.md)
- [../../src/content/README.md](../../src/content/README.md)
- [../../config/data/README.md](../../config/data/README.md)

## Current store inventory

| Surface | Storage type | Status | Canonical or derived | Primary writers | Primary readers |
|---|---|---|---|---|---|
| `src/content/data-products/**/*.json` | Filesystem JSON | Current | Canonical product source | product authoring and repo edits | Astro content loader, DB sync paths, thumbnail resolvers |
| `src/content/{reviews,guides,news,brands,games}/**/index.{md,mdx}` | Filesystem Markdown or MDX frontmatter | Current | Canonical editorial source | editorial authoring and repo edits | Astro content loader, DB sync paths |
| PostgreSQL `products` | SQL table on RDS | Current | Derived search mirror | `scripts/sync-db.mjs`, `/api/admin/db-sync` | `/api/search`, search-related view-model enrichment |
| PostgreSQL `articles` | SQL table on RDS | Current | Derived search mirror | `scripts/sync-db.mjs`, `/api/admin/db-sync` | `/api/search` |
| DynamoDB vault table (`eg_profiles` fallback) | Key-value document table | Current | Canonical signed-in compare state | `/api/user/vault` | `/api/user/vault`, `/api/auth/sign-in`, `/auth/callback` |

## Store status by lifecycle

| Lifecycle state | Verified surfaces |
|---|---|
| Current canonical | `src/content/data-products/**`, `src/content/{reviews,guides,news,brands,games}/**`, DynamoDB vault rows keyed by `userId` |
| Current derived | PostgreSQL `products` and `articles` |
| Transitional but still live | None verified |
| Deprecated but still live | None verified |
| Retired and excluded from active docs | No retired database or cache store is documented as current in this phase |

## PostgreSQL search mirror

Purpose: mirror searchable fields from the filesystem-backed product and editorial sources into RDS so `/api/search` can use PostgreSQL full-text search.

### `products`

Source path:

- `src/content/data-products/{category}/{brand}/{slug}.json`

Writers:

- `scripts/sync-db.mjs`
- `POST /api/admin/db-sync`

Readers:

- `GET /api/search`
- search-related review/index helpers that enrich view models from mirrored product data

| Column | Type | Notes |
|---|---|---|
| `id` | `TEXT PRIMARY KEY` | Search-mirror row key built by the sync inputs |
| `slug` | `TEXT NOT NULL` | Product slug from the canonical JSON or filename fallback |
| `brand` | `TEXT NOT NULL` | Brand name used in ranking and display |
| `model` | `TEXT NOT NULL` | Product model used in ranking and display |
| `base_model` | `TEXT NOT NULL` | Shared model family for ranking |
| `variant` | `TEXT NOT NULL DEFAULT ''` | Variant label used in ranking |
| `category` | `TEXT NOT NULL` | Category contract key from the canonical product JSON |
| `image_path` | `TEXT NOT NULL` | Canonical media base path used by image helpers and `/hubs/...` URL helpers |
| `media` | `JSONB NOT NULL` | Structured product media payload from `src/content.config.ts` |
| `specs` | `JSONB NOT NULL` | Pass-through spec payload from the canonical JSON |
| `search_vec` | `tsvector GENERATED ALWAYS` | Weighted full-text vector over brand, model, base_model, and variant |
| `updated_at` | `TIMESTAMPTZ DEFAULT NOW()` | Mirror write timestamp |

Indexes:

- `idx_products_category`
- `idx_products_search`
- `idx_products_specs`

### `articles`

Source paths:

- `src/content/reviews/**/index.{md,mdx}`
- `src/content/guides/**/index.{md,mdx}`
- `src/content/news/**/index.{md,mdx}`
- `src/content/brands/**/index.{md,mdx}`
- `src/content/games/**/index.{md,mdx}`

Writers:

- `scripts/sync-db.mjs`
- `POST /api/admin/db-sync`

Readers:

- `GET /api/search`

| Column | Type | Notes |
|---|---|---|
| `id` | `TEXT NOT NULL` | Collection entry ID derived from the slug-folder loader |
| `collection` | `TEXT NOT NULL` | Collection name such as `reviews`, `guides`, `news`, `brands`, or `games` |
| `title` | `TEXT NOT NULL` | Primary search text |
| `description` | `TEXT` | Search snippet source |
| `category` | `TEXT` | Optional category key from frontmatter |
| `hero` | `TEXT` | Hero image stem or identifier |
| `brand` | `TEXT` | Optional brand metadata |
| `model` | `TEXT` | Optional model metadata |
| `tags` | `TEXT[]` | Editorial tags |
| `date_published` | `TIMESTAMPTZ` | Publish date from frontmatter |
| `date_updated` | `TIMESTAMPTZ` | Update date from frontmatter |
| `search_vec` | `tsvector GENERATED ALWAYS` | Weighted full-text vector over title, brand, model, and description |
| `updated_at` | `TIMESTAMPTZ DEFAULT NOW()` | Mirror write timestamp |

Primary key:

- `(id, collection)`

Indexes:

- `idx_articles_collection`
- `idx_articles_search`

## Mirror and sync paths

### Local direct sync

1. `scripts/sync-db.mjs` requires `DATABASE_URL`.
2. It scans canonical product JSON and article frontmatter under `src/content`.
3. Default mode is incremental upsert.
4. `--full` truncates `products` and `articles` before reloading both tables.

### Runtime admin sync

1. `POST /api/admin/db-setup` applies the schema DDL inside the running Lambda-connected app.
2. `POST /api/admin/db-sync` accepts JSON payloads for `products` and `articles`.
3. Both endpoints are gated by `x-admin-token`, sourced from `ADMIN_TOKEN` with a hardcoded fallback.

### Schema sources

- `scripts/schema.sql` is the reference SQL file for direct Postgres setup.
- `src/pages/api/admin/db-setup.ts` contains the runtime-applied DDL used by the deployed admin path.

## Relationships and ownership boundaries

- The filesystem-backed content is authoritative. PostgreSQL is a mirror, not an authoring source.
- There are no SQL foreign keys between `products` and `articles`.
- Review frontmatter may carry a `productId`, but that relationship is not enforced in PostgreSQL.
- Search result URL joins are helper-driven rather than relational:
  - products map to helper-generated `/hubs/{category}/{brandSlug}/{modelSlug}` contracts
  - articles map to `/{collection}/{entryId}` contracts
- In this repo snapshot, those `/hubs/...` product URLs are still emitted by helpers and data, but local `src/pages/hubs/**` route files were not found.

## DynamoDB vault store

Purpose: persist signed-in comparison state independently from the static site and the PostgreSQL search mirror.

### Table resolution

Current code path:

- `src/features/vault/server/db.ts` reads `import.meta.env.DYNAMO_PROFILES_TABLE ?? 'eg_profiles'`

Current stack path:

- `infrastructure/aws/eg-tsx-stack.yaml` injects `DYNAMODB_TABLE_NAME` into Lambda

This is a live divergence between deployment config and application consumption. Current code does not read `DYNAMODB_TABLE_NAME` directly.

### Key and attributes

| Field | Type | Notes |
|---|---|---|
| `userId` | string | Partition key; Cognito-backed user identifier |
| `vault` | string or document | Serialized versioned compare payload |
| `rev` | number | Monotonic revision counter incremented on writes |

### Payload shape

```json
{
  "v": 1,
  "compare": [
    {
      "productId": "mouse/razer/viper-v3-pro",
      "category": "mouse",
      "product": {
        "id": "mouse/razer/viper-v3-pro",
        "slug": "razer-viper-v3-pro",
        "brand": "Razer",
        "model": "Viper V3 Pro",
        "category": "mouse",
        "imagePath": "/images/mouse/razer/razer-viper-v3-pro",
        "thumbnailStem": "top"
      },
      "addedAt": 1700000000000
    }
  ],
  "builds": []
}
```

### Runtime behavior

- Missing rows resolve to `{ compare: [], builds: [], rev: 0 }`.
- Invalid or legacy payloads are treated as empty instead of failing the request.
- `PUT /api/user/vault` preserves existing `builds` and replaces `compare`.
- `GET /api/user/vault?rev={n}` can short-circuit with `304` when the revision has not changed.
- `POST /api/vault/thumbs` does not use DynamoDB; it resolves thumbnail metadata from the canonical product/content registry.

## Validation notes

- Executed: `node scripts/validate-image-links.mjs`
  - Result: content/image naming convention is intact for current content files, with orphan image directories remaining on disk
- Not executed: live PostgreSQL or DynamoDB smoke calls
  - Reason: this documentation pass did not have an approved live environment target or credentials
