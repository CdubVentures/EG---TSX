# config/lib

## Purpose

Shared reactive runtime primitives for the config app. This boundary owns the
single source of truth for config data, file watching, and shared helper state.

## Public API (The Contract)

- `config_store.py`
  Exports `ConfigStore`, the canonical owner of config keys, file-path mapping,
  derived category state, `get()`, `path_for()`, `preview()`, `save()`,
  `reload()`, `reload_all()`, `subscribe()`, `unsubscribe()`, and `notify()`.
- `config_watcher.py`
  Exports `ConfigWatcher`, the polling watcher that triggers store reloads.
- `data_cache.py`
  Shared read/cache helpers used by the config runtime.
- `shared.py`
  Small cross-panel helper definitions.

## Dependencies

Allowed imports:

- Python standard library
- `tkinter`
- `config/data/*.json`

Forbidden imports:

- `config/ui/*`
- `src/features/*`
- `tools/deploy-dashboard/*`

## Mutation Boundaries

- `ConfigStore.save()` may write the mapped files under `config/data/`.
- `ConfigWatcher` is read-only against the filesystem.
- No direct network or shell-command ownership.

## Domain Invariants

- `ConfigStore` is the single source of truth for config JSON in memory.
- Cross-panel live propagation must go through `preview()` plus subscriptions.
- Derived category state is rebuilt from `categories.json`, not duplicated by
  individual panels.
