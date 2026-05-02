# Deployment

> **Purpose:** How the app is built and deployed — commands, infrastructure, rollback.
> **Prerequisites:** [System Map](../03-architecture/system-map.md), [Stack and Toolchain](../02-dependencies/stack-and-toolchain.md)
> **Last validated:** 2026-03-15

## Build

```bash
npm run build
```

This runs `scripts/run-astro-build.mjs`, which:
1. Validates TypeScript (`astro check`)
2. Runs Astro build (outputs to `dist/`)
3. Packages Lambda artifacts

Build output:
- `dist/client/` — static assets (HTML, CSS, JS, images)
- `dist/server/` — Node.js SSR server for Lambda

## Infrastructure

AWS CloudFormation template: `infrastructure/aws/eg-tsx-stack.yaml`

| Resource | Type | Purpose |
|----------|------|---------|
| S3 Bucket | `eg-tsx-static` | Static site storage |
| CloudFront Distribution | `eg-tsx-cf` | CDN + origin routing |
| Lambda Function URL | `eg-tsx-lambda` | SSR routes |
| RDS PostgreSQL | `eg-tsx-rds` | Full-text search DB |
| DynamoDB Table | `eg-tsx-ddb` | User vault persistence |
| VPC (10.0.0.0/16) | `eg-tsx-vpc` | Network isolation for RDS + Lambda |

## Deploy Command

```bash
node scripts/deploy-aws.mjs
```

This script:
1. Packages `dist/` into a Lambda deployment zip
2. Uploads to S3 artifact bucket
3. Updates CloudFormation stack
4. Syncs static assets to S3
5. Invalidates CloudFront cache

## CloudFront Origin Routing

| Origin | Routes | Delivery |
|--------|--------|----------|
| **S3** (static) | `/`, `/reviews/*`, `/guides/*`, `/news/*`, `/brands/*`, `/_astro/*`, `/images/*`, `/fonts/*` | Pre-rendered HTML + assets |
| **Lambda** (dynamic) | `/api/*`, `/auth/*`, `/login/*`, `/logout*` | Server-rendered responses |

## Cache Invalidation

```bash
node scripts/invalidation-core.mjs
```

Cache policies defined in `config/data/cache-cdn.json`. See the
[Cache/CDN Panel](../../config/docs/panels/cache-cdn.md) for details.

## Environment Setup

See [Environment and Config](../02-dependencies/environment-and-config.md) for all required environment variables.

## Bootstrap (first-time only)

```bash
node scripts/bootstrap-artifact-bucket.mjs  # Step 1: S3 bucket
node scripts/bootstrap-main-stack.mjs       # Step 2: CloudFormation stack
node scripts/deploy-aws.mjs                 # Step 3: First deploy
```

Detailed order in `infrastructure/aws/RUN-ORDER.txt`.

## Rollback

Redeploy a previous build artifact from S3. CloudFormation supports stack rollback on failure.

## Related Documents

- [System Map](../03-architecture/system-map.md) — full deployment topology
- [DB Sync](db-sync.md) — search database sync pipeline
- [Route Graph Warning](route-graph-warning.md) — post-build SEO validation
