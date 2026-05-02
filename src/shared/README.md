# src/shared

## Purpose

`src/shared/` holds reusable layout shells, presentational UI primitives, and
small view helpers that multiple pages or features can consume.

## Public API (The Contract)

- `layouts/MainLayout.astro`
  Document shell: head/meta, theme bootstrap, auth/vault hydration hooks, and
  optional page JSON-LD.
- `layouts/GlobalNav.astro`, `NavLinks.astro`, `NavIcons.astro`, `NavLogo.astro`
  Navbar composition root and its static subcomponents.
- `layouts/NavMobile.tsx`
  Mobile navigation island.
- `layouts/SiteFooter.astro`
  Global footer.
- `ui/AnnouncementBar.astro`
- `ui/SectionDivider.astro`
- `ui/SubSectionDivider.astro`
- `ui/PinTag.astro`
- `ui/EditorsBadge.astro`
- `ui/DexaBadge.astro`
- `ui/dexa-badge-logic.mjs`
  `formatScore()`, `scoreLetterSpacing()`, `makeGradientId()`.
- `ui/slider-init.ts`
  `SliderOptions` and `initSlider()`.
- `lib/cn.ts`
  `cn()`.

## Dependencies

Allowed imports:

- `@core/*`
- `@shared/*`
- `@features/auth/*` public client modules and components used by layouts
- `@features/settings/*` public client modules and components used by layouts
- `@features/vault/*` public client modules and components used by layouts
- Astro, React, and browser APIs

Forbidden imports:

- Feature server internals
- Other feature private helpers when a public component/module already exists

## Mutation Boundaries

- No filesystem, database, or network writes.
- May read browser state needed for rendering/hydration.
- May open/close UI overlays and subscribe to feature stores.

## Domain Invariants

- Shared code stays presentational; business logic belongs in features or core.
- Static UI should stay in `.astro`; interactive UI belongs in `.tsx`.
- Shared components must remain themeable through CSS variables.
- Shared layouts may compose feature public APIs, but must not reach into
  feature internals.

## Local Sub-Boundaries

- [lib/README.md](lib/README.md)
- [layouts/README.md](layouts/README.md)
- [ui/README.md](ui/README.md)
