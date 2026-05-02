# Environment And Config

## Resolution Rules

`app/config.py` resolves dashboard config in this order:

1. Process environment
2. `tools/deploy-dashboard/.env.deploy`
3. `infrastructure/aws/run-config.cmd` when a field explicitly falls back to it
4. Hard-coded defaults in `app/config.py`

`app/launcher.pyw` can override `DEPLOY_DASHBOARD_PORT` at runtime after it picks a free local port.

`../../scripts/deploy-aws.mjs` has its own precedence: command-line flags override hydrated environment values from `.env.deploy` and `run-config.cmd`.

## Dashboard Local Config

| Variable | Purpose | Source of truth | Consumed by | Class |
| --- | --- | --- | --- | --- |
| `DEPLOY_PROJECT_ROOT` | Root of the EG-TSX repo the dashboard operates on | process env or `.env.deploy` | `app/config.py`, all backend routes through `AppConfig.project_root` | local runtime |
| `DEPLOY_SRC_DIR` | Source tree scanned for content, pages, and features | process env or `.env.deploy` | `app/config.py`, `services/watcher.py` | local runtime |
| `DEPLOY_PUBLIC_DIR` | Public assets root, especially `public/images` | process env or `.env.deploy` | `app/config.py`, `services/watcher.py` | local runtime |
| `DEPLOY_STATIC_OUTPUT_DIR` | Static build output, usually `dist/client` | process env or `.env.deploy` | `app/config.py`, `app/routers/build.py` | local runtime |
| `DEPLOY_DIST_DIR` | Optional override for the parent dist directory | process env or `.env.deploy` | `app/config.py` | local runtime |
| `DEPLOY_ASTRO_CACHE_DIR` | Astro cache path | process env or `.env.deploy` | `app/config.py`, `app/routers/cache.py`, `services/system_health.py` | local runtime |
| `DEPLOY_VITE_CACHE_DIR` | Vite cache path | process env or `.env.deploy` | `app/config.py`, `app/routers/cache.py`, `services/system_health.py` | local runtime |
| `DEPLOY_SYNC_MARKER_PATH` | Legacy site-level publish marker path | process env or `.env.deploy` | `app/config.py`, `services/watcher.py`, `app/routers/cache.py` | local runtime |
| `DEPLOY_SCRIPT_PATH` | Deploy script entrypoint, default `scripts/deploy-aws.mjs` | process env or `.env.deploy` | `app/config.py`, `app/routers/build.py`, `app/routers/cdn.py`, `app/routers/lambda_deploy.py` | local runtime |
| `DEPLOY_STACK_NAME` | Preferred CloudFormation stack name | process env or `.env.deploy` | `app/config.py`, `app/routers/infra_status.py`, `app/routers/lambda_catalog.py` | local runtime |
| `EG_TSX_STACK_NAME` | Fallback stack name if `DEPLOY_STACK_NAME` is absent | `run-config.cmd` | `app/config.py` fallback only | deployment-specific |
| `DEPLOY_S3_BUCKET` | Static bucket fallback shown to the dashboard and used by direct AWS calls | process env or `.env.deploy` | `app/config.py`, `app/main.py`, `app/routers/build.py`, `app/routers/cdn.py` | deployment-specific |
| `AWS_REGION` | AWS region | process env, `.env.deploy`, or `run-config.cmd` | `app/config.py`, all AWS-backed routes and scripts | deployment-specific |
| `AWS_DEFAULT_REGION` | Secondary region fallback | process env only | `app/config.py`, `../../scripts/deploy-aws.mjs` | deployment-specific |
| `DEPLOY_CLOUDFRONT_ID` | CloudFront distribution fallback shown in UI and used by direct invalidation calls | process env or `.env.deploy` | `app/config.py`, `app/routers/cdn.py`, `app/main.py` | deployment-specific |
| `DEPLOY_DASHBOARD_PORT` | Local FastAPI port | process env or `.env.deploy`; launcher may overwrite | `app/config.py`, `app/launcher.pyw` | local runtime |

## Deploy Script And Bootstrap Inputs

| Variable | Purpose | Source of truth | Consumed by | Class |
| --- | --- | --- | --- | --- |
| `EG_TSX_PROJECT_NAME` | Base project name used to derive stack defaults | `run-config.cmd` or external env | `../../scripts/deploy-aws.mjs`, `../../scripts/bootstrap-artifact-bucket.mjs` | deployment-specific |
| `EG_TSX_ENVIRONMENT` | Environment suffix, usually `prod` | `run-config.cmd` or external env | `../../scripts/deploy-aws.mjs` | deployment-specific |
| `EG_TSX_ARTIFACT_PREFIX` | Lambda artifact key prefix inside the artifact bucket | `run-config.cmd` or external env | `../../scripts/deploy-aws.mjs` | deployment-specific |
| `EG_TSX_ARTIFACT_BUCKET_STACK_NAME` | Artifact-bucket stack name for bootstrap only | `run-config.cmd` or external env | `../../scripts/bootstrap-artifact-bucket.mjs` | bootstrap-only |
| `EG_TSX_ARTIFACT_BUCKET` | Artifact bucket that stores Lambda zips | `run-config.cmd` or external env | `../../scripts/deploy-aws.mjs` | deployment-specific secret-adjacent |
| `EG_TSX_DATABASE_PASSWORD` | RDS password passed into CloudFormation stack deploys | `run-config.cmd` or external env | `../../scripts/deploy-aws.mjs` | secret |
| `EG_TSX_BUILD_ID` | Optional explicit build identifier override | external env or CLI only | `../../scripts/deploy-aws.mjs` | deployment-only |
| `EG_TSX_STATIC_SCOPE` | Optional default static scope (`site`, `data`, or `images`) | external env or CLI only | `../../scripts/deploy-aws.mjs` | deployment-only |
| `EG_TSX_SYNC_MODE` | Optional default sync mode (`quick` or `full`) | external env or CLI only | `../../scripts/deploy-aws.mjs` | deployment-only |
| `EG_TSX_INVALIDATION_MODE` | Optional default invalidation mode (`smart` or `full`) | external env or CLI only | `../../scripts/deploy-aws.mjs` | deployment-only |
| `EG_TSX_INVALIDATION_MAX_PATHS` | Optional smart invalidation cap | external env only | `../../scripts/deploy-aws.mjs` | deployment-only |
| `EG_TSX_TEMP_DIR` | Optional temp root for build staging | external env only | `../../scripts/deploy-aws.mjs` | local runtime |
| `EG_TSX_EVENT_STREAM` | Enables structured JSON event output for SSE parsing | set by dashboard subprocess env | `../../scripts/deploy-aws.mjs` | internal runtime |

## Stack Parameter Inputs Passed Through The Deploy Script

These are not resolved by `app/config.py`, but they are live deploy inputs because `../../scripts/deploy-aws.mjs` forwards them into CloudFormation parameter values.

| Variable | Purpose | Source of truth | Consumed by | Class |
| --- | --- | --- | --- | --- |
| `DEPLOY_COGNITO_REGION` | CloudFormation parameter `CognitoRegion` | `.env.deploy` or external env | `../../scripts/deploy-aws.mjs` -> `eg-tsx-stack.yaml` | deployment-specific |
| `DEPLOY_COGNITO_USER_POOL_ID` | CloudFormation parameter `CognitoUserPoolId` | `.env.deploy` or external env | `../../scripts/deploy-aws.mjs` -> `eg-tsx-stack.yaml` | deployment-specific |
| `DEPLOY_COGNITO_APP_CLIENT_ID` | CloudFormation parameter `CognitoAppClientId` | `.env.deploy` or external env | `../../scripts/deploy-aws.mjs` -> `eg-tsx-stack.yaml` | deployment-specific |
| `DEPLOY_COGNITO_DOMAIN` | CloudFormation parameter `CognitoDomain` | `.env.deploy` or external env | `../../scripts/deploy-aws.mjs` -> `eg-tsx-stack.yaml` | deployment-specific |
| `DEPLOY_COGNITO_CALLBACK_URL` | CloudFormation callback URL parameter and DB sync origin fallback | `.env.deploy` or external env | `../../scripts/deploy-aws.mjs`, `app/routers/db_sync.py`, `../../scripts/sync-db-remote.mjs` | deployment-specific |
| `DEPLOY_COGNITO_LOGOUT_URL` | CloudFormation logout URL parameter | `.env.deploy` or external env | `../../scripts/deploy-aws.mjs` -> `eg-tsx-stack.yaml` | deployment-specific |
| `DEPLOY_DYNAMODB_TABLE_NAME` | CloudFormation DynamoDB table-name parameter | `.env.deploy` or external env | `../../scripts/deploy-aws.mjs` -> `eg-tsx-stack.yaml` | deployment-specific |

## Lambda Runtime Variables Set By CloudFormation

| Variable | Purpose | Defined in | Consumed by | Class |
| --- | --- | --- | --- | --- |
| `APP_ENV` | Environment discriminator used with `NODE_ENV` for production DB SSL logic | `../../infrastructure/aws/eg-tsx-stack.yaml` | `../../src/core/db.ts` | runtime |
| `DATABASE_URL` | Postgres connection string | `../../infrastructure/aws/eg-tsx-stack.yaml` | `../../src/core/db.ts`, admin sync routes, search API | secret |
| `NODE_ENV` | Standard Node environment flag | `../../infrastructure/aws/eg-tsx-stack.yaml` | `../../src/core/db.ts` | runtime |
| `PUBLIC_COGNITO_REGION` | Runtime Cognito region | `../../infrastructure/aws/eg-tsx-stack.yaml` | auth server modules, vault DynamoDB client region | runtime |
| `PUBLIC_COGNITO_USER_POOL_ID` | Cognito pool ID | `../../infrastructure/aws/eg-tsx-stack.yaml` | auth server modules | runtime |
| `PUBLIC_COGNITO_APP_CLIENT_ID` | Cognito app client ID | `../../infrastructure/aws/eg-tsx-stack.yaml` | auth server modules | runtime |
| `COGNITO_DOMAIN` | Cognito domain | `../../infrastructure/aws/eg-tsx-stack.yaml` | auth server modules | runtime |
| `COGNITO_CALLBACK_URL` | Cognito callback URL | `../../infrastructure/aws/eg-tsx-stack.yaml` | auth server modules | runtime |
| `COGNITO_LOGOUT_URL` | Cognito logout URL | `../../infrastructure/aws/eg-tsx-stack.yaml` | auth server modules | runtime |
| `DYNAMODB_TABLE_NAME` | Stack-managed DynamoDB table name | `../../infrastructure/aws/eg-tsx-stack.yaml` | provisioned runtime env only; not read directly by audited vault code | runtime |

## Runtime Variables Consumed But Not Provisioned In The Audited Stack Template

| Variable | Purpose | Source of truth | Consumed by | Class |
| --- | --- | --- | --- | --- |
| `COGNITO_CLIENT_SECRET` | Optional OAuth client secret and OIDC signing fallback | external runtime env only | `../../src/features/auth/server/cognito-config.ts`, `refresh.ts`, `token-exchange.ts`, `oidc.ts` | secret |
| `AUTH_STATE_SECRET` | Preferred OIDC state-signing secret | external runtime env only | `../../src/features/auth/server/oidc.ts` | secret |
| `ADMIN_TOKEN` | Operator token for `/api/admin/db-setup` and `/api/admin/db-sync` | external runtime env only, else default fallback | `../../src/pages/api/admin/db-setup.ts`, `../../src/pages/api/admin/db-sync.ts`, `../../scripts/sync-db-remote.mjs` | secret-adjacent |
| `DYNAMO_PROFILES_TABLE` | Table name that the vault code actually reads | external runtime env only, else `eg_profiles` fallback | `../../src/features/vault/server/db.ts` | runtime |

## Known Mismatches And Gaps

- `.env.deploy.example` documents only the dashboard-local core keys. It does not template `DEPLOY_COGNITO_*`, `DEPLOY_DYNAMODB_TABLE_NAME`, or `DEPLOY_COGNITO_CALLBACK_URL`, even though the live deploy and DB sync flows consume them.
- The stack template exports `DYNAMODB_TABLE_NAME`, while the vault code reads `DYNAMO_PROFILES_TABLE`. The audited repo does not show those names being normalized.
- `ADMIN_TOKEN` defaults to `eg-setup-2026` both in the deployed admin routes and in `scripts/sync-db-remote.mjs`. If the live environment does not override it, the default remains active.

## Cross-Links

- Topology: [../architecture/system-map.md](../architecture/system-map.md)
- Data ownership: [../data/database-schema.md](../data/database-schema.md)
- Site and Lambda flows: [../features/site-publish-and-rebuild.md](../features/site-publish-and-rebuild.md), [../features/lambda-deploy.md](../features/lambda-deploy.md)
- DB sync feature: [../features/search-db-sync.md](../features/search-db-sync.md)
- Launch/bootstrap flow: [../operations/launch-and-bootstrap.md](../operations/launch-and-bootstrap.md)

## Validated Against

- `.env.deploy.example`
- `app/config.py`
- `app/launcher.pyw`
- `app/main.py`
- `app/routers/db_sync.py`
- `../../scripts/bootstrap-artifact-bucket.mjs`
- `../../scripts/deploy-aws.mjs`
- `../../scripts/sync-db-remote.mjs`
- `../../src/core/db.ts`
- `../../src/features/auth/server/cognito-config.ts`
- `../../src/features/auth/server/oidc.ts`
- `../../src/features/auth/server/refresh.ts`
- `../../src/features/auth/server/token-exchange.ts`
- `../../src/features/vault/server/db.ts`
- `../../src/pages/api/admin/db-setup.ts`
- `../../src/pages/api/admin/db-sync.ts`
- `../../infrastructure/aws/eg-tsx-stack.yaml`
- `../../infrastructure/aws/run-config.cmd`
