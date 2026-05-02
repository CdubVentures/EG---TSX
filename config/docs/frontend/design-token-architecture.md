# Design Token Architecture

This file defines the non-drift UI contract for the React desktop port.

## Scope

- Applies to `config/ui/app.css`, `config/ui/app.tsx`, `config/ui/panels.tsx`, and `config/ui/shared-ui.tsx`.
- Baseline verified against Categories + Content as of `2026-03-12`.

## Layer Model

Use two token layers only.

1. Skin tokens (themeable):
- Colors: backgrounds, surfaces, borders, text, accents, statuses.
- Typography: families and weights.
- Geometry: radii, border widths.
- Elevation: shadows and z-layers.
- Icon styling: stroke widths and icon sizes.

2. Skeleton tokens (locked):
- Shell geometry and panel matrix density.
- Core spacing and row heights.
- Column widths and layout alignment.

The `legacy-clone` theme is the default and is the fidelity baseline.

## Theme Contract

- `legacy-clone` is a hard lock:
- `--radius-control: 0px`
- `--radius-surface: 0px`
- `--radius-dialog: 0px`
- `--shadow-none/card/dialog/toast: none`

- `arcade-neon` may override skin tokens only.
- Do not override skeleton tokens in `arcade-neon`.

## React Component Rules

- No hardcoded visual skin values in TSX for colors/fonts/shadows/radii.
- Dynamic styling must flow through CSS variables.
- Allowed inline styles are data-driven CSS custom properties (for category/content accents).

## Icon Theme Wiring

Theme-driven icon swapping is required.

- Sidebar nav icons:
- `app.tsx` uses `NAV_ICON_SETS` keyed by `IconThemeId`.

- Action/status icons:
- `shared-ui.tsx` uses `IconThemeContext` + `ICON_PATHS` for `Pin`, `Lock`, `Auto`, `Close`, `Star`.

- Category status indicators:
- `shared-ui.tsx` uses `CATEGORY_PREVIEW_PATHS` + `CategoryPreviewIcon`.
- `panels.tsx` consumes `CategoryPreviewIcon` (no local static icon switch).

## Token Coverage (Minimum)

Token groups that must exist and stay wired:

- Palette: `--color-*`, `--theme-site-*`, `--status-*`
- Typography: `--font-*`
- Geometry/elevation: `--border-width-*`, `--radius-*`, `--shadow-*`, `--z-*`
- Iconography: `--sidebar-icon-stroke-width`, `--inline-icon-stroke-width`, `--category-preview-icon-size`, `--category-preview-icon-stroke-width`
- Skeleton: `--sidebar-width`, `--context-height`, `--status-height`, `--card-grid-gap`, `--content-pool-row-height`, `--content-pool-type-col-width`

## Automated Guardrail

Use:

- `config/tests/test_design_token_architecture.py`

This test suite enforces:

- Required token coverage.
- Legacy flat-theme lock.
- No hardcoded TSX skin values.
- Theme-wired nav/action/status icon sets.
