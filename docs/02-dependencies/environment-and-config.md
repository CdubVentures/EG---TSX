# Environment and Config

Validated against:

- `.env.example`
- `astro.config.mjs`
- `lambda-entry.mjs`
- `src/core/config.ts`
- `src/core/category-contract.ts`
- `src/core/cache-cdn-contract.ts`
- `src/content.config.ts`
- `src/core/db.ts`
- `src/middleware.ts`
- `src/features/auth/server/cognito-config.ts`
- `src/features/auth/server/oidc.ts`
- `src/features/auth/server/token-exchange.ts`
- `src/features/auth/server/refresh.ts`
- `src/features/vault/server/db.ts`
- `src/pages/api/admin/db-setup.ts`
- `src/pages/api/admin/db-sync.ts`
- `src/features/ads/resolve.ts`
- `src/features/ads/bootstrap.ts`
- `scripts/deploy-aws.mjs`
- `scripts/aws-operator.mjs`
- `scripts/bootstrap-artifact-bucket.mjs`
- `scripts/bootstrap-main-stack.mjs`
- `infrastructure/aws/eg-tsx-stack.yaml`
- `infrastructure/aws/run-config.example.cmd`
- `infrastructure/aws/run-config.cmd`
- `config/data/categories.json`
- `config/data/cache-cdn.json`
- `config/data/image-defaults.json`

See also:

- [System Map](../03-architecture/system-map.md)
- [Database Schema](../03-architecture/data-model.md)
- [Routing and GUI](../03-architecture/routing-and-gui.md)

## Configuration surface summary

EG-TSX currently uses four configuration layers:

1. Build and public runtime env read by Astro and shared config modules.
2. Server runtime env read by Lambda-backed auth, search, and data routes.
3. Deployment env read by the AWS bootstrap and deploy scripts.
4. File-backed contracts under `config/data/**` plus `src/content.config.ts`.

## Build and shared-runtime env

| Variable | Purpose | Source of truth | Defined in | Consumed in | Classification |
|---|---|---|---|---|---|
| `PUBLIC_SITE_URL` | Canonical site URL for Astro `site`, SEO helpers, and validators | `.env.example`, external build env | `.env.example` | `astro.config.mjs`, `src/core/config.ts`, `src/pages/brands/[...slug].astro`, `scripts/validate-seo-sitemap.mjs`, `scripts/validate-route-graph.mjs`, `scripts/deploy-aws.mjs` | Build-time public |
| `CDN_BASE_URL` | Optional CDN prefix for image URLs outside local dev | `.env.example`, external runtime or build env | `.env.example` | `src/core/config.ts` via `CONFIG.cdn.baseUrl` | Runtime/build-time public |
| `PUBLIC_ADS_ENABLED` | Enables live ad bootstrap instead of placeholders | `.env.example`, external build env | `.env.example` | `src/features/ads/resolve.ts`, `src/features/ads/bootstrap.ts` | Build-time public |
| `NODE_ENV` | Selects Astro build mode and controls runtime prod/dev behavior | external shell or Lambda env | CloudFormation Lambda env, process environment | `astro.config.mjs`, `src/core/config.ts`, `src/core/db.ts` | Build-time and runtime |

## Auth and session env

| Variable | Purpose | Source of truth | Defined in | Consumed in | Classification |
|---|---|---|---|---|---|
| `PUBLIC_COGNITO_REGION` | Cognito region for JWT verification, auth config, and DynamoDB region fallback | `.env.example`, CloudFormation parameter `CognitoRegion` | `.env.example`, `infrastructure/aws/eg-tsx-stack.yaml` | `src/features/auth/server/cognito-config.ts`, `src/features/auth/server/jwt.ts`, `src/features/vault/server/db.ts` | Runtime public |
| `PUBLIC_COGNITO_USER_POOL_ID` | Cognito User Pool ID for JWT issuer validation | `.env.example`, CloudFormation parameter `CognitoUserPoolId` | `.env.example`, `infrastructure/aws/eg-tsx-stack.yaml` | `src/features/auth/server/cognito-config.ts`, `src/features/auth/server/jwt.ts` | Runtime public |
| `PUBLIC_COGNITO_APP_CLIENT_ID` | Cognito app client ID for token exchange and JWT audience checks | `.env.example`, CloudFormation parameter `CognitoAppClientId` | `.env.example`, `infrastructure/aws/eg-tsx-stack.yaml` | `src/features/auth/server/cognito-config.ts`, `src/features/auth/server/jwt.ts`, `src/features/auth/server/token-exchange.ts`, `src/features/auth/server/refresh.ts` | Runtime public |
| `COGNITO_DOMAIN` | Hosted UI domain and token endpoint base | `.env.example`, CloudFormation parameter `CognitoDomain` | `.env.example`, `infrastructure/aws/eg-tsx-stack.yaml` | `src/features/auth/server/cognito-config.ts`, `src/features/auth/server/token-exchange.ts`, `src/features/auth/server/refresh.ts` | Runtime secret-adjacent server config |
| `COGNITO_CALLBACK_URL` | OAuth callback URL and redirect validation target | `.env.example`, CloudFormation parameter `CognitoCallbackUrl` | `.env.example`, `infrastructure/aws/eg-tsx-stack.yaml` | `src/features/auth/server/cognito-config.ts`, `src/features/auth/server/token-exchange.ts` | Runtime server config |
| `COGNITO_LOGOUT_URL` | Hosted logout redirect target | `.env.example`, CloudFormation parameter `CognitoLogoutUrl` | `.env.example`, `infrastructure/aws/eg-tsx-stack.yaml` | `src/features/auth/server/cognito-config.ts` | Runtime server config |
| `COGNITO_CLIENT_SECRET` | Optional Cognito app client secret for token exchange and refresh | `.env.example`, external runtime env only | `.env.example` | `src/features/auth/server/cognito-config.ts`, `src/features/auth/server/token-exchange.ts`, `src/features/auth/server/refresh.ts`, `src/features/auth/server/oidc.ts` | Runtime secret |
| `AUTH_STATE_SECRET` | Optional HMAC secret for signed OIDC state, falling back to `COGNITO_CLIENT_SECRET` when absent | external runtime env only | external secret injection only | `src/features/auth/server/oidc.ts` | Runtime secret |

## Data and server runtime env

| Variable | Purpose | Source of truth | Defined in | Consumed in | Classification |
|---|---|---|---|---|---|
| `DATABASE_URL` | PostgreSQL connection string for search mirror setup, sync, and queries | `.env.example`, CloudFormation Lambda env | `.env.example`, `infrastructure/aws/eg-tsx-stack.yaml` | `src/core/db.ts`, `scripts/sync-db.mjs` | Runtime secret |
| `APP_ENV` | App environment marker used with `NODE_ENV` for DB SSL behavior | CloudFormation Lambda env | `infrastructure/aws/eg-tsx-stack.yaml` | `src/core/db.ts` | Runtime server config |
| `ADMIN_TOKEN` | Operator header gate for `/api/admin/db-setup` and `/api/admin/db-sync` | external runtime env only, with hardcoded fallback in code | external secret injection only | `src/pages/api/admin/db-setup.ts`, `src/pages/api/admin/db-sync.ts` | Runtime secret |
| `PORT` | Local port used by `lambda-entry.mjs` when proxying to the Astro standalone server | Lambda runtime or local process env | runtime process environment | `lambda-entry.mjs` | Runtime local or platform-provided |
| `DYNAMO_PROFILES_TABLE` | DynamoDB table name consumed by the vault server module | `.env.example`, external runtime env | `.env.example` | `src/features/vault/server/db.ts` | Runtime server config |
| `DYNAMODB_TABLE_NAME` | DynamoDB table name injected by the AWS stack into Lambda | CloudFormation parameter `DynamoDbTableName` | `infrastructure/aws/eg-tsx-stack.yaml` | CloudFormation env injection only; current app code does not read it directly | Deployment-specific runtime bridge |

## Deployment and operator env

| Variable | Purpose | Source of truth | Defined in | Consumed in | Classification |
|---|---|---|---|---|---|
| `AWS_REGION` | Primary AWS region for bootstrap and deploy scripts | `run-config*.cmd`, operator shell, CI env | `.env.example`, `infrastructure/aws/run-config.example.cmd`, `infrastructure/aws/run-config.cmd` | `scripts/deploy-aws.mjs`, `scripts/bootstrap-artifact-bucket.mjs`, `scripts/bootstrap-main-stack.mjs` | Deployment-only |
| `AWS_DEFAULT_REGION` | Fallback region when `AWS_REGION` is absent | external shell or CI env | external AWS CLI or shell env | `scripts/deploy-aws.mjs`, `scripts/bootstrap-artifact-bucket.mjs`, `scripts/bootstrap-main-stack.mjs` | Deployment-only fallback |
| `EG_TSX_PROJECT_NAME` | Logical project prefix for stack and artifact naming | `run-config*.cmd`, `.env.example` | `.env.example`, `infrastructure/aws/run-config.example.cmd`, `infrastructure/aws/run-config.cmd` | `scripts/deploy-aws.mjs`, `scripts/bootstrap-artifact-bucket.mjs`, `scripts/bootstrap-main-stack.mjs` | Deployment-only |
| `EG_TSX_ENVIRONMENT` | Deploy target such as `dev` or `prod` | `run-config*.cmd`, `.env.example` | `.env.example`, `infrastructure/aws/run-config.example.cmd`, `infrastructure/aws/run-config.cmd` | `scripts/deploy-aws.mjs`, `scripts/bootstrap-main-stack.mjs` | Deployment-only |
| `EG_TSX_STACK_NAME` | Explicit CloudFormation stack name override | `run-config*.cmd`, `.env.example` | `.env.example`, `infrastructure/aws/run-config.example.cmd`, `infrastructure/aws/run-config.cmd` | `scripts/deploy-aws.mjs`, `scripts/bootstrap-main-stack.mjs` | Deployment-only |
| `EG_TSX_ARTIFACT_BUCKET_STACK_NAME` | Bootstrap artifact-bucket stack name | `run-config*.cmd` or generated bootstrap config | `.env.example`, `infrastructure/aws/run-config.example.cmd`, `infrastructure/aws/run-config.cmd` | `scripts/bootstrap-artifact-bucket.mjs` | Deployment-only |
| `EG_TSX_ARTIFACT_BUCKET` | S3 bucket holding Lambda artifacts | `run-config*.cmd`, `.env.example` | `.env.example`, `infrastructure/aws/run-config.example.cmd`, `infrastructure/aws/run-config.cmd` | `scripts/deploy-aws.mjs`, `scripts/bootstrap-artifact-bucket.mjs`, `scripts/bootstrap-main-stack.mjs` | Deployment-only |
| `EG_TSX_ARTIFACT_PREFIX` | Key prefix for uploaded Lambda artifacts | `run-config*.cmd`, `.env.example` | `.env.example`, `infrastructure/aws/run-config.example.cmd`, `infrastructure/aws/run-config.cmd` | `scripts/deploy-aws.mjs` | Deployment-only |
| `EG_TSX_DATABASE_PASSWORD` | RDS admin password passed into the main stack | `run-config*.cmd`, `.env.example` | `.env.example`, `infrastructure/aws/run-config.example.cmd`, `infrastructure/aws/run-config.cmd` | `scripts/deploy-aws.mjs`, `scripts/bootstrap-main-stack.mjs` | Deployment secret |
| `EG_TSX_INVALIDATION_MAX_PATHS` | Max smart invalidation paths for deploys | `.env.example`, external deploy env | `.env.example` | `scripts/deploy-aws.mjs` | Deployment-only |
| `EG_TSX_ASSUME_ROLE_ARN` | Optional deploy role to assume before AWS operations | `.env.example`, external deploy env | `.env.example` | `scripts/deploy-aws.mjs`, `scripts/aws-operator.mjs` | Deployment secret-adjacent |
| `EG_TSX_ACTIVE_ASSUME_ROLE_ARN` | Internal marker storing the currently assumed deploy role | derived by deploy tooling | process env set by `scripts/aws-operator.mjs` | `scripts/aws-operator.mjs` | Deployment internal |
| `EG_TSX_TEMP_DIR` | Optional temp root for staging deploy artifacts | external deploy env only | external deploy env | `scripts/deploy-aws.mjs` | Deployment-only |
| `EG_TSX_BUILD_ID` | Explicit build identifier override | external deploy env only | external deploy env | `scripts/deploy-aws.mjs` | Deployment-only |
| `EG_TSX_STATIC_SCOPE` | Selects which static files are considered during deploy invalidation logic | external deploy env only | external deploy env | `scripts/deploy-aws.mjs` | Deployment-only |
| `EG_TSX_SYNC_MODE` | Controls sync behavior in the deploy pipeline | external deploy env only | external deploy env | `scripts/deploy-aws.mjs` | Deployment-only |
| `EG_TSX_INVALIDATION_MODE` | Controls CloudFront invalidation strategy | external deploy env only | external deploy env | `scripts/deploy-aws.mjs` | Deployment-only |
| `EG_TSX_EVENT_STREAM` | Enables verbose streamed deploy progress output | external deploy env only | external deploy env | `scripts/deploy-aws.mjs` | Deployment-only |
| `DEPLOY_COGNITO_REGION` | CloudFormation parameter source for Cognito region during deploy | external deploy env only | external deploy env | `scripts/deploy-aws.mjs` | Deployment-only |
| `DEPLOY_COGNITO_USER_POOL_ID` | CloudFormation parameter source for Cognito user pool ID | external deploy env only | external deploy env | `scripts/deploy-aws.mjs` | Deployment-only |
| `DEPLOY_COGNITO_APP_CLIENT_ID` | CloudFormation parameter source for Cognito app client ID | external deploy env only | external deploy env | `scripts/deploy-aws.mjs` | Deployment-only |
| `DEPLOY_COGNITO_DOMAIN` | CloudFormation parameter source for Hosted UI domain | external deploy env only | external deploy env | `scripts/deploy-aws.mjs` | Deployment-only |
| `DEPLOY_COGNITO_CALLBACK_URL` | CloudFormation parameter source for callback URL | external deploy env only | external deploy env | `scripts/deploy-aws.mjs` | Deployment-only |
| `DEPLOY_COGNITO_LOGOUT_URL` | CloudFormation parameter source for logout URL | external deploy env only | external deploy env | `scripts/deploy-aws.mjs` | Deployment-only |
| `DEPLOY_DYNAMODB_TABLE_NAME` | CloudFormation parameter source for the DynamoDB table name | external deploy env only | external deploy env | `scripts/deploy-aws.mjs` | Deployment-only |

## File-backed config contracts

| Surface | Purpose | Source of truth | Read by |
|---|---|---|---|
| `config/data/categories.json` | Category labels, colors, active flags, and collection membership | JSON file in repo | `src/core/category-contract.ts`, then `src/core/config.ts` and `src/content.config.ts` |
| `src/core/category-contract.ts` | Validation and derived category lists such as `activeProductCategoryIds` and `collectionEnumValues` | TypeScript contract over `categories.json` | content schemas, shared config, category-aware UI |
| `config/data/cache-cdn.json` | Cache policy names, page types, invalidation groups, and route target patterns | JSON file in repo | `src/core/cache-cdn-contract.ts`, then API/header code |
| `src/core/cache-cdn-contract.ts` | Zod validation and header builders for cache policy usage | TypeScript contract over `cache-cdn.json` | `src/pages/api/search.ts` and any route using cache helpers |
| `config/data/image-defaults.json` | Per-category image-view defaults and object-fit policy | JSON file in repo | `src/core/config.ts` via `imageDefaults()` and `viewObjectFit()` |
| `src/content.config.ts` | Astro content collections, loaders, and schemas for editorial content and `dataProducts` | TypeScript content registry | Astro build, sync scripts, product loaders |
| `infrastructure/aws/eg-tsx-stack.yaml` | Deployed AWS topology and Lambda runtime env injection | CloudFormation template | `scripts/deploy-aws.mjs`, deployed stack |
| `infrastructure/aws/run-config.example.cmd` | Operator example preset for deploy env variables | CMD file in repo | local deploy workflow |
| `infrastructure/aws/run-config.cmd` | Operator local deploy preset | CMD file in repo | local deploy workflow |

## Known divergences

### DynamoDB table-name mismatch

- The stack injects `DYNAMODB_TABLE_NAME` into Lambda.
- The vault server currently reads `DYNAMO_PROFILES_TABLE`.
- Result: the current code path only honors the deployed table name if some other runtime layer also provides `DYNAMO_PROFILES_TABLE`, or if the intended table is the fallback `eg_profiles`.

### Cognito client secret is supported by code, not by the current stack template

- `src/features/auth/server/cognito-config.ts`, `token-exchange.ts`, and `refresh.ts` all support `COGNITO_CLIENT_SECRET`.
- `infrastructure/aws/eg-tsx-stack.yaml` does not inject `COGNITO_CLIENT_SECRET`.
- Current interpretation: the app supports secret-backed Cognito clients, but the checked-in stack template does not currently wire that secret into Lambda.

## `.env.example` leftovers excluded from the live table

These names are still defined in `.env.example` but were not found in current implementation consumers during this audit, so they are intentionally excluded from the live config surface:

- `DYNAMO_USERNAMES_TABLE`
- `AFFILIATE_AMAZON`
- `AFFILIATE_BHPHOTO`
- `AFFILIATE_NEWEGG`
- `PUBLIC_GA_MEASUREMENT_ID`
- `MIGRATION_MODE`

## Validation notes

- Executed: `node scripts/validate-image-links.mjs`
- Not executed: full Astro build, because this pass was operating under an explicit instruction not to access `tools/`, and the repository-wide build configuration may widen file discovery beyond the audited surface
