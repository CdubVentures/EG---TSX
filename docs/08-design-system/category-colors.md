# Site Theme & Category Color System

## Overview

All site-wide and per-category colors are managed through a single JSON config. One hex value per slot drives 20+ derived CSS variables (accents, hovers, shadows, glows, gradients) via build-time HSL math. No hardcoded colors in CSS.

**Change a color in the Python GUI, save, restart dev server. Everything updates.**

---

## Source of Truth

**`config/data/categories.json`** contains two top-level keys:

```json
{
  "siteColors": {
    "primary": "#a6e3a1",
    "secondary": "#21c55e"
  },
  "categories": [
    {
      "id": "mouse",
      "label": "Mouse",
      "plural": "Mice",
      "color": "#00aeff",
      "product": { "production": true, "vite": true },
      "content": { "production": true, "vite": true },
      "collections": {
        "dataProducts": true,
        "reviews": true,
        "guides": true,
        "news": true
      }
    }
  ]
}
```

| Key | Purpose |
|-----|---------|
| `siteColors.primary` | Site gradient start, navbar accent, SVG gradient fills (`--site-color`) |
| `siteColors.secondary` | Site gradient end, brand highlight, CTA accents (`--brand-color`) |
| `categories[].color` | Per-category base hex for all `--cat-{id}-*` and `--card-*` variables |
| `categories[].product` | Toggles for product hub/vault visibility (production + vite flags) |
| `categories[].content` | Toggles for content visibility in reviews/guides/news |
| `categories[].collections` | Build contract for which Astro collections may legally reference the category |

---

## Site Color Variables (21 vars)

Derived from `siteColors.primary` (the "start" color). Secondary is set directly.

| CSS Variable | Source |
|---|---|
| `--site-color` | primary hex |
| `--brand-color` | secondary hex |
| `--site-accent` | HSL: L * 0.9 |
| `--site-dark-accent` | HSL: S * 0.4, L * 0.35 |
| `--site-hover` | HSL: L * 0.7 |
| `--site-gradientStart` | HSL: S * 0.85, L * 0.5 |
| `--site-highlight` | rgba(primary, 0.1) |
| `--site-glow` | rgba(soft, 0.8) |
| `--site-rgb` | r, g, b triplet |
| `--site-shadow-light` | 0 4px 8px rgba(soft, 0.2) |
| `--site-shadow-extra-light` | 0 2px 5px rgba(soft, 0.1) |
| `--site-shadow-strong` | 0 6px 12px rgba(primary, 0.4) |
| `--site-score-start` | primary hex |
| `--site-start-color` | primary hex |
| `--site-score-end` | secondary hex |
| `--site-end-color` | secondary hex |
| `--site-score-rgba` | rgba(primary, 1) |
| `--site-gradient-start` | primary hex |
| `--site-gradient-end` | secondary hex |
| `--site-gradient-text` | linear-gradient(to right, primary, secondary) |
| `--site-background-gradient` | linear-gradient(to right, primary, secondary) |

**Seasonal theming:** change `primary` and `secondary` in the GUI to red/green for Christmas, pastel for Easter, orange/black for Halloween. The entire site updates: navbar gradient, SVG `<linearGradient>` fills, sign-up button, CTA buttons, border accents, glow shadows.

### How SVGs consume site colors

SVG `<linearGradient>` defs reference CSS vars in inline styles:

```html
<linearGradient id="navbarThemeGradient" x1="0%" y1="0%" x2="100%" y2="0%">
  <stop offset="0%" style="stop-color: var(--site-gradient-start);" />
  <stop offset="100%" style="stop-color: var(--site-gradient-end);" />
</linearGradient>
```

CSS variables propagate through the DOM into SVG elements. Changing the JSON value changes every SVG gradient on the site.

---

## Category Color Variables (15 vars per category)

Per category `{id}`, the build generates these `:root` variables:

| CSS Variable | Derivation | HBS Equivalent |
|---|---|---|
| `--cat-{id}` | base hex | `--global-{id}-color` |
| `--cat-{id}-accent` | HSL: L * 0.9 | `--global-{id}-accent` |
| `--cat-{id}-dark` | HSL: S * 0.4, L * 0.35 | `--global-{id}-dark-accent` |
| `--cat-{id}-hover` | HSL: L * 0.7 | `--global-{id}-hover` |
| `--cat-{id}-gradient-start` | HSL: S * 0.85, L * 0.5 | `--global-{id}-gradientStart` |
| `--cat-{id}-highlight` | rgba(base, 0.1) | `--global-{id}-highlight` |
| `--cat-{id}-glow` | rgba(soft, 0.8) | `--global-{id}-glow` |
| `--cat-{id}-rgb` | r, g, b triplet | `--global-{id}-rgb` |
| `--cat-{id}-soft-rgb` | soft r, g, b triplet | *(no HBS equivalent)* |
| `--cat-{id}-shadow-light` | 0 4px 8px rgba(soft, 0.2) | `--global-{id}-shadow-light` |
| `--cat-{id}-shadow-xl` | 0 2px 5px rgba(soft, 0.1) | `--global-{id}-shadow-extra-light` |
| `--cat-{id}-shadow-strong` | 0 6px 12px rgba(base, 0.4) | `--global-{id}-shadow-strong` |
| `--cat-{id}-score-start` | alias of base | `--global-{id}-score-start` |
| `--cat-{id}-score-end` | HSL: L * 0.75 | `--global-{id}-score-end` |
| `--cat-{id}-score-rgba` | rgba(base, 1) | `--global-{id}-score-rgba` |

**15 variables x 10 categories = 150 CSS variables.**

### "Soft" Color

Used for glow and shadow-light/shadow-xl. Desaturated + lightened so glows don't blow out on dark backgrounds.

**Formula:** `HSL(h, s * 0.6, min(l * 1.15, 85))`

### Card-Level Indirection (`.{cat}-color` classes)

Components never reference `--cat-mouse-*` directly. A generated `.mouse-color` class maps category vars to generic `--card-*` names:

```css
.mouse-color {
  --card-color: var(--cat-mouse);
  --card-accent: var(--cat-mouse-accent);
  --card-dark-accent: var(--cat-mouse-dark);
  /* ... 15 total mappings ... */
}
```

Components use `--card-color`, `--card-accent`, etc. Apply the correct class (`mouse-color`, `keyboard-color`) to a parent element and all descendants pick up the right palette. Generated for all 10 categories automatically.

---

## Category Navbar Icons (SVG)

Each category has a navbar icon displayed in the mega-menu sidebar and vault dropdown.

### Convention

- **Location:** `public/images/navbar/{id}.svg`
- **Style:** 24x24 viewBox, stroke-based, stroke-width 2, rounded caps/joins, `fill="none" stroke="#000"`
- **Used as:** CSS `mask-image` on `.category-icon` elements. The SVG shape masks a solid `background-color`, so the icon inherits the text/accent color via CSS.

### Current icons (10 total)

| File | Visual | Category |
|------|--------|----------|
| `mouse.svg` | Capsule + scroll wheel | mouse |
| `keyboard.svg` | Rectangle + key dots + space bar | keyboard |
| `monitor.svg` | Screen + stand + base | monitor |
| `headset.svg` | Headphone arc + ear cups | headset |
| `mousepad.svg` | Rectangle + stitched edge line | mousepad |
| `controller.svg` | Pill body + D-pad + buttons | controller |
| `hardware.svg` | CPU chip + pins on 4 sides | hardware |
| `game.svg` | Crosshair (circles + lines) | game |
| `gpu.svg` | Card body + fan circles + bracket | gpu |
| `ai.svg` | 4-pointed sparkle + small sparkle | ai |

### How icons are wired

**CSS (NavLinks.astro):**
```css
.category-icon {
  width: 1.5em; height: 1.5em;
  background-color: var(--nav-text);
  mask-image: url('/images/navbar/{id}.svg');
  mask-size: contain;
}
.icon-mouse { mask-image: url('/images/navbar/mouse.svg'); }
/* ... one class per category ... */
```

**HTML:**
```html
<span class="category-icon icon-mouse" />
```

**Used in:** `NavLinks.astro` (guides/brands/hubs mega menus) and `VaultDropdown.tsx`.

### Adding a new icon

1. Create `public/images/navbar/{id}.svg` following the 24x24 stroke style
2. Add `.icon-{id}` class in `NavLinks.astro` pointing to the new SVG
3. The Categories panel in `config/eg-config.pyw` shows a red "MISSING ICON" flag for categories without an SVG — use it to verify

---

## SSOT Contract

### Shared category reader

`src/core/category-contract.ts` is now the only reader/validator for
`config/data/categories.json`. It:
- validates hex colors, duplicate IDs, route toggles, and `collections` keys
- exports active product/content category IDs
- exports `collectionEnumValues` for Astro content schemas
- provides shared helpers like `label()`, `plural()`, and `categoryColor()`

`src/core/config.ts` and `src/content.config.ts` both import this shared
contract, so category IDs no longer need to be copied into hand-maintained Zod
enums.

### Build-time behavior

`src/content.config.ts` derives its `z.enum(...)` values from
`collectionEnumValues`:

```typescript
import { collectionEnumValues } from './core/category-contract';

const categories = z.enum(collectionEnumValues.dataProducts);
const reviewCategories = z.enum(collectionEnumValues.reviews);
const guideCategories = z.enum(collectionEnumValues.guides);
const newsCategories = z.enum(collectionEnumValues.news);
```

If `categories.json` is malformed, missing `collections` metadata, or declares
invalid values, the shared contract throws during the Astro build instead of
allowing drift.

### Python GUI checks

The Categories panel in `config/eg-config.pyw` still provides the operational guardrails:
- Auto-discovers categories found on disk but missing from JSON
- Seeds auto-discovered `collections` flags from current product/article counts
- Shows a red warning for missing navbar SVG icons

Manual UI adds intentionally start with all `collections` flags set to `false`.
That keeps a future category inert until it is explicitly wired into product
JSON or editorial collections.

---

## How To: Add a New Category

1. **Add the category:** Use `pythonw config/eg-config.pyw` and open the Categories panel, or edit `config/data/categories.json` directly.
2. **Wire the collection contract:** Set `collections.dataProducts` / `reviews` / `guides` / `news` for the places that are allowed to reference the category.
3. **Set route flags:** Configure `product.*` and `content.*` for dev/production visibility.
4. **Create icon:** Add `public/images/navbar/{id}.svg` (24x24 stroke-based).
5. **Add CSS class:** Add `.icon-{id} { mask-image: url('/images/navbar/{id}.svg'); }` in `NavLinks.astro`.
6. **Verify:** Run `node --import tsx --test test/category-ssot-contract.test.mjs test/config-data-wiring.test.mjs` and `npm run build`.

## How To: Change Site Theme (Seasonal)

1. Open `pythonw config/eg-config.pyw` and switch to the Categories panel
2. Click the **Primary** or **Secondary** color swatch in the "Site Theme" row at the top
3. Pick new colors (e.g. red + green for Christmas)
4. **Ctrl+S** to save
5. Restart dev server — all gradients, SVGs, shadows update automatically

## How To: Change a Category Color

1. Open `pythonw config/eg-config.pyw` and switch to the Categories panel
2. Click the color swatch on any category card
3. Pick a new color — the derived preview updates live
4. **Ctrl+S** to save
5. Restart dev server — all `--cat-{id}-*` and `--card-*` variables update

---

## File Map

| File | Role |
|------|------|
| `config/data/categories.json` | SSOT: site colors + category definitions (color, route flags, collection contract, labels) |
| `config/eg-config.pyw` | Unified config app. The Categories panel edits site colors, category colors, route flags, icon status, counts, and collection metadata for auto-discovered categories |
| `config/eg-config.pyw` | The Navbar panel edits the mega-menu structure and reads category colors from JSON |
| `src/shared/layouts/MainLayout.astro` | Build-time: derives 21 site vars + 150 category vars + 10 card classes. Injects via `<style set:html>` |
| `src/styles/global.css` | No hardcoded site/category colors. Comments point to MainLayout.astro SSOT injection |
| `src/core/category-contract.ts` | Shared validator/reader for `categories.json`; exports active IDs and collection enum values |
| `src/core/config.ts` | Runtime config facade built from `category-contract.ts` |
| `src/content.config.ts` | Build-time Zod schemas derived from `category-contract.ts` |
| `src/shared/layouts/NavLinks.astro` | CSS: `.icon-{id}` mask-image classes for navbar icons |
| `public/images/navbar/{id}.svg` | SVG icon files (10 categories + house.svg for home) |
