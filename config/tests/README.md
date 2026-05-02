# config/tests

## Purpose

`config/tests/` locks down config-manager behavior across the Python runtime,
React shell, panel save flows, and shared JSON contracts.

## Public API (The Contract)

- Python tests such as `test_launcher.py`, `test_config_store.py`,
  `test_categories_panel.py`, `test_navbar_panel.py`, and
  `test_content_panel.py` cover runtime orchestration and panel behavior.
- Node tests such as `test_cache_cdn_editor.mjs`, `test_ads_editor.mjs`,
  `test_image_defaults_editor.mjs`, and `test_save_orchestration.mjs` cover
  TS-side editor and save-contract behavior.

## Dependencies

Allowed imports:

- `config/app/*`
- `config/lib/*`
- `config/panels/*`
- `config/ui/*`
- `config/data/*`

Forbidden imports:

- Site runtime UI under `src/shared/*` or `src/pages/*` unless a test is
  explicitly exercising a documented shared contract

## Mutation Boundaries

- Tests may write temporary fixtures or mocks.
- Tests must not leave persistent mutations in `config/data/*`.

## Domain Invariants

- Save-orchestration and JSON contract tests are the safety net before config
  refactors.
- New tests should stay boundary-focused rather than duplicating implementation.
