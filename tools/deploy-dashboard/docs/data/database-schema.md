# Database Schema And Data Ownership

## Data Surface Summary

The dashboard operates across four different data classes:

1. Local canonical content sources in the EG-TSX repo
2. Remote canonical runtime stores used by the deployed site
3. Derived static output and CDN-facing objects
4. Local dashboard operator state and marker files

## Canonical Content Sources

| Surface | Canonical owner | Notes |
| --- | --- | --- |
| `src/content/reviews`, `guides`, `news`, `brands`, `games`, `pages` | Files in the repo | Watched by `services/watcher.py`. Review/guide/news/brand/game files also drive DB sync eligibility. |
| `src/content/data-products` | Files in the repo | Canonical product content for search DB sync. |
| `public/images` | Files in the repo | Canonical image source for static uploads. Watched separately with a longer TTL cache. |
| `dist/client` | Derived build output | Produced by Astro builds and used for static sync and page inventory. Not canonical. |

## Remote Canonical Runtime Stores

### PostgreSQL Search Store

The deployed admin APIs create and upsert two tables in PostgreSQL. `scripts/schema.sql` and `src/pages/api/admin/db-setup.ts` define the same DDL.

#### `products`

| Column | Type | Notes |
| --- | --- | --- |
| `id` | `TEXT PRIMARY KEY` | Astro entry id, for example `razer-viper-v3-pro` |
| `slug` | `TEXT NOT NULL` | URL/data slug |
| `brand` | `TEXT NOT NULL` | Product brand |
| `model` | `TEXT NOT NULL` | Product model |
| `base_model` | `TEXT NOT NULL` | Base model string |
| `variant` | `TEXT NOT NULL DEFAULT ''` | Variant string |
| `category` | `TEXT NOT NULL` | Product category |
| `image_path` | `TEXT NOT NULL` | Source image path |
| `media` | `JSONB NOT NULL` | Structured media object |
| `specs` | `JSONB NOT NULL` | Searchable specs payload |
| `search_vec` | generated `tsvector` | Built from brand/model/base_model/variant using the `simple` dictionary |
| `updated_at` | `TIMESTAMPTZ` | Last upsert timestamp |

Indexes:

- `idx_products_category`
- `idx_products_search`
- `idx_products_specs`

#### `articles`

| Column | Type | Notes |
| --- | --- | --- |
| `id` | `TEXT NOT NULL` | Content entry id |
| `collection` | `TEXT NOT NULL` | One of `reviews`, `guides`, `news`, `brands`, `games` |
| `title` | `TEXT NOT NULL` | Search title |
| `description` | `TEXT` | Search snippet source |
| `category` | `TEXT` | Optional content category |
| `hero` | `TEXT` | Hero stem for image resolution |
| `brand` | `TEXT` | Optional brand |
| `model` | `TEXT` | Optional model |
| `tags` | `TEXT[]` | Optional tags |
| `date_published` | `TIMESTAMPTZ` | Published timestamp |
| `date_updated` | `TIMESTAMPTZ` | Updated timestamp |
| `search_vec` | generated `tsvector` | Built from title/brand/model/description using the `simple` dictionary |
| `updated_at` | `TIMESTAMPTZ` | Last upsert timestamp |

Primary key:

- `(id, collection)`

Indexes:

- `idx_articles_collection`
- `idx_articles_search`

### DynamoDB Vault Store

`src/features/vault/server/db.ts` makes the deployed site treat DynamoDB as the canonical store for user vault data.

| Field | Ownership | Notes |
| --- | --- | --- |
| `userId` | Partition key in code | Used as the item key for reads and writes |
| `vault` | Canonical user payload | JSON string containing `{ v: 1, compare, builds }` |
| `rev` | Canonical optimistic version | Incremented atomically on every write |

The table name is ambiguous in source: CloudFormation injects `DYNAMODB_TABLE_NAME`, but the audited code reads `DYNAMO_PROFILES_TABLE` with fallback `eg_profiles`.

## Derived And Operational Stores

| Surface | Role | Current status |
| --- | --- | --- |
| S3 static bucket | Derived deploy target for site/data/images | Current and live |
| CloudFront cache | Derived CDN layer above S3 and Lambda | Current and live |
| `app/runtime/deploy_history.json` | Local persisted operator history | Current and live |
| `app/runtime/cdn_queue.json` | Local persisted queued smart invalidations | Current and live |
| `.last_sync_success` | Legacy site-wide publish marker | Still live, but now mostly a compatibility view for `pending/count/files` |
| `.last_astro_build_success` | Build marker | Current and live |
| `.last_data_publish_success` | Data upload marker | Current and live |
| `.last_image_publish_success` | Image upload marker | Current and live |
| `.last_lambda_deploy_success` | Lambda deploy marker | Current and live |
| `.last_db_sync_success` | DB sync marker | Current and live |

## Sync And Ownership Paths

### Search DB Sync Path

1. Local Markdown and JSON content stays canonical in the repo.
2. `scripts/sync-db-remote.mjs` reads that content locally.
3. The script calls deployed `/api/admin/db-setup` and `/api/admin/db-sync`.
4. The admin routes create/upsert Postgres rows.
5. The deployed `/api/search` route reads only Postgres tables, not the source files.

### Static Publish Path

1. Local source and image files are canonical.
2. Astro build output in `dist/client` is derived.
3. `scripts/deploy-aws.mjs` syncs derived output and/or images into S3.
4. CloudFront serves those objects and can also route dynamic paths to Lambda.

### Dashboard Local State Path

1. Watcher scans the local repo and compares mtimes against marker files.
2. Successful actions touch the marker files that correspond to the scope that actually completed.
3. Deploy history and CDN queue JSON files persist operator-facing summaries across dashboard restarts.

## Transitional Versus Deprecated State

- Transitional but still live: `.last_sync_success` remains part of the status contract, but newer fields such as `buildPending`, `pendingDataUploadCount`, `pendingImageUploadCount`, `dbSyncCount`, and `lambdaFiles` are the more precise operators fields.
- Deprecated and removed from docs: no retired database or cache stores were found in current code that should remain documented as live.

## Cross-Links

- Runtime and env wiring: [../runtime/environment-and-config.md](../runtime/environment-and-config.md)
- System topology: [../architecture/system-map.md](../architecture/system-map.md)
- DB sync feature: [../features/search-db-sync.md](../features/search-db-sync.md)
- Split publish feature: [../features/split-static-publishes-and-cdn-queue.md](../features/split-static-publishes-and-cdn-queue.md)
- Observability feature: [../features/operator-observability.md](../features/operator-observability.md)

## Validated Against

- `app/services/watcher.py`
- `app/services/cdn_queue.py`
- `app/services/deploy_history.py`
- `../../scripts/schema.sql`
- `../../scripts/sync-db-remote.mjs`
- `../../src/core/db.ts`
- `../../src/features/vault/server/db.ts`
- `../../src/pages/api/admin/db-setup.ts`
- `../../src/pages/api/admin/db-sync.ts`
- `../../src/pages/api/search.ts`
- `../../infrastructure/aws/eg-tsx-stack.yaml`
