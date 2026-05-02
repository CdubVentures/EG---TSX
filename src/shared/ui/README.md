# src/shared/ui

## Purpose

`src/shared/ui/` provides reusable presentational primitives that multiple pages
and features can compose without taking on feature ownership.

## Public API (The Contract)

- `AnnouncementBar.astro`
- `Breadcrumbs.astro`
- `DexaBadge.astro`
- `EditorsBadge.astro`
- `GameBadge.astro`
- `Pagination.astro`
- `PinTag.astro`
- `SectionDivider.astro`
- `SubSectionDivider.astro`
- `slider-init.ts`
  Exports `SliderOptions` and `initSlider()`.
- `dexa-badge-logic.mjs`
  Exports score-formatting helpers for the badge UI.

## Dependencies

Allowed imports:

- `@core/*`
- `@shared/lib/*`
- Astro and browser APIs

Forbidden imports:

- Feature-private modules
- `config/app/*`
- `tools/deploy-dashboard/*`

## Mutation Boundaries

- No filesystem, database, or network writes.
- Browser-only DOM setup is allowed for interactive primitives such as sliders.

## Domain Invariants

- Shared UI stays presentational and theme-token driven.
- Reusable primitives must not become ad hoc feature containers.
- Shared UI can depend on core contracts, but feature rules stay in features.

## Local Sub-Boundaries

- [tests/README.md](tests/README.md)
