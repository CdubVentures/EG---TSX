# tools/deploy-dashboard/tests

## Purpose

`tools/deploy-dashboard/tests/` covers the local deploy-dashboard app across its
Python runtime, UI composition, watcher logic, and TS helper modules.

## Public API (The Contract)

- Root Python tests such as `test_build_endpoints.py`, `test_gui_comprehensive.py`,
  `test_infra_status.py`, `test_watcher.py`, and `test_sidebar_panels.py`
  cover the dashboard runtime and UI behavior.
- `node/`
  Holds Node-based tests for TS helper/state modules used by the dashboard.

## Dependencies

Allowed imports:

- `../app/*`
- `../ui/*`
- `../scripts/*`
- Selected root deploy/core helpers when a test is verifying that integration

Forbidden imports:

- Site UI modules unrelated to deployment behavior

## Mutation Boundaries

- Tests may use temp fixtures, local fake publish streams, and isolated caches.
- Tests must not mutate live deploy infrastructure.

## Domain Invariants

- This boundary validates the operator tool itself, not the public EG - TSX site.
- Watcher and dashboard tests must preserve the distinction between simulated
  local activity and real deployment side effects.

## Local Sub-Boundaries

- [node/README.md](node/README.md)
