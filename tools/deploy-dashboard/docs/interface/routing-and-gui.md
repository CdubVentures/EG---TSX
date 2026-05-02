# Routing And GUI

## URL Surface

The dashboard is a single-page app with one visible route and a FastAPI API surface behind it.

| Path | Method | Owner | Purpose |
| --- | --- | --- | --- |
| `/` | `GET` | `app/main.py` | Serves the HTML shell with `#root` and `app.bundle.js` |
| `/app.bundle.js` | `GET` | `app/main.py` | Serves the prebuilt React bundle |
| `/api/settings` | `GET`, `PUT` | `app/main.py` | Reads/writes persisted UI settings in `ui/settings.json` |
| `/api/health` | `GET` | `app/main.py` | Lightweight local health check and deploy-target summary |
| `/api/status` | `GET` | `app/routers/status.py` | Pending-file, marker, lambda, upload, and DB-sync state |
| `/api/build/*` | `POST` | `app/routers/build.py` | Site publish/rebuild and split static actions over SSE |
| `/api/cache/purge` | `POST` | `app/routers/cache.py` | Clears local caches and resets publish markers |
| `/api/cdn/invalidate` | `POST` | `app/routers/cdn.py` | Direct one-shot `/*` invalidation via AWS CLI |
| `/api/cdn/queue` | `GET` | `app/routers/cdn.py` | Reads persisted queued smart invalidations |
| `/api/cdn/invalidate/live` | `POST` | `app/routers/cdn.py` | Streams full CDN flush progress |
| `/api/cdn/publish/live` | `POST` | `app/routers/cdn.py` | Streams queued/specified smart invalidation progress |
| `/api/lambda/functions` | `GET` | `app/routers/lambda_catalog.py` | Reads live Lambda metadata from AWS |
| `/api/lambda/deploy` | `POST` | `app/routers/lambda_deploy.py` | Streams Lambda-only deploy progress |
| `/api/db/sync` | `POST` | `app/routers/db_sync.py` | Streams remote DB setup/upsert progress |
| `/api/deploy/history` | `GET` | `app/routers/deploy_history.py` | Reads recent persisted run history |
| `/api/infra/status` | `GET` | `app/routers/infra_status.py` | Reads stack outputs, Lambda metadata, and watcher-backed health state |
| `/api/system/health` | `GET` | `app/routers/system_health.py` | Reads local CPU, memory, disk, and cache metrics |
| `/api/simulate/*` | `GET`, `POST` | `app/routers/simulate.py` | Mounted simulation and demo routes used by tests and manual UI exercises |

## Client Rendering Model

- The dashboard UI is client-side React only. There is no SSR for the dashboard itself.
- `app/main.py` serves a static HTML shell and the built bundle.
- All live data arrives through JSON polling or SSE streams from FastAPI.
- The deployed EG-TSX public site is a separate runtime fronted by CloudFront and Lambda. The dashboard only talks to it indirectly through deploy scripts and the DB sync script.

## Tabs And Main Panels

### Primary tabs

- `terminal` - `Terminal Log`
- `lambda` - `Lambda Deploy`
- `matrix` - `Page Build Matrix`
- `categories` - `Category Rings`
- `s3sync` - `S3 Sync`
- `cdntab` - `CDN`

### Always-visible cards

- `Deployment Vitals`
- `S3 State & Sync`
- `Lambda Command Center`
- `Completion Summary`
- `Changed Files`
- `Infra Dependencies`
- `Server Health`
- `CDN Queue Log`

The dashboard has one shared shell, not per-route layouts. State is switched by active tab and active run mode rather than by URL changes.

## Action-To-Endpoint Map

| UI action | Endpoint | Notes |
| --- | --- | --- |
| Quick Publish | `POST /api/build/quick` | May degrade to `quick-sync-only` if only uploads are pending |
| Force Full Rebuild | `POST /api/build/full` | Purges local cache first, then runs full site sync and full invalidation |
| Astro Publish | `POST /api/build/astro-publish` | Build only, no static sync, no invalidation |
| Astro Rebuild | `POST /api/build/astro-rebuild` | Cleaner build path, no static sync, no invalidation |
| S3 Data Publish | `POST /api/build/s3-data-publish` | Upload-ready data-only sync, queues smart CDN work on success |
| S3 Data Rebuild | `POST /api/build/s3-data-rebuild` | Full data-only sync, queues smart CDN work on success |
| S3 Image Publish | `POST /api/build/s3-image-publish` | Upload-ready image-only sync, queues smart CDN work on success |
| S3 Image Rebuild | `POST /api/build/s3-image-rebuild` | Full image-only sync, queues smart CDN work on success |
| CDN Publish | `POST /api/cdn/publish/live` | Replays queued or explicit smart paths |
| CDN Flush | `POST /api/cdn/invalidate/live` | Runs the full invalidation manifest |
| Lambda Deploy | `POST /api/lambda/deploy` | Shared Lambda runtime only |
| DB Sync | `POST /api/db/sync` | Remote schema setup/upsert path |
| Cache Purge | `POST /api/cache/purge` | JSON response, no SSE |
| Simulate Changes | `POST /api/simulate/fake-changes` | Touches real files by mtime only |

## Polling And Persistence

| Surface | Endpoint | Timing |
| --- | --- | --- |
| Deploy target summary | `/api/health` | once on mount |
| Lambda catalog | `/api/lambda/functions` | once on mount |
| Infra status | `/api/infra/status` | once on mount |
| Pending-file status | `/api/status?summary=true` | every 10 seconds during active run phases, otherwise every 30 seconds |
| Deploy history | `/api/deploy/history` | every 15 seconds |
| Server health | `/api/system/health` | every 15 seconds |
| CDN queue | `/api/cdn/queue` | every 15 seconds |

Persisted client/server state:

- Theme settings persist through `/api/settings` into `ui/settings.json`.
- Deploy history persists in `app/runtime/deploy_history.json`.
- Queued CDN plans persist in `app/runtime/cdn_queue.json`.
- Pending work visibility persists through marker files in the EG-TSX repo.

## State Boundaries

- Client-owned ephemeral state: active tab, current terminal lines, current matrix rows, local animation/progress smoothing.
- Backend-owned persisted operator state: deploy history, CDN queue, marker files.
- Repo-backed truth: source files, build output, infrastructure template, launch scripts.
- AWS-backed truth: stack outputs, Lambda configuration, CloudFront invalidation state, RDS endpoint.

## Diagnostic And Test Surfaces

- `app/routers/simulate.py` is mounted under `/api/simulate/*` in the live dashboard app.
- These routes return fake status payloads, fake SSE streams, fake cache/CDN responses, and a real mtime-only fake-change action.
- The routes are referenced by `tests/test_gui_comprehensive.py` and are part of the current runnable dashboard process, even though the module docstring still frames them as dev-only.

## Cross-Links

- Topology: [../architecture/system-map.md](../architecture/system-map.md)
- Runtime config: [../runtime/environment-and-config.md](../runtime/environment-and-config.md)
- Observability: [../features/operator-observability.md](../features/operator-observability.md)
- Maintenance and diagnostics: [../features/maintenance-and-simulation.md](../features/maintenance-and-simulation.md)
- Site deploy flow: [../features/site-publish-and-rebuild.md](../features/site-publish-and-rebuild.md)

## Validated Against

- `app/main.py`
- `app/routers/build.py`
- `app/routers/cache.py`
- `app/routers/cdn.py`
- `app/routers/db_sync.py`
- `app/routers/deploy_history.py`
- `app/routers/infra_status.py`
- `app/routers/lambda_catalog.py`
- `app/routers/lambda_deploy.py`
- `app/routers/simulate.py`
- `app/routers/status.py`
- `app/routers/system_health.py`
- `ui/dashboard.jsx`
- `ui/settings.json`
