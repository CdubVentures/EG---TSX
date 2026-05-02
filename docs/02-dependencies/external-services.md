# External Services

> **Purpose:** Every third-party API, SaaS, auth provider, and external system this project depends on.
> **Prerequisites:** [Stack and Toolchain](stack-and-toolchain.md)
> **Last validated:** 2026-03-15

## AWS Services

| Service | Purpose | Access Method | Config |
|---------|---------|--------------|--------|
| **CloudFront** | CDN for static assets + Lambda proxy | Infrastructure (CloudFormation) | `infrastructure/aws/eg-tsx-stack.yaml` |
| **S3** | Static site storage (HTML, CSS, JS, images) | AWS SDK | `EG_TSX_ARTIFACT_BUCKET` env var |
| **Lambda** (Function URL) | SSR routes (auth, search, vault, API) | Node.js standalone adapter | `lambda-entry.mjs` |
| **Cognito** | User authentication (OAuth, JWT) | `aws-amplify` + `jose` | `PUBLIC_COGNITO_*` + `COGNITO_*` env vars |
| **DynamoDB** | User vault persistence (saved products) | `@aws-sdk/lib-dynamodb` | `DYNAMO_PROFILES_TABLE` env var |
| **RDS PostgreSQL** | Full-text search index | `pg` client | `DATABASE_URL` env var |

## Affiliate Networks

| Service | Purpose | Config |
|---------|---------|--------|
| Amazon Associates | Product deal links (`tag=eggear-20`) | `AFFILIATE_AMAZON` env var |
| B&H Photo | Product deal links | `AFFILIATE_BHPHOTO` env var |
| Newegg | Product deal links | `AFFILIATE_NEWEGG` env var |

## Analytics & Ads

| Service | Purpose | Config |
|---------|---------|--------|
| Google Analytics | Site analytics | `PUBLIC_GA_MEASUREMENT_ID` env var |
| Google AdSense | Ad network | `adsenseClient` in `ads-registry.json` |
| Google DFP (Ad Manager) | Ad placement management | `adSlot` IDs in `ads-registry.json` |

## No External APIs Called at Build Time

The site builds entirely from local files. No external API calls during `npm run build`. External services are only used at runtime (search, auth, vault) or for deployment (AWS).

## Failure Behavior

| Service | If unavailable | Impact |
|---------|---------------|--------|
| CloudFront/S3 | Site unreachable | Total outage |
| Lambda | SSR routes 502 | Auth, search, vault unavailable; static pages still work |
| Cognito | Auth fails | Users can't log in; anonymous browsing unaffected |
| DynamoDB | Vault operations fail | Vault save/load errors; rest of site works |
| RDS PostgreSQL | Search returns empty | Search unavailable; direct browsing unaffected |

## Related Documents

- [System Map](../03-architecture/system-map.md) — deployment topology
- [Environment and Config](environment-and-config.md) — all env vars
- [Auth Feature](../04-features/auth.md) — Cognito integration details
