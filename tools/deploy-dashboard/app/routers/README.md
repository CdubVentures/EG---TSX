# tools/deploy-dashboard/app/routers

## Purpose

HTTP and SSE boundary for the deploy dashboard. Router modules translate operator
actions into backend service calls and streamed command execution.

## Public API (The Contract)

- `build.py` - site publish and rebuild actions
- `cache.py` - cache purge endpoints
- `cdn.py` - CDN publish/flush and queue actions
- `db_sync.py` - remote search DB sync actions
- `deploy_history.py` - deploy history reads
- `infra_status.py` - infra and environment visibility
- `lambda_catalog.py` - lambda version/catalog reads
- `lambda_deploy.py` - lambda-only deploy actions
- `simulate.py` - fake change and simulation routes
- `status.py` - watcher and pending-file status
- `system_health.py` - machine/runtime health probe

## Dependencies

Allowed imports:

- `..services/*`
- `..main` app wiring helpers when needed
- FastAPI and Python standard library

Forbidden imports:

- Direct UI modules
- Ad hoc file persistence outside `services/`

## Mutation Boundaries

- May spawn subprocess-backed operator actions.
- May stream SSE responses to the UI.
- Persistent writes must go through service modules.

## Domain Invariants

- Routers define the HTTP/SSE contract only; they do not become persistence layers.
- Long-running operator work should stream progress instead of blocking silently.
