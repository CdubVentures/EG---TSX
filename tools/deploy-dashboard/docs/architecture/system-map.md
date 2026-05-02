# System Map

The deploy dashboard is a local control plane for EG-TSX. It does not host the public site. It watches the local repository, shells into the EG-TSX deploy scripts, and surfaces live AWS/resource state back into the operator UI.

```mermaid
graph TD
  Operator[Operator]

  subgraph LocalDashboard[Local dashboard: tools/deploy-dashboard]
    Launcher[app/launcher.pyw<br/>or scripts/start-browser.cmd]
    FastAPI[app/main.py<br/>FastAPI + SSE]
    UI[ui/dashboard.jsx<br/>React SPA]
    Watcher[services/watcher.py<br/>files + markers]
    History[app/runtime/deploy_history.json]
    Queue[app/runtime/cdn_queue.json]
    Health[services/system_health.py]
  end

  subgraph Repo[EG-TSX working tree]
    Source[src/content, src/data,<br/>src/pages, src/features]
    Images[public/images]
    DeployScript[scripts/deploy-aws.mjs]
    Invalidation[scripts/invalidation-core.mjs]
    DbSync[scripts/sync-db-remote.mjs]
    StackTemplate[infrastructure/aws/eg-tsx-stack.yaml]
    RunConfig[infrastructure/aws/run-config.cmd]
  end

  subgraph AWS[AWS target system]
    Role[GodViewDeployRoleArn<br/>assumed by deploy script]
    Stack[CloudFormation stack]
    Bucket[S3 static bucket]
    CDN[CloudFront distribution]
    Lambda[Lambda SSR runtime<br/>+ Function URL]
    RDS[RDS PostgreSQL]
    DDB[DynamoDB vault table]
    Cognito[Cognito user pool/app]
  end

  subgraph LiveSite[Deployed EG-TSX runtime]
    SearchApi[/api/search]
    AdminApi[/api/admin/db-setup<br/>/api/admin/db-sync]
  end

  Operator --> Launcher
  Launcher --> FastAPI
  FastAPI --> UI
  UI <--> FastAPI
  FastAPI --> Watcher
  FastAPI --> History
  FastAPI --> Queue
  FastAPI --> Health
  Watcher --> Source
  Watcher --> Images
  FastAPI --> DeployScript
  FastAPI --> DbSync
  Queue --> Invalidation
  DeployScript --> RunConfig
  DeployScript --> StackTemplate
  DeployScript --> Invalidation
  DeployScript --> Role
  Role --> Stack
  DeployScript --> Bucket
  DeployScript --> CDN
  DeployScript --> Lambda
  Stack --> Bucket
  Stack --> CDN
  Stack --> Lambda
  Stack --> RDS
  Stack --> DDB
  Stack --> Cognito
  CDN --> Bucket
  CDN --> Lambda
  Lambda --> SearchApi
  Lambda --> AdminApi
  SearchApi --> RDS
  AdminApi --> RDS
  Lambda --> DDB
  Lambda --> Cognito
  DbSync --> AdminApi
```

## Control Plane Boundaries

- The browser never shells out directly. All command execution is backend-owned in `app/routers/*.py`.
- `app/main.py` serves a single HTML shell and `app.bundle.js`; the dashboard UI itself is client-rendered React.
- Long-running actions stream typed Server-Sent Events from FastAPI routes into the dashboard.
- The dashboard keeps local operator state in JSON files under `app/runtime/`; the public EG-TSX site does not read those files.

## Deploy and Runtime Ownership

- Site publish, split static publishes, CDN actions, and Lambda deploy all funnel through `../../scripts/deploy-aws.mjs` with different flags.
- Search database sync is separate. `app/routers/db_sync.py` runs `../../scripts/sync-db-remote.mjs`, which calls the deployed EG-TSX admin APIs over HTTP.
- The stack template provisions the static bucket, CloudFront distribution, shared Lambda SSR runtime, RDS PostgreSQL instance, and Cognito/Lambda environment wiring.
- `app/routers/infra_status.py` uses live CloudFormation outputs and live Lambda metadata, then merges that with local watcher state so the dashboard can show what is deployed and what is locally dirty.

## Local State That Drives the UI

- `services/watcher.py` compares source mtimes against marker files such as `.last_sync_success`, `.last_astro_build_success`, `.last_data_publish_success`, `.last_image_publish_success`, `.last_lambda_deploy_success`, and `.last_db_sync_success`.
- `services/deploy_history.py` persists up to 25 recent runs in `app/runtime/deploy_history.json`.
- `services/cdn_queue.py` persists queued smart invalidation plans in `app/runtime/cdn_queue.json` and rebuilds them through `ui/publish-cdn-plan.ts`.
- `services/system_health.py` reports local CPU, memory, disk, and cache usage for the sidebar.

## Cross-Links

- Config and env details: [../runtime/environment-and-config.md](../runtime/environment-and-config.md)
- Data ownership and schema details: [../data/database-schema.md](../data/database-schema.md)
- Dashboard routes and panel map: [../interface/routing-and-gui.md](../interface/routing-and-gui.md)
- Site deploy flow: [../features/site-publish-and-rebuild.md](../features/site-publish-and-rebuild.md)
- Search DB flow: [../features/search-db-sync.md](../features/search-db-sync.md)
- Operational launch path: [../operations/launch-and-bootstrap.md](../operations/launch-and-bootstrap.md)

## Validated Against

- `app/main.py`
- `app/config.py`
- `app/launcher.pyw`
- `app/routers/build.py`
- `app/routers/cdn.py`
- `app/routers/db_sync.py`
- `app/routers/infra_status.py`
- `app/services/cdn_queue.py`
- `app/services/deploy_history.py`
- `app/services/system_health.py`
- `app/services/watcher.py`
- `ui/dashboard.jsx`
- `../../scripts/deploy-aws.mjs`
- `../../scripts/invalidation-core.mjs`
- `../../scripts/sync-db-remote.mjs`
- `../../src/pages/api/admin/db-setup.ts`
- `../../src/pages/api/admin/db-sync.ts`
- `../../src/pages/api/search.ts`
- `../../infrastructure/aws/eg-tsx-stack.yaml`
- `../../infrastructure/aws/run-config.cmd`
