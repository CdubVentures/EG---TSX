# Light Theme Status & Guide

> Tracks light theme readiness for every migrated component.
> Updated after each phase/milestone. See AGENTS.md theme gate rule.
>
> **Last audited:** 2026-03-04

---

## How the Theme System Works

### Two layers (dark-always + theme-switchable)

| Layer | Scope | Switches with theme? | Used by |
|-------|-------|---------------------|---------|
| **HBS variables** (`--nav-*`, `--site-gradient-*`, `--cat-*`, `--font-size-*`) | `:root` (global) | NO — always dark | Navbar, footer, mega menus, category accents |
| **Theme tokens** (`--color-bg-*`, `--color-text-*`, `--color-brand-*`, `--radius-*`) | `[data-theme]` selector | YES | Page content, cards, hub grids, article layouts |
| **Auth tokens** (`--auth-*`) | `[data-theme]` selector | YES | Auth dialog, settings dialog, form controls |

### 4 defined themes (`global.css`)

| Theme | `data-theme` | `color-scheme` | `--color-bg-base` | Intent |
|-------|-------------|----------------|-------------------|--------|
| **Default** | `default` | `light` | `#ffffff` | Standard light mode |
| **Gaming** | `gaming` | `dark` | `#0a0a0f` | Dark mode (current default) |
| **Workstation** | `workstation` | `light` | `#fafafa` | Neutral light, teal brand |
| **Review** | `review` | `light` | `#fffef7` | Warm light, amber brand |

### Theme switching mechanism

- **SSR default:** `MainLayout.astro` prop `theme = 'default'` (light)
- **Settings store:** `$theme` atom defaults to `'dark'` — maps `light→default`, `dark→gaming`
- **localStorage key:** `eg-theme` stores the `data-theme` value (`'default'` or `'gaming'`)
- **Flash prevention:** Inline `<script>` in `<head>` reads localStorage and sets `data-theme` before first paint
- **Meta theme-color:** Updated to match `--color-bg-base` per theme

### User-facing toggle

- **Settings dialog:** `SettingsDialog` React island — theme toggle lives here
- **`setTheme(mode)`:** Updates atom + DOM attribute + localStorage + meta theme-color
- **`loadTheme()`:** Called on page load via MainLayout hydration script

---

## Resolved Issues (fixed 2026-03-04)

### 1. `color-scheme: dark` removed from `html` base rule

Was hardcoded on `html` — each `[data-theme]` block already defines its own `color-scheme` (light or dark). Removed the dead override so browser scrollbars and form controls respect the theme.

### 2. `body` background now uses theme token

Changed from `var(--section-darkestdark-background-color)` (always `#121212`) to `var(--color-bg-base)` (switches with theme).

### 3. Auth tokens moved to theme switchboard

All 24 `--auth-*` tokens now live inside the `[data-theme]` blocks with proper light/dark values. Workstation and review themes inherit from `:root` (default/light).

### 4. Auth/settings components de-hardcoded

All hardcoded hex values (`#1d2021`, `#e5e7eb`, `#9ba2ab`, `#6b7280`, `#101214`) replaced with `var(--auth-*)` token references across 8 component files.

### Remaining: SSR vs client default mismatch

- `MainLayout.astro` defaults to `theme = 'default'` (light)
- `$theme` atom defaults to `'dark'`
- On first visit (no localStorage), SSR renders light, then `loadTheme()` snaps to dark

**Low priority** — flash prevention script mitigates this. The real fix is aligning the SSR default to match the store default, but that's a UX decision (should new visitors see light or dark first?).

---

## Component Light Theme Audit

### Phase 4.1 — MainLayout Shell

| Element | Theme-aware? | Notes |
|---------|-------------|-------|
| `<html>` background | YES | Uses `var(--color-bg-base)` |
| `<body>` background | YES | Fixed: now uses `var(--color-bg-base)` |
| `<body>` text color | YES | `text-text-primary` Tailwind class → theme token |
| `color-scheme` | YES | Fixed: removed hardcoded dark, each theme block defines its own |
| `<meta theme-color>` | YES | Flash prevention script + `setTheme()` both update it |
| Focus rings | YES | `var(--color-brand)` — theme-switchable |
| Scrollbar track | YES | `var(--color-bg-inset)` |
| Scrollbar thumb | YES | `var(--scrollbar-thumb)` — defined in all 4 themes |
| Popover reset | YES | `background: transparent` — inherits from parent |

**Verdict:** MainLayout is fully light-theme ready.

### Phase 4.2 — Navbar (Desktop)

The navbar is **always dark** by design — it uses HBS variables (`--nav-*`) that never change with theme. This is correct and matches HBS behavior.

| Element | Theme-aware? | Notes |
|---------|-------------|-------|
| Navbar background | N/A (always dark) | `--nav-bg: #000000` — intentional |
| Nav text | N/A (always dark) | `--nav-text: #ffffff` |
| Mega menu backgrounds | N/A (always dark) | `--nav-surface-dark: #161718` |
| Mega menu text | N/A (always dark) | Uses `--white-color-1`, `--white-color-2` |
| Category icons | N/A (always dark) | SVG mask with `--nav-text` background |
| VanillaTilt game cards | N/A (always dark) | Inside mega menu, always dark context |
| SVG gradient fills | N/A (always dark) | `--site-gradient-start/end` are global, not themed |
| Sign-up / login buttons | N/A (always dark) | Navbar context |
| Account dropdown | N/A (always dark) | `z-index: 99560`, dark surface |

**Verdict:** Navbar is light-theme safe. No changes needed.

### Phase 4.3 — NavMobile (Hamburger Drawer)

| Element | Theme-aware? | Notes |
|---------|-------------|-------|
| Side menu background | N/A (always dark) | `--nav-surface-dark` — intentional |
| Side menu text | N/A (always dark) | `--white-color-1` / `--white-color-2` |
| Shade overlay | N/A (always dark) | `rgba(0,0,0,0.5)` fixed |
| Hamburger icon | N/A (always dark) | Inside navbar, always dark |
| Accordion sub-menus | N/A (always dark) | Inside side menu |
| Auth state buttons | N/A (always dark) | Login/signup in side menu |
| Border gradient | N/A (always dark) | Uses `--site-gradient-start/end` |

**Verdict:** Mobile nav is light-theme safe. No changes needed.

### Phase 9 (partial) — Auth & Vault

| Element | Theme-aware? | Notes |
|---------|-------------|-------|
| Auth dialog background | YES | `var(--auth-dialog-bg)` — white in light, `#1d2021` in dark |
| Auth dialog text | YES | `var(--auth-dialog-text)` — dark in light, `#e5e7eb` in dark |
| Auth dialog shadow | YES | `var(--auth-dialog-shadow)` — subtle in light, heavy in dark |
| Auth close button | YES | `var(--auth-close-color/hover)` — gray tones, appropriate per theme |
| Auth inputs | YES | `var(--auth-input-bg/border/text)` — light fields in light, dark in dark |
| Auth buttons | YES | `var(--auth-button-bg/border/hover/text)` — themed per mode |
| Auth branding panel | YES | `var(--auth-branding-bg)` — `#f0f2f5` (light) / `#25292a` (dark) |
| Auth headings | YES | `var(--auth-heading-text)` — dark in light, light in dark |
| Auth subtitles | YES | `var(--auth-subtitle-text)` — gray tones per theme |
| Auth dividers | YES | `var(--auth-divider)` — `#e2e8f0` (light) / `#38404b` (dark) |
| Auth errors | YES | `var(--auth-error)` — `#dc2626` (light) / `#f87171` (dark) |
| Auth legal text | YES | `var(--auth-legal-text/link)` — muted per theme |
| Settings dialog | YES | Same `--auth-*` token system as auth dialog |
| Settings sections | YES | `var(--auth-branding-bg)` + `var(--auth-divider)` border |
| Theme toggle track | YES | `var(--auth-settings-track)` — `rgba(0,0,0,0.08/0.3)` |
| Toggle / radio labels | YES | `var(--auth-heading-text)` — was `--white-color-2` |
| Toggle / radio descriptions | YES | `var(--auth-label-text)` — was `--grey-color-2` |
| Guest CTA | YES | `var(--auth-guest-border/bg)` — flips opacity direction |
| Guest badge | YES | `var(--auth-badge-bg)` + `var(--auth-subtitle-text)` |
| Vault mega menu | N/A (always dark) | Inside navbar context |
| Vault count badge | N/A (always dark) | Inside navbar context |

**Verdict:** Auth & Settings fully light-theme ready.

---

## Auth Token Reference (24 tokens)

### Default (light)

```
Dialog:       #ffffff (bg), #1a1a2e (text), 0 12px 32px rgba(0,0,0,0.12) (shadow)
Inputs:       #f5f6f8 (bg), #d1d5db (border), #1a1a2e (text)
Buttons:      #f0f2f5 (bg), #d1d5db (border), #e5e7eb (hover), #1a1a2e (text)
Labels:       #4a5568 (label), #0d0e12 (heading), #6b7280 (subtitle)
Chrome:       #f0f2f5 (branding), #e2e8f0 (divider), #9ca3af/#374151 (close/hover)
Feedback:     #dc2626 (error), #718096 (legal), #4a5568 (legal link)
Checkmark:    #ffffff (on green badge)
Settings:     rgba(0,0,0,0.08) (track), rgba(0,0,0,0.08/0.03/0.06) (guest border/bg/badge)
```

### Gaming (dark)

```
Dialog:       #1d2021 (bg), #e5e7eb (text), 0 12px 32px rgba(0,0,0,0.6) (shadow)
Inputs:       #111118 (bg), #38404b (border), #e5e7eb (text)
Buttons:      #1d2021 (bg), #38404b (border), #3A3F41 (hover), #e5e7eb (text)
Labels:       #9ba2ab (label), #e5e7eb (heading), #9ba2ab (subtitle)
Chrome:       #25292a (branding), #38404b (divider), #6b7280/#d1d5db (close/hover)
Feedback:     #f87171 (error), #9ba2ab (legal), #9ba2ab (legal link)
Checkmark:    #101214 (on green badge)
Settings:     rgba(0,0,0,0.3) (track), rgba(255,255,255,0.06/0.03/0.08) (guest border/bg/badge)
```

---

## Page-Level Token Reference (Light Themes)

### Default (light)

```
Background:   #ffffff (base), #f8f9fa (surface), #ffffff (elevated), #f0f2f5 (inset)
Text:         #0d0e12 (primary), #4a5568 (secondary), #718096 (muted), #ffffff (inverse)
Borders:      #e2e8f0 (normal), #cbd5e0 (strong)
Brand:        #2563eb (base), #1d4ed8 (hover), #eff6ff (surface), #1e40af (text)
Accent:       #7c3aed (base), #f5f3ff (surface)
Scores:       #16a34a (excellent), #ca8a04 (good), #ea580c (fair), #dc2626 (poor)
Semantic:     #16a34a (success), #ca8a04 (warning), #dc2626 (danger)
Scrollbar:    rgba(0,0,0,0.2) (thumb)
```

### Workstation (light)

```
Background:   #fafafa (base), #f4f4f5 (surface), #ffffff (elevated), #e4e4e7 (inset)
Text:         #18181b (primary), #52525b (secondary), #a1a1aa (muted), #ffffff (inverse)
Borders:      #d4d4d8 (normal), #a1a1aa (strong)
Brand:        #0f766e (teal), #0d6b63 (hover), #f0fdfa (surface), #0f766e (text)
Accent:       #7e22ce (base), #faf5ff (surface)
Scrollbar:    rgba(0,0,0,0.2) (thumb)
```

### Review (light)

```
Background:   #fffef7 (base), #faf9f0 (surface), #ffffff (elevated), #f5f4e8 (inset)
Text:         #1c1917 (primary), #57534e (secondary), #a8a29e (muted), #ffffff (inverse)
Borders:      #e7e5e4 (normal), #d6d3d1 (strong)
Brand:        #b45309 (amber), #92400e (hover), #fffbeb (surface), #92400e (text)
Accent:       #0891b2 (cyan), #f0f9ff (surface)
Scrollbar:    rgba(0,0,0,0.15) (thumb)
```

---

## What Never Changes (global, theme-independent)

These variables are **always dark** and do **not** switch with `data-theme`. This is by design — the navbar and footer are always dark.

| Variable group | Example | Why global |
|---------------|---------|-----------|
| Nav tokens | `--nav-bg: #000000`, `--nav-text: #fff` | Navbar is always dark |
| HBS background aliases | `--section-darkestdark-background-color: #121212` | Legacy navbar/footer use these |
| HBS text aliases | `--white-color-1: #fff`, `--grey-color-3: #b0b0b0` | Mega menu text, toggle/radio dots |
| Font system | `--font-size-14px: 1.27273rem` | Math-based, no color |
| Font aliases | `--identity-font`, `--logo-font1` | No color |
| Weight aliases | `--font-weight3` through `--font-weight9` | No color |
| Site gradient | `--site-gradient-start/end` | Seasonal, not per-theme |
| Category colors | `--cat-mouse`, `--cat-keyboard`, etc. | Accent colors work on any background |

---

## Testing Checklist (per component/milestone)

When the theme gate rule fires, test these scenarios:

1. **Set `data-theme="default"`** — verify light backgrounds, dark text, correct brand colors
2. **Set `data-theme="gaming"`** — verify dark backgrounds, light text (current behavior)
3. **Toggle via Settings** — verify smooth transition, no flash
4. **Open auth dialog in both themes** — verify dialog adapts (white bg in light, dark bg in dark)
5. **Check category accents** — `--cat-*` colors should be visible on both light and dark backgrounds
6. **Check scrollbars** — should match theme (light track on light, dark track on dark)
7. **Check focus rings** — `--color-brand` should be visible on both backgrounds
8. **Check shadows** — `--shadow-sm/md/lg` use `rgb(0 0 0 / ...)` — should be subtle on light, visible on dark
9. **Check border colors** — `--color-border` should provide sufficient contrast on both themes

### Browser DevTools shortcut

```js
// Toggle to light
document.documentElement.setAttribute('data-theme', 'default');

// Toggle to dark
document.documentElement.setAttribute('data-theme', 'gaming');

// Toggle to workstation
document.documentElement.setAttribute('data-theme', 'workstation');

// Toggle to review
document.documentElement.setAttribute('data-theme', 'review');
```

---

## Upcoming Components — Light Theme Considerations

These components have NOT been built yet. When they are, their light theme status must be added to this document.

| Phase | Component | Risk Level | Notes |
|-------|-----------|-----------|-------|
| 4.4 | GlobalFooter | LOW | Will use HBS dark vars (always dark, like navbar) |
| 4.6 | Adbar | MEDIUM | Text banner — must use theme tokens for background/text |
| 4.7 | Hero section | HIGH | H1/H2 text, stats — must contrast on both light and dark |
| 4.8 | SlideShow | HIGH | Product cards, rating bar — category accents on themed background |
| 4.9 | Tools section | MEDIUM | Links/icons on themed background |
| 4.10 | Dashboard grid | HIGH | News cards, sidebar — heavy content, must theme correctly |
| 4.11 | Game Gear Picks | MEDIUM | Card scroller — cards may need both dark and themed variants |
| 4.12 | Featured Reviews | HIGH | Category tabs + cards — accent colors on themed surface |
| 4.13 | Highlighted Guides | MEDIUM | Card scroller |
| 4.14 | Latest News 4x4 | MEDIUM | Card grid |
| 5.x | Snapshot Page | HIGH | Product detail — specs, metrics, images on themed background |
| 6.x | Hub Page | HIGH | Filter panels, product grid — heavy use of theme tokens |
| 7.x | Content Pages | MEDIUM | MDX rendered content — text on themed background |

---

## Rules for Future Development

1. **Page content** MUST use theme tokens (`--color-bg-*`, `--color-text-*`, `--color-brand-*`) via Tailwind utilities (`bg-bg-base`, `text-text-primary`, etc.)
2. **Navbar and footer** stay dark — use HBS variables (`--nav-*`, `--section-dark-*`)
3. **Category accents** (`--cat-*`, `--card-*`) are global and work on any background — no changes needed per theme
4. **Never hardcode** hex color literals in page content or dialog components — always use theme tokens or `--auth-*` tokens
5. **Dialog components** use `--auth-*` tokens (not page-level `--color-*` tokens, because the dialog has its own background)
6. **Shadows** defined in the theme switchboard (`--shadow-sm/md/lg`) — use these, not raw `box-shadow`
7. **Test light theme** after every component milestone (AGENTS.md theme gate rule)
8. **Toggle/radio dots** use `--white-color-1` intentionally — white on gradient is correct in both themes

---

## Files Changed (2026-03-04 audit)

| File | Changes |
|------|---------|
| `src/styles/global.css` | Added 24 `--auth-*` tokens to default + gaming theme blocks; removed old auth tokens from `:root`; removed `color-scheme: dark` from `html`; fixed `body` background to `var(--color-bg-base)`; added `--scrollbar-thumb` to workstation + review |
| `src/features/auth/components/AuthDialog.tsx` | Replaced `#1d2021`, `#e5e7eb`, `#6b7280`, `#d1d5db` with `var(--auth-*)` |
| `src/features/auth/components/LoginView.tsx` | Replaced `#e5e7eb`, `#9ba2ab`, `#101214` with `var(--auth-*)` |
| `src/features/auth/components/SignupView.tsx` | Replaced `#e5e7eb`, `#9ba2ab`, `#101214` with `var(--auth-*)` |
| `src/features/auth/components/ConfirmSignupView.tsx` | Replaced `#e5e7eb`, `#9ba2ab` with `var(--auth-*)` |
| `src/features/auth/components/ForgotPasswordView.tsx` | Replaced `#e5e7eb`, `#9ba2ab` with `var(--auth-*)` |
| `src/features/settings/components/SettingsDialog.tsx` | Replaced `#1d2021`, `#e5e7eb` with `var(--auth-*)` |
| `src/features/settings/components/SettingsPanel.tsx` | Replaced `--white-color-2`, `--grey-color-2`, `--grey-color-3`, `rgba(...)` with `var(--auth-*)` |
| `src/features/settings/components/RadioGroup.tsx` | Replaced `--white-color-2`, `--grey-color-3` with `var(--auth-*)` |

---

## File Map

| File | Role in theme system |
|------|---------------------|
| `src/styles/global.css` (theme switchboard) | 4 theme definitions with page tokens + auth tokens |
| `src/styles/global.css` (`@theme` block) | Registers page tokens as Tailwind utilities |
| `src/styles/global.css` (`:root`) | HBS variables — always-dark global tokens |
| `src/shared/layouts/MainLayout.astro` | Color derivation engine + theme flash prevention + `data-theme` attribute |
| `src/features/settings/store.ts` | `$theme` atom, `setTheme()`, `loadTheme()` |
| `src/features/settings/types.ts` | `ThemeMode = 'light' \| 'dark'` type |
| `config/categories.json` | SSOT for site colors + category colors (theme-independent) |
| `docs/CSS-CONVENTIONS.md` | Full CSS system reference |
| `docs/CATEGORY-COLORS.md` | Category color derivation reference |
| `docs/Z-INDEX-MAP.md` | Layer stack reference |
