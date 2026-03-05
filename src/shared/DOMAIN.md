# src/shared — Domain

Reusable UI primitives and layout shells consumed by features and pages.
No business logic — purely presentational.

## Public API

### layouts/
- `MainLayout.astro` — document shell (head, meta, fonts, theme, auth hydration, category CSS vars)
- `GlobalNav.astro` — navbar orchestrator (composes NavLogo + NavLinks + NavIcons + MobileNav)
- `NavLinks.astro` — desktop nav links + mega menus + hover/click script
- `NavIcons.astro` — right-side icons (search, vault, user, settings) + vault mega-menu
- `NavLogo.astro` — wordmark logo with gradient hover
- `NavMobile.tsx` — React island for mobile side-menu (hamburger toggle + slide-in panel)

### ui/
- `AnnouncementBar.astro` — site-wide banner for promotions/announcements
- `SectionDivider.astro` — horizontal divider with title, subtitle, and action slot
- `DexaBadge.astro` — score badge component
- `dexa-badge-logic.mjs` — badge computation helpers

### lib/
- `cn.ts` — `clsx` + `tailwind-merge` class name helper

## Dependencies
- Imports from `@core/` (config, categories, images)
- Imports from `@features/auth` (barrel only — AuthDialog, hydration)
- Imports from `@features/settings` (SettingsDialog)
- Imports from `@features/vault` (VaultCount, VaultDropdown)

## Rules
- Features may import shared; shared must NOT import feature internals (barrel only)
- All components here must be themeable via CSS variables — no hardcoded colors
- Static components use `.astro`; interactive components use `.tsx` with hydration directives
