# EG Deploy Dashboard Docs

This folder is the current documentation set for `tools/deploy-dashboard` only. It documents the local dashboard, the EG-TSX deploy/runtime surfaces that the dashboard drives, and the retained test artifacts that still matter to this tool.

## Scope

- The dashboard is a local FastAPI + React operator surface, not a deployed app.
- The dashboard controls the live EG-TSX deploy path implemented in `scripts/deploy-aws.mjs` and `scripts/sync-db-remote.mjs`.
- Historical planning notes and stale UI guides were removed when they no longer matched the live code.

## Table of Contents

### Audit

- [deletion-ledger.md](deletion-ledger.md) - Phase 0 classification of every audited doc that existed under `docs/`.

### Architecture, Runtime, and Data

- [architecture/system-map.md](architecture/system-map.md) - End-to-end deployment and runtime map for the local dashboard and the AWS resources it drives.
- [runtime/environment-and-config.md](runtime/environment-and-config.md) - Config precedence, live environment variables, and known config mismatches.
- [data/database-schema.md](data/database-schema.md) - Canonical content sources, remote database schema, local marker files, and persisted operator state.

### Interface

- [interface/routing-and-gui.md](interface/routing-and-gui.md) - Dashboard URL surface, API map, tabs, panels, polling, and client/server state boundaries.

### Features

- [features/site-publish-and-rebuild.md](features/site-publish-and-rebuild.md) - Quick publish, full rebuild, Astro publish, and Astro rebuild.
- [features/split-static-publishes-and-cdn-queue.md](features/split-static-publishes-and-cdn-queue.md) - Data/image publish and rebuild flows plus queued smart CDN plans.
- [features/cdn-actions.md](features/cdn-actions.md) - `CDN Publish` and `CDN Flush`.
- [features/lambda-deploy.md](features/lambda-deploy.md) - Lambda-only deploy workflow and version reporting.
- [features/search-db-sync.md](features/search-db-sync.md) - Remote schema setup and searchable content sync.
- [features/operator-observability.md](features/operator-observability.md) - Pending-file visibility, infra status, deploy history, and system health.
- [features/maintenance-and-simulation.md](features/maintenance-and-simulation.md) - Cache purge, fake changes, and mounted simulation routes.

### Operations and Validation

- [operations/launch-and-bootstrap.md](operations/launch-and-bootstrap.md) - Launch paths, startup checks, and one-time AWS bootstrap references.
- [validation/runtime-verification.md](validation/runtime-verification.md) - What was executed on March 11, 2026, what passed, and what was intentionally not run.

### Retained Artifacts

- [GUI-TEST-LEDGER.md](GUI-TEST-LEDGER.md) - Preserved March 7, 2026 GUI artifact ledger. This is historical, not the current source of truth.
- [sample-content/reviews/razer-viper-v3-pro.md](sample-content/reviews/razer-viper-v3-pro.md) - Retained review fixture.
- [sample-content/guides/best-gaming-mice-2026.md](sample-content/guides/best-gaming-mice-2026.md) - Retained guide fixture.
- [sample-content/news/march-deploy-readiness.md](sample-content/news/march-deploy-readiness.md) - Retained news fixture.
- [sample-content/data-products/mice/razer-viper-v3-pro.json](sample-content/data-products/mice/razer-viper-v3-pro.json) - Retained product fixture.
- [sample-content/status/changed-files.json](sample-content/status/changed-files.json) - Retained changed-files fixture.

### Supporting Entry Points

- [../README.md](../README.md) - Tool-level readme that now points back into this doc set.
- [../app/README.md](../app/README.md) - Backend runtime contract for the FastAPI app.
- [../scripts/README.md](../scripts/README.md) - launcher and simulation helper contract.
- [../tests/README.md](../tests/README.md) - dashboard verification boundary.

## Reading Order

1. Start with [architecture/system-map.md](architecture/system-map.md).
2. Read [runtime/environment-and-config.md](runtime/environment-and-config.md) and [data/database-schema.md](data/database-schema.md).
3. Use [interface/routing-and-gui.md](interface/routing-and-gui.md) to map operator actions to API surfaces.
4. Follow the feature docs for the exact run paths.
5. Check [validation/runtime-verification.md](validation/runtime-verification.md) before trusting older test artifacts.

## Validated Against

- `app/main.py`
- `app/config.py`
- `app/launcher.pyw`
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
- `app/services/cdn_queue.py`
- `app/services/deploy_history.py`
- `app/services/fake_changes.py`
- `app/services/system_health.py`
- `app/services/watcher.py`
- `ui/dashboard.jsx`
- `ui/publish-cdn-plan.ts`
- `ui/queued-cdn-state.ts`
- `ui/settings.json`
- `scripts/start-browser.cmd`
- `tests/test_gui_artifacts.py`
- `tests/test_gui_comprehensive.py`
- `tests/test_infra_status.py`
- `../../scripts/deploy-aws.mjs`
- `../../scripts/invalidation-core.mjs`
- `../../scripts/schema.sql`
- `../../scripts/sync-db-remote.mjs`
- `../../src/core/db.ts`
- `../../src/features/auth/server/cognito-config.ts`
- `../../src/features/auth/server/oidc.ts`
- `../../src/features/vault/server/db.ts`
- `../../src/pages/api/admin/db-setup.ts`
- `../../src/pages/api/admin/db-sync.ts`
- `../../src/pages/api/search.ts`
- `../../infrastructure/aws/eg-tsx-stack.yaml`
- `../../infrastructure/aws/RUN-ORDER.txt`
- `../../infrastructure/aws/run-config.cmd`
