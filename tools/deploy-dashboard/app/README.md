# tools/deploy-dashboard/app

## Purpose

Backend runtime for the local EG Deploy Dashboard. This boundary owns FastAPI
startup, route registration, SSE command orchestration, watcher state, and the
persisted operator-state files used by the dashboard.

## Public API (The Contract)

- `main.py`
  FastAPI app entrypoint, shell asset routes, settings routes, health route, and
  router mounting.
- `routers/`
  Route families for build, cache, CDN, DB sync, deploy history, infra status,
  lambda deploy/catalog, simulate, status, and system health.
- `services/`
  Runtime helpers for watcher state, CDN queue persistence, deploy history,
  fake changes, command running, system health, and TTL caching.
- `launcher.pyw`
  Native launch entrypoint for the dashboard backend.

## Dependencies

Allowed imports:

- `tools/deploy-dashboard/app/routers/*`
- `tools/deploy-dashboard/app/services/*`
- `tools/deploy-dashboard/ui/*` only as static bundle assets
- Python standard library, FastAPI, and the documented local command/tool chain
- `../../scripts/*` deploy helpers and `../../src/*` server contracts where the
  dashboard intentionally mirrors site runtime state

Forbidden imports:

- Site UI internals
- Direct React component logic

## Mutation Boundaries

- May spawn local deploy/build/search-sync commands.
- May write `app/runtime/deploy_history.json` and `app/runtime/cdn_queue.json`.
- May read local repo state, AWS CLI output, and CloudFormation metadata.

## Domain Invariants

- The dashboard is local-operator tooling, not a deployed production app.
- UI code never shells out directly; command execution stays in backend routes/services.
- Pending work is derived from files and runtime markers, not treated as client-owned state.
