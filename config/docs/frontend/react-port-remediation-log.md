# React Config Port Remediation Log

## Scope

- Task: Baseline audit of the React desktop shell plus the Categories panel, then full port of the next sequential panel (`Content`).
- Canonical sources: `config/eg-config.pyw`, `config/panels/categories.py`, `config/panels/content.py`.
- Completion bar: audit defects closed, Content panel shipped, regression suites green.
- Current extension: end-to-end audit of continuous cross-panel preview propagation and saved-config-to-site flow for all React panels.
- Current contract: unsaved edits must propagate immediately to dependent panels in-app; saved edits must leave follow-up panel reads aligned with what the site will render from disk.

## Baseline Validation

- `python -m pytest config/tests/test_react_desktop_api.py config/tests/test_categories_panel.py config/tests/test_content_panel.py`
  - Status: PASS (`107 passed`)
- `node --import tsx --test test/config-data-wiring.test.mjs test/dashboard.test.mjs test/content-filter.test.mjs`
  - Status: PASS (`155 passed`)

## Open Audit Defects

- `A1` Shell geometry drift - **CLOSED** (design token architecture)
- `A2` Shell text and density drift - **CLOSED** (design token architecture)
- `A3` Categories live-preview wiring drift - **CLOSED**
- `A4` Categories content/status rendering drift - **CLOSED**
- `A5` Content panel missing from React - **CLOSED**
- `A6` Article Pool type-label drift - **CLOSED**
- `A7` Content color-coding drift (pool rows + dashboard tiles) - **CLOSED**
- `A8` Feed legend logic + token drift - **CLOSED**
- `A9` Categories preview propagation gap (Categories -> Content) - **CLOSED**
- `A10` Token architecture escape in shell logo - **CLOSED**
- `A11` Categories icon preview parity gap - **CLOSED**
- `A12` Hub Tools panel missing from React shell - **CLOSED**
- `A13` Hub Tools style inheritance drift - **CLOSED**
- `A14` Status icon theme-wiring and category icon token gap - **CLOSED**
- `A15` Index Heroes no-drift parity gap - **CLOSED**
- `A16` Brands slot-row drift in Index Heroes - **CLOSED**
- `A17` Navbar preview/save does not re-fetch Index Heroes in the React shell - **CLOSED**
- `A18` External watch cascades are incomplete for Categories -> Navbar and Navbar -> Index Heroes - **CLOSED**

## Current State

- Phase 1 baseline audit: CLEAN
- All 9 React panels shipped: `Categories`, `Content`, `Index Heroes`, `Hub Tools`, `Navbar`, `Slideshow`, `Image Defaults`, `Cache / CDN`, `Ads`
- Remaining known defects in audited scope: none

## Full Execution Log

- 2026-03-17: Re-ran the broader React desktop parity subset and full config suites. Baseline remained green.
- 2026-03-17: Verified the earlier suspected `Content -> Index Heroes` preview defect does not reproduce on the current runtime.
- 2026-03-17: Added regression coverage proving `Content` preview exclusions, pins, and badges propagate into `Index Heroes` before save.
- 2026-03-17: Updated stale React-port docs to reflect full 9-panel coverage and current save behavior.
- 2026-03-17: Began end-to-end preview/save flow audit against the real site contracts.
- 2026-03-17: Identified two new React shell parity defects:
- `A17`: `Navbar` preview/save does not re-fetch `Index Heroes`, so follow-up edits can operate on stale brand category state in-app.
- `A18`: `/api/watch` handling does not fully cascade external `Categories` changes into `Navbar` or external `Navbar` changes into `Index Heroes`.
- 2026-03-17: Added React shell contract tests covering:
- `Navbar` preview -> `Index Heroes`
- `Navbar` save -> `Index Heroes`
- global save queue `Navbar` -> `Index Heroes`
- external watch `Categories` -> `Navbar`
- external watch `Navbar` -> `Index Heroes`
- 2026-03-17: Patched `config/ui/app.tsx` so the React shell now re-fetches dependent panels on those paths.
- 2026-03-17: Moved theme preview swatch colors out of `app.tsx` into CSS tokens to restore design-token compliance.
- 2026-03-17: Verification complete:
- `python -m pytest config/tests` -> PASS (`377 passed`)
- `node --test config/tests/*.mjs` -> PASS (`217 passed`)
- `node --import tsx --test test/config-data-wiring.test.mjs test/dashboard.test.mjs test/content-filter.test.mjs test/config-react-baseline-audit.test.mjs test/config-react-desktop-port.test.mjs test/config-react-desktop-ui-contract.test.mjs test/category-ssot-contract.test.mjs test/cache-cdn-contract.test.mjs test/image-defaults.test.mjs test/hub-tools-filter.test.mjs test/navbar-characterization.test.mjs` -> PASS (`293 passed, 1 skipped`)
