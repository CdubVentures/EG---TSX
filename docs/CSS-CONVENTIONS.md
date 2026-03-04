# CSS Conventions

> Single reference for the CSS system in EG-TSX.
> Covers the 11px base font, variable taxonomy, theme system, Tailwind pitfalls, and traps.
>
> **Last audited:** 2026-03-04

---

## 1. The 11px Base Font System

### How it works

The site uses a non-standard root font size that makes `1rem = 11px`:

```css
html {
  font-size: clamp(11px, 68.75%, 15px) !important;
}
```

**Why 68.75%?** Browser default is `16px`. `16 * 0.6875 = 11px`. The `clamp()` locks it between 11px and 15px, with 68.75% as the preferred value (which resolves to 11px on standard displays).

### Responsive scaling

At smaller viewports, the divisor changes to keep text readable:

| Breakpoint | Divisor | 1rem = | Formula |
|-----------|---------|--------|---------|
| > 600px | 11 | 11px | `X / 11 rem` |
| <= 600px | 10 | ~10px | `X / 10 rem` |
| <= 400px | 9 | ~9px | `X / 9 rem` |

### Font size variables

Every font size is a CSS variable. The variable name encodes the **intended pixel size**:

```css
:root {
  --font-size-8px: 0.72727rem;     /* 8 / 11 */
  --font-size-9px: 0.81818rem;     /* 9 / 11 */
  --font-size-10px: 0.90909rem;    /* 10 / 11 */
  --font-size-11px: 1rem;          /* 11 / 11 */
  --font-size-12px: 1.09091rem;    /* 12 / 11 */
  --font-size-13px: 1.18182rem;    /* 13 / 11 */
  --font-size-14px: 1.27273rem;    /* 14 / 11 */
  /* ... up to --font-size-80px: 7.27273rem */
}
```

### Fluid font size variables

Fluid `--ft-{max}-{min}` variables use `clamp()`:

```css
--ft-80-50: clamp(var(--font-size-50px), ..., var(--font-size-80px));
--ft-72-44: clamp(var(--font-size-44px), ..., var(--font-size-72px));
/* ... 40+ fluid size definitions */
```

Pattern: `--ft-{max}-{min}` clamps between the min and max font-size variables with a viewport-based preferred value.

### Rules

1. **NEVER use raw `rem` or `px` for font sizes.** Always use `var(--font-size-Xpx)`.
2. **NEVER use raw `rem` for icon/SVG sizing.** Use `var(--font-size-Xpx)` — SVGs use `height: 1em` with `font-size` on the container.
3. **When converting HBS CSS:** if you see `1.27273rem`, that's `14 / 11` -> use `var(--font-size-14px)`.
4. **Quick conversion:** multiply the rem value by 11 to get the pixel intent. Example: `2.54545rem * 11 = 28px` -> `var(--font-size-28px)`.

---

## 2. CSS Variable Taxonomy

### Site Identity (theme-dependent)

```css
/* Gradient endpoints — hover effects, borders, badges */
--site-gradient-start: #394cc8;
--site-gradient-end: #00aeff;

/* Aliases (both names are used interchangeably) */
--site-start-color: var(--site-gradient-start);
--site-end-color: var(--site-gradient-end);
--site-color: #394cc8;
--brand-color: #00aeff;
```

### Typography

```css
--identity-font: "Open Sans", ui-sans-serif, system-ui, sans-serif;
--logo-font1: "Futura", "Open Sans", ui-sans-serif, sans-serif;

/* Weight scale */
--font-weight3: 300;   /* Light */
--font-weight4: 400;   /* Regular */
--font-weight5: 500;   /* Medium */
--font-weight6: 600;   /* Semibold */
--font-weight7: 700;   /* Bold */
--font-weight8: 800;   /* Extrabold */
--font-weight9: 900;   /* Black */

--letter-spacing: 0px;
```

### Category Colors

Each product category has a brand color for hover states, borders, active indicators:

```css
--cat-mouse: #...;
--cat-keyboard: #...;
--cat-monitor: #...;
/* etc. — see CATEGORY-COLORS.md for full reference */
```

Card-level indirection:
```css
.mouse-color    { --card-color: var(--cat-mouse); }
.keyboard-color { --card-color: var(--cat-keyboard); }
```

### Navigation Tokens

```css
--nav-text: #ffffff;
--nav-surface: #23272e;                           /* Menu backgrounds */
--nav-surface-dark: #1a1d22;                      /* Active tab background */
--nav-surface-medium: #2e343b;                    /* CTA button background */
--nav-height: clamp(3.5rem, 3rem + 1vw, 4.5rem); /* Top bar height */
--nav-z: 95000;                                   /* See Z-INDEX-MAP.md */
```

### Surface Colors

```css
--white-color-1: #ffffff;
--section-dark-background-color: #1e2329;
--section-darkestdark-background-color: #121212;
```

---

## 3. Theme System

### How it works

4 themes via CSS variables in `global.css`. Theme is set by `data-theme` on `<html>`:

```html
<html data-theme="default">  <!-- or "gaming", "workstation", "review" -->
```

### Two-layer architecture

| Layer | Variables | Scope | Used by |
|-------|----------|-------|---------|
| **HBS variables** | `--nav-*`, `--site-gradient-*`, `--cat-*`, `--font-size-*`, `--identity-font` | Global (`:root`), never change with theme | Navbar, footer, always-dark components |
| **Theme tokens** | `--color-bg-*`, `--color-text-*`, `--color-brand-*`, `--radius-*` | Switch with `data-theme` | Page content, article layouts, hub grids, cards |

**Tailwind utilities** (`bg-bg-base`, `text-text-primary`, `rounded-md`) map to the theme tokens via the `@theme` block.

### What goes where

| Component type | CSS approach | Variables |
|---------------|-------------|-----------|
| Navbar (always dark) | Custom CSS in `<style is:global>` | HBS variables (`--nav-*`, `--font-size-*`) |
| Footer (always dark) | Custom CSS in `<style is:global>` | HBS variables |
| Page content sections | Tailwind utilities where possible | Theme tokens (`--color-*`) |
| Category accents | Either approach | `--cat-*` (global, work on any background) |
| Gradients/hover effects | Custom CSS | `--site-gradient-*` (global) |

### Theme gate rule

**After every component or milestone: STOP and test light theme.**

The navbar is always dark. Page content must render correctly in both light and dark themes.

---

## 4. Tailwind v4 Pitfalls

### Font shorthand + CSS variables: use longhands

**Rule:** Never use the CSS `font` shorthand with CSS variables in Tailwind arbitrary properties.

```tsx
// BAD — font shorthand with CSS variables
// If ANY variable fails, the ENTIRE declaration drops silently
className="[font:700_var(--ft-28-20)_var(--identity-font)]"

// GOOD — individual longhands, each fails independently
className="[font-weight:700] [font-size:var(--ft-28-20)] [font-family:var(--identity-font)]"
```

**Why it fails:** The `font` shorthand is a "pending-substitution value" until variables resolve at computed-value time. If the resolved string doesn't parse as a valid font shorthand, the entire property becomes invalid and falls back to inherited/initial values — **with no console error**.

### `font-[var(...)]` ambiguity

Tailwind v4's `font-[value]` maps to EITHER `font-family` or `font-weight` depending on the value type:

```tsx
// AMBIGUOUS — Tailwind guesses which CSS property you mean
className="font-[var(--identity-font)]"

// EXPLICIT — arbitrary property syntax, no ambiguity
className="[font-family:var(--identity-font)]"
className="[font-weight:700]"
```

**Rule:** Always use the explicit `[property:value]` syntax for font properties with CSS variables.

---

## 5. Shared CSS Classes vs Tailwind Utilities

When the same visual element appears in both Astro and React (e.g., the logo), use **global CSS classes**:

```css
/* global.css — single source of truth */
.site-name { font-family: var(--logo-font1); font-weight: 700; /* ... */ }
```

```astro
<!-- NavLogo.astro -->
<span class="site-name">...</span>
```

```tsx
// BrandLogo.tsx — same global classes, no Tailwind duplication
<span className="site-name">...</span>
```

---

## 6. Gradient Patterns

### Text gradient (hover effect)

```css
.element:hover {
  background: linear-gradient(to right, var(--site-gradient-start), var(--site-gradient-end));
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
}
```

### SVG gradient (icon hover)

Each nav icon has a unique `<linearGradient>` def with a numbered ID:

```html
<linearGradient id="navbarThemeGradient1" x1="0%" y1="0%" x2="100%" y2="0%">
  <stop offset="0%" style="stop-color: var(--site-gradient-start);" />
  <stop offset="100%" style="stop-color: var(--site-gradient-end);" />
</linearGradient>
```

**Why numbered IDs?** SVG gradient IDs must be unique in the document. Each icon gets its own gradient def (1-4).

---

## 7. Responsive Breakpoints

| Breakpoint | What changes |
|-----------|-------------|
| **1600px** | Sign-up button hides, Home icon hides, mega menus go full-width |
| **1150px** | Desktop nav hides, mobile nav appears, text labels on icons hide |
| **825px** | Logo layout changes to row, smaller font |
| **600px** | Font sizes shift to / 10 scale, icon sizes increase |
| **400px** | Font sizes shift to / 9 scale |

---

## 8. Animation & Transition Rules

### `display: none` kills transitions

Never toggle `display: none` on elements that animate. The browser has no "from" layout state to transition from.

```css
/* BAD — transitions won't work */
.side-menu { display: none; }
.side-menu.active { display: flex; }

/* GOOD — use visibility + position */
.side-menu {
  display: flex;
  visibility: hidden;
  left: -100%;
  transition: left 0.4s ease-in-out, visibility 0s linear 0.4s;
}
.side-menu.active {
  left: 0;
  visibility: visible;
  transition: left 0.4s ease-in-out, visibility 0s linear 0s;
}
```

The `visibility` transition timing trick: delay on close (0.4s) keeps the element visible during slide-out, instant on open (0s) makes it immediately visible for slide-in.

### Reflow trick for DOM-moved elements

After `appendChild` moves an element, the browser batches the move + class add into one paint, skipping transitions. Force a synchronous reflow between the move and the class change:

```javascript
document.body.appendChild(element);
element.getBoundingClientRect(); // force reflow
element.classList.add('open');   // now the transition animates
```

---

## 9. CSS Traps (learned during build)

### Trap: `position: relative` on `.sub-menu`

Adding `position: relative` to `.sub-menu` makes it a containing block. Mega menus (`position: absolute`) then get clipped by `.top-bar`'s `overflow-y: hidden`. Do NOT set position on `.sub-menu`.

### Trap: Stacking context escape

A child of `position: fixed` + `z-index` cannot paint below its parent. The only escape is to move the DOM element outside the parent tree (e.g., `appendChild` to `<body>`). See the mobile vault implementation in `NavLinks.astro`.

### Trap: Global vs scoped styles in Astro

Astro scoped styles add `data-astro-*` attributes that break class-based JS queries. Use `<style is:global>` when the dropdown script does DOM queries by class name.

### Trap: Dynamic CSS variables need fallbacks

Variables set by JavaScript have no value until JS runs:

```css
/* Bad: */
border-color: var(--navbar-guides-color);

/* Good: */
border-color: var(--navbar-guides-color, var(--cat-mouse));
```
