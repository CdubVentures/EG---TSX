# src/shared/layouts

## Purpose

`src/shared/layouts/` owns the reusable site shell: document layout, global
navigation, footer, and shared navigation islands used across pages.

## Public API (The Contract)

- `MainLayout.astro`
  Site document shell, metadata, theme bootstrap, and top-level hydration hooks.
- `GlobalNav.astro`, `NavLinks.astro`, `NavIcons.astro`, `NavLogo.astro`
  Shared navbar composition pieces.
- `NavMobile.tsx`
  Mobile navigation island.
- `SiteFooter.astro`
  Shared footer shell.

## Dependencies

Allowed imports:

- `@core/*`
- `@shared/ui/*`
- Public exports from `@features/auth/*`, `@features/search/*`,
  `@features/settings/*`, `@features/notifications/*`, and `@features/vault/*`
- Astro, React, and browser APIs

Forbidden imports:

- Feature server internals
- `config/app/*`
- `tools/deploy-dashboard/*`

## Mutation Boundaries

- May subscribe to feature stores and toggle UI overlays.
- Must not write files, databases, or external services.

## Domain Invariants

- `MainLayout.astro` remains the shared shell composition root.
- Layouts stay mostly static `.astro`; use `.tsx` only for real client
  interaction.
- Layout code may compose feature public contracts, but it must not absorb
  feature business logic.

## Local Sub-Boundaries

- [tests/README.md](tests/README.md)
