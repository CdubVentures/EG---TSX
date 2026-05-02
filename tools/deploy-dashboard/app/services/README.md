# tools/deploy-dashboard/app/services

## Purpose

Shared runtime helpers for the deploy dashboard backend. These modules own local
state persistence, watcher scans, command orchestration helpers, and machine
health snapshots.

## Public API (The Contract)

- `watcher.py` - repo file watching and pending-work derivation
- `runner.py` - subprocess execution helpers for operator actions
- `cdn_queue.py` - queued CDN work persistence and planning
- `deploy_history.py` - deploy history persistence helpers
- `fake_changes.py` - fake change generation for simulation/testing
- `system_health.py` - local machine and dependency health checks
- `ttl_cache.py` - small TTL cache utility

## Dependencies

Allowed imports:

- Python standard library
- Local runtime JSON files under `app/runtime/`
- AWS/local command outputs as needed by the service contract

Forbidden imports:

- React/UI modules
- Direct route-handler ownership

## Mutation Boundaries

- May write runtime JSON files under `app/runtime/`.
- May read the repo tree and command output.
- Must not mutate unrelated project files.

## Domain Invariants

- Persistent operator state is local-only and file-backed in `app/runtime/`.
- Services stay reusable across multiple route families.
- File watching and queue/history state are derived from the repo/runtime, not
  manually mirrored in the UI.
