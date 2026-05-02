# Deletion Ledger

This ledger records the Phase 0 audit of every Markdown file that existed under `tools/deploy-dashboard/docs/` before the rebuild.

## Retained

- `docs/GUI-TEST-LEDGER.md` - Retained because `tests/test_gui_artifacts.py` hard-codes this path and asserts specific headings and dated results. It was edited only to mark it as historical.
- `docs/sample-content/reviews/razer-viper-v3-pro.md` - Retained as a test and demo fixture referenced by `tests/test_gui_artifacts.py`.
- `docs/sample-content/guides/best-gaming-mice-2026.md` - Retained as a test and demo fixture referenced by `tests/test_gui_artifacts.py`.
- `docs/sample-content/news/march-deploy-readiness.md` - Retained as a test and demo fixture referenced by `tests/test_gui_artifacts.py`.
- `docs/sample-content/data-products/mice/razer-viper-v3-pro.json` - Retained as a test and demo fixture referenced by `tests/test_gui_artifacts.py`.
- `docs/sample-content/status/changed-files.json` - Retained as a test and demo fixture referenced by `tests/test_gui_artifacts.py`.

## Edited In Place

- `docs/GUI-TEST-LEDGER.md` - Added a status note pointing readers to current validation because the file describes a March 7, 2026 green run that no longer matches the March 11, 2026 suite status.
- `README.md` - Repointed the tool entrypoint away from the deleted UI guide and into the rebuilt doc tree.
- `app/README.md` - Rewrote the boundary note so it matches the current FastAPI + React dashboard and cross-links to the new docs.

## Replaced

- `docs/DASHBOARD-GUIDE.md` - Replaced by `docs/README.md`, `docs/interface/routing-and-gui.md`, and the feature docs because the old guide described stale panels, stale workflows, and obsolete assumptions.

## Deleted

- `docs/PLAN.md` - Deleted because it was a historical implementation plan, not current system truth.
- `docs/BUILD-PANELS-WIRING-LEDGER.md` - Deleted because it was a dated work ledger and no longer an authoritative description of the live dashboard.
- `docs/gui_test_master_prompt.md` - Deleted because it was prompt scaffolding, not maintained documentation.
- `docs/phases/PHASE-1-SCAFFOLD.md` - Deleted because it described an earlier build-out phase, not the current system.
- `docs/phases/PHASE-2-CACHE-PURGE.md` - Deleted because it documented an implementation phase rather than the live feature contract.
- `docs/phases/PHASE-3-FILE-WATCHER.md` - Deleted because it was a development note superseded by current code-backed docs.
- `docs/phases/PHASE-4-SSE-RUNNER.md` - Deleted because it was a development note superseded by current code-backed docs.
- `docs/phases/PHASE-5-BUILD-ENDPOINTS.md` - Deleted because it was a development note superseded by current code-backed docs.
- `docs/phases/PHASE-6-FRONTEND-WIRING.md` - Deleted because it was a development note superseded by current code-backed docs.
- `docs/phases/PHASE-7-INTEGRATION.md` - Deleted because it was a development note superseded by current code-backed docs.

## Unresolved Ambiguities

- `DYNAMODB_TABLE_NAME` is injected by CloudFormation into the Lambda runtime, but the audited vault code reads `import.meta.env.DYNAMO_PROFILES_TABLE` with a fallback of `eg_profiles`. The repo does not show a bridging layer that maps one name to the other, so the effective production table name cannot be proven from this tool alone.
- `DEPLOY_COGNITO_CALLBACK_URL` is consumed by `scripts/deploy-aws.mjs` and `scripts/sync-db-remote.mjs`, but it is not present in `.env.deploy.example`. The live value likely exists only in the real local `.env.deploy` file or external environment.
- `app/routers/simulate.py` is mounted in `app/main.py`, but the module docstring still says "DEV-ONLY - never enabled in production." The current code proves the routes are live in this dashboard process; intent beyond that is not documented in source.

## Major Divergences Found During Audit

- The live tool is `tools/deploy-dashboard`, a local FastAPI + React dashboard. Older docs still framed it as a replacement note for the retired `tools/god-view` flow without documenting the current runtime in detail.
- Split S3 publish actions do not invalidate CloudFront directly. They run `deploy-aws.mjs` with `--skip-invalidate`, then queue smart invalidation plans in `app/runtime/cdn_queue.json` for later `CDN Publish` or `CDN Flush`.
- Quick publish can degrade to a `quick-sync-only` path when no Astro rebuild is pending but static uploads still are.
- Full CDN invalidation is no longer documented as a blind `/*` operation in the live deploy path. `scripts/invalidation-core.mjs` builds curated full-site manifests, while the legacy one-shot `/api/cdn/invalidate` route still exists for direct AWS CLI calls.
- The infra sidebar is backed by live CloudFormation output reads, live Lambda metadata, and watcher-derived Lambda folders. Older placeholder panel language was stale.
- Search DB sync is a remote API upsert flow from local Markdown and JSON content into Postgres, not a local database migration system with versioned migrations.

## Validated Against

- `docs/GUI-TEST-LEDGER.md`
- `docs/sample-content/reviews/razer-viper-v3-pro.md`
- `docs/sample-content/guides/best-gaming-mice-2026.md`
- `docs/sample-content/news/march-deploy-readiness.md`
- `docs/sample-content/data-products/mice/razer-viper-v3-pro.json`
- `docs/sample-content/status/changed-files.json`
- `README.md`
- `app/README.md`
- `app/main.py`
- `app/routers/build.py`
- `app/routers/cdn.py`
- `app/routers/infra_status.py`
- `app/routers/simulate.py`
- `app/services/cdn_queue.py`
- `tests/test_gui_artifacts.py`
- `tests/test_gui_comprehensive.py`
