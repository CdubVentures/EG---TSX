# Light Theme Guide

> Reference for the active light-theme contract and verification checklist.
>
> **Last audited:** 2026-03-11

---

## How the Theme System Works

### Three layers

| Layer | Scope | Switches with theme? | Used by |
|-------|-------|---------------------|---------|
| **HBS font/layout vars** (`--font-size-*`, `--font-weight*`, `--identity-font`) | `:root` (global) | NO — not color-related | All components |
| **HBS color bridge vars** (`--section-*`, `--white-color-*`, `--grey-color-*`) | `[data-theme]` blocks | YES | Home page, legacy-ported components |
| **Theme tokens** (`--color-bg-*`, `--color-text-*`, `--color-brand-*`, `--nav-*`, `--auth-*`, `--card-*`) | `[data-theme]` blocks | YES | Page content, cards, navbar, dialogs |

### 4 defined themes (`global.css`)

| Theme | `data-theme` | `color-scheme` | `--color-bg-base` | Intent |
|-------|-------------|----------------|-------------------|--------|
| **Default** | `default` | `light` | `#f8f9fa` | Standard light mode (blue brand) |
| **Gaming** | `gaming` | `dark` | `#0a0a0f` | Dark mode (current default) |
| **Workstation** | `workstation` | `light` | `#f4f4f5` | Neutral light (teal brand) |
| **Review** | `review` | `light` | `#fffef7` | Warm light (amber brand) |

### Theme switching mechanism

- **SSR default:** `MainLayout.astro` prop `theme = 'default'` (light)
- **Settings store:** `$theme` atom defaults to `'dark'` — maps `light->default`, `dark->gaming`
- **localStorage key:** `eg-theme` stores the `data-theme` value (`'default'` or `'gaming'`)
- **Flash prevention:** Inline `<script>` in `<head>` reads localStorage and sets `data-theme` before first paint
- **Meta theme-color:** Updated to match `--color-bg-base` per theme

### User-facing toggle

- **Settings dialog:** `SettingsDialog` React island — theme toggle lives here
- **`setTheme(mode)`:** Updates atom + DOM attribute + localStorage + meta theme-color
- **`loadTheme()`:** Called on page load via MainLayout hydration script

---

## Context-Based Card Elevation (site-wide, non-negotiable)

This is the core light-theme layout system. It determines how card/panel backgrounds adapt based on their surrounding context. **Both halves of every page must follow this rule.**

### The problem

HBS components use `--section-dark-background-color` for cards, panels, accordions, and dropdowns (70+ references). In dark theme, this is `#1d2021` — works fine. In light theme, this single variable must serve two contexts:

1. **Cards on grey body canvas** — need to be WHITE (`#ffffff`) so they appear elevated
2. **Elements on white/bright sections** — need to be GREY (original value) for visual contrast

### The solution: CSS custom property cascading

Three rules in `global.css` handle this automatically:

```
[data-theme] block:     --section-dark-background-color: #f0f2f5  (original grey)
  body override:        --section-dark-background-color: #ffffff  (light themes only)
    .home-top-wrapper / .-on-white-bg:
                        --section-dark-background-color: var(--section-dark-bg-on-white)
                                                         (revert to original grey)
```

- **Level 1 — Theme block** defines the base value (`#f0f2f5` default, `#1d2021` gaming)
- **Level 2 — Body override** (light themes only): all 3 light themes set `--section-dark` to `#ffffff` on `body`. Dashboard cards, newsfeed wrapper, etc. become white on grey canvas.
- **Level 3 — White-bg revert**: `.home-top-wrapper` and `.-on-white-bg` revert `--section-dark` to original value via `--section-dark-bg-on-white`. Accordion categories, dropdowns, hero brand cards stay grey for contrast against white.
- **Gaming**: no body override fires. `--section-dark` stays `#1d2021` everywhere.

### Helper variable

`--section-dark-bg-on-white` stores the original theme-block value in every theme. It exists solely so the revert selectors can reference the "before body override" value:

| Theme | `--section-dark-bg-on-white` |
|-------|------------------------------|
| Default | `#f0f2f5` |
| Gaming | `#1d2021` (same as `--section-dark`, no-op) |
| Workstation | `#e4e4e7` |
| Review | `#f5f4e8` |

### How to add new white-bg sections

When building a new section with a white or very light background (`--section-darkestdarker` or similar) that contains elements using `--section-dark-background-color`:

1. Add class `.-on-white-bg` to the section wrapper
2. Cards/panels inside will automatically get the grey value for contrast
3. No additional CSS needed — the global rule in `global.css` handles it

```html
<section class="snapshot-hero -on-white-bg">
  <!-- elements using --section-dark will get grey, not white -->
</section>
```

### Visual summary (home page, default light theme)

```
body  (bg: #f8f9fa grey)
--section-dark = #ffffff  (body override)

  .home-top-wrapper  (bg: #ffffff white)  .-on-white-bg revert
  --section-dark = #f0f2f5  (original grey)

    [accordion] [dropdown] [brand cards]  -> grey bg, contrast on white

  Dashboard section  (bg: transparent -> grey body shows through)
  --section-dark = #ffffff  (inherited from body)

    [cards] [newsfeed]  -> white bg, elevated above grey canvas
```

### Card shadow tokens

Cards use `--card-shadow` for additional definition in light themes:

| Token | Gaming | Light themes |
|-------|--------|-------------|
| `--card-shadow` | `none` | `0 1px 3px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.06)` |
| `--card-shadow-hover` | `none` | `0 4px 12px rgba(0,0,0,0.1), 0 2px 4px rgba(0,0,0,0.06)` |
| `--card-container-bg` | `transparent` | `var(--section-dark-background-color)` |

---

## Per-Page Background System

### Body backgrounds (via `body:has()`)

| Page type | Selector | Background var | Default | Gaming |
|-----------|----------|---------------|---------|--------|
| Default | `body` | `--section-darkestdark` | `#f8f9fa` | `#121212` |
| Home | `body` | `--section-darkestdark` | `#f8f9fa` | `#121212` |
| Article | `body:has(.article)` | `--section-darkest` | `#f4f5f7` | `#161718` |
| Hub | `body:has(.card-rows)` | `--section-darkestdark` | `#f8f9fa` | `#121212` |

### Footer backgrounds (via `--eg-footer-background`)

Footer bg matches the page section it sits against:

| Page type | Selector | Footer bg var | Default | Gaming |
|-----------|----------|--------------|---------|--------|
| Default | `:root` | `--section-dark` | `#ffffff`* | `#1d2021` |
| Home | `body:has(.home-rail-anchor)` | `--section-darkestdarker` | `#ffffff` | `#080808` |
| Article | `body:has(.article)` | `--section-darkest` | `#f4f5f7` | `#161718` |
| Hub | `body:has(.card-rows)` | `--section-darkestdark` | `#f8f9fa` | `#121212` |

*Default footer uses body-overridden value of `--section-dark` in light themes.

## Component Light Theme Audit

### MainLayout Shell

| Element | Theme-aware? | Notes |
|---------|-------------|-------|
| `<html>` background | YES | `var(--color-bg-base)` |
| `<body>` background | YES | `var(--section-darkestdark-background-color)`. Per-page overrides via `body:has()`. |
| `<body>` text color | YES | `text-text-primary` Tailwind class |
| `color-scheme` | YES | Each theme block defines its own |
| `<meta theme-color>` | YES | Flash prevention script + `setTheme()` both update it |
| Focus rings | YES | `var(--color-brand)` |
| Scrollbar | YES | `var(--scrollbar-thumb/track)` — themed per block |
| Popover reset | YES | `background: transparent` — inherits |

**Verdict:** Fully light-theme ready.

### Navbar (Desktop)

The navbar uses per-theme `--nav-*` tokens. Each theme defines its own nav colors:

| Element | Theme-aware? | Notes |
|---------|-------------|-------|
| Navbar background | YES | `--nav-bg` — `#000000` (gaming), `#f0f2f5` (default), `#f4f4f5` (workstation), `#faf9f0` (review) |
| Nav text | YES | `--nav-text` — `#ffffff` (gaming), `#1a1a2e` (default) |
| Mega menu surfaces | YES | `--nav-surface-dark` — dark in gaming, light in light themes |
| Mega menu text | YES | `--white-color-1`, `--white-color-2` (bridge vars, theme-switched) |
| Category icons | YES | SVG mask with `--nav-text` background |
| Brand logo filter | YES | `--nav-brand-logo-filter` — `invert(1)` in gaming, `brightness(0)` in light |
| Nav shadow | YES | `--nav-shadow` — `none` (gaming), subtle box-shadow (light) |

**Verdict:** Navbar is fully light-theme ready with per-theme nav tokens.

### NavMobile (Hamburger Drawer)

| Element | Theme-aware? | Notes |
|---------|-------------|-------|
| Side menu background | YES | `--nav-surface-dark` — themed per block |
| Side menu text | YES | `--white-color-1` / `--white-color-2` (bridge vars) |
| Shade overlay | YES | `--color-bg-overlay` — themed per block |
| Accordion sub-menus | YES | Uses nav tokens |
| Auth state buttons | YES | Uses nav tokens |

**Verdict:** Mobile nav is light-theme ready.

### SiteFooter

| Element | Theme-aware? | Notes |
|---------|-------------|-------|
| Footer background | YES | `--eg-footer-background` — auto-switches via `body:has()` overrides in global.css |
| Footer text | YES | `--white-color-2` (bridge var — muted text in all themes) |
| Footer headings | YES | `--white-color-1` (bridge var) |
| Link hover | YES | `--site-start-color` / gradient text via `@supports background-clip:text` |
| Social icons | YES | `fill: currentColor` inherits from link color |
| Copyright bar border | YES | `--section-medium-background-color` (bridge var) |
| Logo wordmark | YES | Reuses `NavLogo.astro` with `:global()` size overrides |

**Verdict:** Light-theme ready via bridge vars + `--eg-footer-background` system.

### HomeHero

| Element | Theme-aware? | Notes |
|---------|-------------|-------|
| Hero background | YES | `--section-darkestdarker-background-color` (white in light) |
| Hero text | YES | `--white-color-1` — dark text in light, white in gaming |
| Stat buttons | YES | `--section-dark-background-color` — grey in hero (via `.home-top-wrapper` revert) |
| Brand cards | YES | `--section-dark-background-color` — grey in hero |
| Category accents | N/A | `--cat-*` work on any background |

**Verdict:** Light-theme ready via bridge vars + context-based elevation.

### TopProducts (Accordion + Slideshow)

| Element | Theme-aware? | Notes |
|---------|-------------|-------|
| Accordion bg | YES | `--section-dark-background-color` — grey on white hero (`.home-top-wrapper` revert) |
| Accordion text | YES | `--white-color-1` — dark text in light |
| Dropdown menus | YES | `--section-dark-background-color` — grey on white hero |
| Toggle buttons | YES | `--section-darkest-background-color` (themed per block) |
| Dividers/borders | YES | `--section-medium-background-color` (themed per block) |

**Verdict:** Light-theme ready via bridge vars + context-based elevation.

### DashboardLargeTile (cinematic card)

| Element | Theme-aware? | Notes |
|---------|-------------|-------|
| Desktop overlay bg | N/A | `rgba(8, 8, 8, 0.65)` — fixed dark, does NOT change with theme |
| Overlay title text | YES | `--color-text-on-accent` (always white on dark overlay) |
| Overlay content text | YES | `--color-text-on-accent` (always white on dark overlay) |
| Hover underline | YES | `--color-text-on-accent` on desktop; `--white-black-color-1` on mobile |
| Mobile card bg (≤1150px) | YES | `--section-dark-background-color` — white on grey body (body override) |
| Mobile title text | YES | `--white-black-color-1` (bridge var, reverts in ≤1150px query) |
| Mobile description | YES | `--grey-color-4` (bridge var) |
| Card shadow | YES | `--card-shadow` |

**Pattern:** Desktop uses fixed dark overlay → text MUST be `--color-text-on-accent`. Mobile becomes a themed card → text reverts to bridge vars in ≤1150px media query. See Rule 13.

**Verdict:** Light-theme ready. Dual-mode text handled via media query override.

### FeaturedScroller (Featured Reviews + Highlighted Guides)

| Element | Theme-aware? | Notes |
|---------|-------------|-------|
| Desktop overlay bg | N/A | `rgba(8, 8, 8, 0.65)` — fixed dark, does NOT change with theme |
| Overlay title text | YES | `--color-text-on-accent` (always white on dark overlay) |
| Overlay content text | YES | `--color-text-on-accent` (always white on dark overlay) |
| Hover underline | YES | `--white-black-color-1` (bridge var) |
| Mobile card bg (≤825px) | YES | `--section-dark-background-color` — white on grey body (body override) |
| Mobile title text | YES | `--white-black-color-1` (bridge var, reverts in ≤825px query) |
| Mobile content text | YES | `--white-color-1` (bridge var, reverts in ≤825px query) |
| Scroller card bg | YES | `--section-dark-background-color` — white on grey body (body override) |
| Scroller card shadow | YES | `--card-shadow` — subtle in light, none in gaming |
| Large tile shadow | YES | `--card-shadow` |
| Card dates | YES | `--grey-color-3` (bridge var) |
| Card titles | YES | `--white-color-1` (bridge var — cards sit on themed bg) |
| Arrow buttons | YES | `--section-dark-background-color` bg, `--white-color-1` icon color |
| Category filter tabs | YES | `data-product-color="true"` + `--card-color`/`--card-hover` inline styles |

**Pattern:** Same dual-mode as DashboardLargeTile — desktop uses fixed dark overlay → text MUST be `--color-text-on-accent`. Mobile ≤825px becomes a themed card → text reverts to bridge vars. Scroller cards use bridge vars throughout (no overlay).

**Verdict:** Light-theme ready. Dual-mode overlay text + context-based card elevation + card shadows.

### LatestNews (Latest News 4x4)

| Element | Theme-aware? | Notes |
|---------|-------------|-------|
| Top grid card bg | YES | `--section-dark-background-color` — white on grey body (body override) |
| Bottom feed card bg | YES | `--section-dark-background-color` — white on grey body (body override) |
| Card shadows | YES | `--card-shadow` / `--card-shadow-hover` — subtle in light, `none` in gaming |
| Card text (titles) | YES | `--white-color-1` (bridge var — dark in light, white in gaming) |
| Category tag text | YES | `catVar()` → `--cat-{category}` (global, works on any bg) |
| Date text | YES | `--grey-color-3` (bridge var) |
| Description text | YES | `--grey-color-4` (bridge var) |
| Hover underline (top) | YES | `--white-black-color-1` (bridge var) |
| Hover underline (feed) | YES | `--white-color-1` (bridge var) |

**Verdict:** Light-theme ready via bridge vars + context-based card elevation + card shadows.

### Dashboard

| Element | Theme-aware? | Notes |
|---------|-------------|-------|
| Dashboard cards | YES | `--section-dark-background-color` — white on grey body (body override) |
| Card shadows | YES | `--card-shadow` — subtle in light, none in gaming |
| Card text | YES | `--white-color-1` / `--white-black-color-1` (bridge vars) |
| Card dates | YES | `--grey-color-3` (bridge var) |
| Section titles | YES | `--white-black-color-1` — dark text in light |
| Dividers | YES | `--section-medium-background-color` (bridge var) |

**Verdict:** Light-theme ready via bridge vars + context-based elevation.

### NewsFeed (sidebar)

| Element | Theme-aware? | Notes |
|---------|-------------|-------|
| Feed title | YES | `--white-color-1` — dark text in light |
| Item titles | YES | `--white-black-color-1` — dark text in light |
| Item dates | YES | `--grey-color-3` (bridge var) |
| Dividers | YES | `--section-light-background-color` / `--section-medium-background-color` |
| Mobile wrapper bg | YES | `--section-dark-background-color` — white on grey body |
| Mobile card shadow | YES | `--card-shadow` |

**Verdict:** Light-theme ready via bridge vars + context-based elevation.

### Auth & Vault

| Element | Theme-aware? | Notes |
|---------|-------------|-------|
| Auth dialog | YES | Full `--auth-*` token system (24 tokens) |
| Settings dialog | YES | Same `--auth-*` tokens |
| Toggle / radio dots | YES | `--color-text-on-accent` (always white on gradient) |
| Vault mega menu | YES | Uses nav tokens |

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
Background:   #f8f9fa (base), #f0f2f5 (surface), #ffffff (elevated), #e8eaed (inset)
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
Background:   #f4f4f5 (base), #ececed (surface), #ffffff (elevated), #e4e4e7 (inset)
Text:         #18181b (primary), #52525b (secondary), #a1a1aa (muted), #ffffff (inverse)
Borders:      #d4d4d8 (normal), #a1a1aa (strong)
Brand:        #0f766e (teal), #0d6b63 (hover), #f0fdfa (surface), #0f766e (text)
Accent:       #7e22ce (base), #faf5ff (surface)
Scrollbar:    rgba(0,0,0,0.2) (thumb)
```

### Review (light)

```
Background:   #faf9f0 (base), #f5f4e8 (surface), #ffffff (elevated), #edece0 (inset)
Text:         #1c1917 (primary), #57534e (secondary), #a8a29e (muted), #ffffff (inverse)
Borders:      #e7e5e4 (normal), #d6d3d1 (strong)
Brand:        #b45309 (amber), #92400e (hover), #fffbeb (surface), #92400e (text)
Accent:       #0891b2 (cyan), #f0f9ff (surface)
Scrollbar:    rgba(0,0,0,0.15) (thumb)
```

---

## What Never Changes (global, theme-independent)

These variables live in `:root` and do **not** switch with `data-theme`.

| Variable group | Example | Why global |
|---------------|---------|-----------|
| Font system | `--font-size-14px: 1.27273rem` | Math-based, no color |
| Font aliases | `--identity-font`, `--logo-font1` | No color |
| Weight aliases | `--font-weight3` through `--font-weight9` | No color |
| Site gradient | `--site-gradient-start/end` | Seasonal, not per-theme |
| Category colors | `--cat-mouse`, `--cat-keyboard`, etc. | Accent colors work on any background |
| Nav layout | `--nav-height`, `--top-bar-H`, `--nav-z` | Size/position, no color |
| HBS spacing | `--border`, `--brand-accent`, `--letter-spacing` | Non-color values |
| Section spacing | `--section-gap: clamp(2.5rem, 2rem + 1.5vw, 4rem)` | Fluid vertical rhythm, no color |
| Layout widths | `--site-width: 1275px`, `--home-width: 1075px` | Fixed widths, no color |

---

## HBS Bridge Variables (theme-switched legacy)

### Why bridge instead of full migration

Home page components have **70+ references** to HBS color variables. Migrating every reference to semantic tokens is a large refactor. Instead:

1. **HBS color vars moved into `[data-theme]` blocks** — instant light theme support
2. **Shared components** (SectionDivider, AnnouncementBar) migrated to semantic tokens directly
3. **Future components** use semantic tokens; existing components migrate per-file over time

### Two categories of HBS vars

| Category | Location | Switches? | Examples |
|----------|----------|-----------|---------|
| **Font / layout** | `:root` (global) | NO | `--identity-font`, `--font-weight3`-`9`, `--font-size-*`, `--letter-spacing` |
| **Color** | `[data-theme]` blocks | YES | `--section-dark-background-color`, `--white-color-1`, `--grey-color-*`, `--success-color` |

### Color bridge vars (18 vars, 4 themes)

| Variable | Gaming | Default | Workstation | Review |
|----------|--------|---------|-------------|--------|
| `--section-darkestdarker-background-color` | `#080808` | `#ffffff` | `#fafafa` | `#fffef7` |
| `--section-darkestdark-background-color` | `#121212` | `#f8f9fa` | `#f4f4f5` | `#faf9f0` |
| `--section-darkest-background-color` | `#161718` | `#f4f5f7` | `#ececed` | `#f7f6ec` |
| `--section-dark-background-color` | `#1d2021` | `#f0f2f5`* | `#e4e4e7`* | `#f5f4e8`* |
| `--section-dark-bg-on-white` | `#1d2021` | `#f0f2f5` | `#e4e4e7` | `#f5f4e8` |
| `--section-dusk-background-color` | `#25292a` | `#e8eaed` | `#dcdce0` | `#edece0` |
| `--section-medium-background-color` | `#3A3F41` | `#e2e8f0` | `#d4d4d8` | `#e7e5e4` |
| `--section-light-background-color` | `#4d5557` | `#c8cdd3` | `#b4b4b8` | `#c8c4be` |
| `--white-color-1` | `#ffffff` | `var(--color-text-primary)` | `var(--color-text-primary)` | `var(--color-text-primary)` |
| `--white-color-2` | `#dddad5` | `var(--color-text-secondary)` | `var(--color-text-secondary)` | `var(--color-text-secondary)` |
| `--white-black-color-1` | `#ffffff` | `var(--color-text-primary)` | `var(--color-text-primary)` | `var(--color-text-primary)` |
| `--white-black-color-2` | `#dddad5` | `#6b7280` | `#71717a` | `#78716c` |
| `--grey-color-1` | `#cccccc` | `#374151` | `#3f3f46` | `#44403c` |
| `--grey-color-2` | `#bbbbbb` | `#6b7280` | `#71717a` | `#78716c` |
| `--grey-color-3` | `#b0b0b0` | `#718096` | `#a1a1aa` | `#a8a29e` |
| `--grey-color-4` | `#909090` | `#9ca3af` | `#a1a1aa` | `#a8a29e` |
| `--accent-color-3` | `#e65443` | `#e65443` | `#e65443` | `#e65443` |
| `--success-color` | `#00d26a` | `#16a34a` | `#16a34a` | `#16a34a` |

*`--section-dark-background-color` is context-scoped in light themes. Theme-block value shown; body override changes it to `#ffffff`. See "Context-Based Card Elevation" section.

### `--color-text-on-accent` token

`--white-color-1` has a dual-use problem:
- **Text on page backgrounds** (18 uses) — must flip to dark in light themes
- **Text on gradient/colored backgrounds** (5 uses) — must stay white always

**Solution:** `--color-text-on-accent: #ffffff` in all themes. All always-white usages:
- `AnnouncementBar.astro` (2 uses — text on gradient bar)
- `SettingsPanel.tsx` (1 use — "Sign up" button on gradient)
- `ToggleSwitch.tsx` (1 use — dot on gradient track)
- `RadioGroup.tsx` (1 use — dot on gradient radio)
- `DashboardLargeTile.astro` (3 uses — container, content panel, title text on dark `rgba()` overlay; desktop only, mobile reverts to bridge vars)
- `FeaturedScroller.astro` (3 uses — large tile container, content panel, title text on dark `rgba()` overlay; desktop only, mobile ≤825px reverts to bridge vars)

### Text color decision tree

When choosing a text color for a new element, follow this:

```
Q: What is the BACKGROUND behind this text?
│
├─ A theme-switched variable (bridge var or --color-bg-*)
│  └─ Use matching bridge var or semantic token
│     Examples: --white-color-1, --white-black-color-1, --color-text-primary
│     WHY: text flips with background — dark text on light bg, white text on dark bg
│
├─ A FIXED dark background (rgba overlay, gradient, --cat-* accent)
│  └─ Use --color-text-on-accent (#ffffff in ALL themes)
│     WHY: background doesn't change, so text must stay white always
│
├─ Inside an --auth-* dialog
│  └─ Use --auth-* text tokens (--auth-dialog-text, --auth-heading-text, etc.)
│     WHY: dialog has its own background system separate from page
│
└─ Inside the navbar
   └─ Use --nav-text or --nav-text-muted
      WHY: nav has its own per-theme token set
```

### Bridge var hierarchy (naming inversion)

The `--section-*` naming comes from HBS dark theme where "darkest" = most dark. In light themes the values are **inverted** — "darkestdarker" is the LIGHTEST (whitest) value:

```
Light themes (default):                    Dark theme (gaming):
darkestdarker  #ffffff   (whitest)         darkestdarker  #080808  (darkest)
darkestdark    #f8f9fa   (body canvas)     darkestdark    #121212  (body)
darkest        #f4f5f7   (article bg)      darkest        #161718  (article bg)
dark           #f0f2f5   (cards/panels)    dark           #1d2021  (cards/panels)
dusk           #e8eaed                     dusk           #25292a
medium         #e2e8f0   (borders)         medium         #3A3F41  (borders)
light          #c8cdd3   (dividers)        light          #4d5557  (dividers)
```

Both modes follow **lighter = more elevated**. The names are confusing but consistent across themes — `--section-dark` is always the "card surface" regardless of actual lightness.

---

## Testing Checklist

When the theme gate rule fires, test these scenarios:

1. **Set `data-theme="default"`** — verify light backgrounds, dark text, correct brand colors
2. **Set `data-theme="gaming"`** — verify dark backgrounds, light text (current behavior)
3. **Toggle via Settings** — verify smooth transition, no flash
4. **Check card elevation** — cards on grey body canvas should be WHITE; elements in white hero sections should be GREY
5. **Check card shadows** — `--card-shadow` visible in light themes, absent in gaming
6. **Open auth dialog in both themes** — dialog adapts (white bg in light, dark bg in dark)
7. **Check category accents** — `--cat-*` colors visible on both backgrounds
8. **Check scrollbars** — match theme
9. **Check focus rings** — `--color-brand` visible on both backgrounds
10. **Check borders** — `--color-border` / `--section-medium-background-color` sufficient contrast
11. **Check overlay text** — text on dark overlays (cinematic tiles, image captions) must be white in ALL themes. If text is dark on a dark overlay, the component is using bridge vars instead of `--color-text-on-accent`.

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

## Rules for Future Development

1. **Page content** MUST use theme tokens (`--color-bg-*`, `--color-text-*`, `--color-brand-*`) via Tailwind utilities OR HBS bridge vars (both theme-switch)
2. **Navbar** uses per-theme `--nav-*` tokens — light surfaces in light themes, dark in gaming
3. **Category accents** (`--cat-*`) are global and work on any background — no changes needed
4. **Never hardcode** hex color literals in page content — always use theme tokens or bridge vars
5. **Dialog components** use `--auth-*` tokens (not page-level tokens)
6. **Card shadows** defined per theme (`--card-shadow` / `--card-shadow-hover`) — use these for card elevation
7. **Test light theme** after every component milestone (AGENTS.md theme gate rule)
8. **Toggle/radio dots** use `--color-text-on-accent` — always white on gradient surfaces
9. **Context-based card elevation** — `--section-dark-background-color` is `#ffffff` on body in light themes. If your section has a white/bright bg and contains elements using `--section-dark`, add `.-on-white-bg` class to the section wrapper to revert cards to grey for contrast. Both halves of every page must follow this rule.
10. **Per-page body backgrounds** use `body:has()` selectors — see `global.css` body rules. Do not set body bg directly on components.
11. **Footer backgrounds** use `--eg-footer-background` with `body:has()` overrides — do not hardcode footer bg
12. **New white-bg sections** must add `.-on-white-bg` if they contain `--section-dark` elements — see "Context-Based Card Elevation" section
13. **Dark overlays on images** — if a component overlays content on a fixed dark bg (`rgba()`, gradient, or hex that does NOT change with theme), text must use `--color-text-on-accent` (always white). Bridge vars (`--white-color-1`) flip to dark in light themes = unreadable on dark overlay. If the component has a responsive breakpoint where the overlay becomes a themed card (like `DashboardLargeTile.astro` at ≤1150px), add bridge var overrides in the mobile media query so text adapts to the themed card bg. See the "Text color decision tree" section.

## File Map

| File | Role in theme system |
|------|---------------------|
| `src/styles/global.css` (theme switchboard) | 4 theme definitions with page + auth + nav + bridge + card tokens |
| `src/styles/global.css` (`@theme` block) | Registers tokens as Tailwind utilities |
| `src/styles/global.css` (`:root`) | HBS font/layout vars (non-color, theme-independent) |
| `src/styles/global.css` (body rules) | Per-page backgrounds via `body:has()` + context-based card elevation |
| `src/styles/nav-mobile.css` | Mobile nav drawer, hamburger, shade overlay, auth footer (extracted from global.css) |
| `src/styles/dialogs.css` | Auth + settings dialog animations, keyframes, backdrop (extracted from global.css) |
| `src/shared/layouts/MainLayout.astro` | `data-theme` attribute + theme flash prevention |
| `src/features/settings/store.ts` | `$theme` atom, `setTheme()`, `loadTheme()` |
| `src/features/settings/types.ts` | `ThemeMode = 'light' \| 'dark'` type |
| `config/data/categories.json` | SSOT for site colors + category colors |
| `docs/08-design-system/css-conventions.md` | Full CSS system reference |
| `docs/08-design-system/category-colors.md` | Category color derivation reference |
| `src/shared/layouts/SiteFooter.astro` | Footer — uses `--eg-footer-background` + bridge vars |
| `src/shared/ui/SectionDivider.astro` | Section heading — top margin uses `var(--section-gap)` |
| `src/shared/ui/SubSectionDivider.astro` | Sub-section line — top margin uses `var(--section-gap)` |
| `docs/08-design-system/css-conventions.md` | Full CSS system reference (includes `--section-gap` section 7) |
| `docs/08-design-system/category-colors.md` | Category color derivation reference |
| `docs/08-design-system/z-index-map.md` | Layer stack reference |
