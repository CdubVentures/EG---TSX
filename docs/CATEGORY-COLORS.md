# Site Theme & Category Color System

## Overview

All site-wide and per-category colors are managed through a single JSON config. One hex value per slot drives 20+ derived CSS variables (accents, hovers, shadows, glows, gradients) via build-time HSL math. No hardcoded colors in CSS.

**Change a color in the Python GUI, save, restart dev server. Everything updates.**

---

## Source of Truth

**`config/categories.json`** contains two top-level keys:

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
      "content": { "production": true, "vite": true }
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
3. The Python category-manager.py shows a red "MISSING ICON" flag for categories without an SVG — use it to verify

---

## SSOT Drift Protection

### Build-time check (Zod enums)

`src/content.config.ts` has a build-time assertion:

```typescript
import categoriesJson from '../config/categories.json';
const jsonIds = new Set(categoriesJson.categories.map(c => c.id));
const newsEnumIds = new Set(newsCategories.options);
const missing = [...jsonIds].filter(id => !newsEnumIds.has(id));
if (missing.length > 0) {
  throw new Error(`[SSOT DRIFT] categories.json has IDs not in newsCategories enum...`);
}
```

If someone adds a category to the JSON but forgets to update the Zod enums, the build fails with a clear error.

**WHY hardcoded Zod enums?** `z.enum()` requires static string literals at compile time. The drift check is the safety net.

### Python GUI checks

`config/category-manager.py` auto-discovers categories from content frontmatter and flags:
- New categories found in `.md` files but missing from JSON (auto-added with defaults)
- Missing SVG icons per category (red triangle warning on card)

---

## How To: Add a New Category

1. **Add to JSON:** Open `python config/category-manager.py`, click "+ Add Category", enter ID/label/plural, pick a color
2. **Update Zod enums:** Add the new ID to the appropriate enum(s) in `src/content.config.ts` (`categories`, `reviewCategories`, `newsCategories`)
3. **Create icon:** Add `public/images/navbar/{id}.svg` (24x24 stroke-based)
4. **Add CSS class:** Add `.icon-{id} { mask-image: url('/images/navbar/{id}.svg'); }` in `NavLinks.astro`
5. **Verify:** `astro dev` — build should succeed, category manager should show green icon status

## How To: Change Site Theme (Seasonal)

1. Open `python config/category-manager.py`
2. Click the **Primary** or **Secondary** color swatch in the "Site Theme" row at the top
3. Pick new colors (e.g. red + green for Christmas)
4. **Ctrl+S** to save
5. Restart dev server — all gradients, SVGs, shadows update automatically

## How To: Change a Category Color

1. Open `python config/category-manager.py`
2. Click the color swatch on any category card
3. Pick a new color — the derived preview updates live
4. **Ctrl+S** to save
5. Restart dev server — all `--cat-{id}-*` and `--card-*` variables update

---

## File Map

| File | Role |
|------|------|
| `config/categories.json` | SSOT: site colors + category definitions (color, flags, labels) |
| `config/category-manager.py` | GUI: edit site colors, category colors, flags. Shows icon status, article counts, derived previews |
| `config/navbar-manager.py` | GUI: edit navbar mega-menu structure. Reads category colors from JSON |
| `src/shared/layouts/MainLayout.astro` | Build-time: derives 21 site vars + 150 category vars + 10 card classes. Injects via `<style set:html>` |
| `src/styles/global.css` | No hardcoded site/category colors. Comments point to MainLayout.astro SSOT injection |
| `src/core/config.ts` | Runtime: `CONFIG.categories`, `CONFIG.contentCategories`, `plural()`, `categoryColor()` |
| `src/content.config.ts` | Build-time: Zod schema validation + SSOT drift check |
| `src/shared/layouts/NavLinks.astro` | CSS: `.icon-{id}` mask-image classes for navbar icons |
| `public/images/navbar/{id}.svg` | SVG icon files (10 categories + house.svg for home) |

---

## HBS Migration Notes

1. **Mouse glow** in HBS used hand-tuned `rgb(115, 168, 225)`. TSX computes `rgb(82, 170, 212)` via the soft formula. Close enough; consistent across all categories.
2. **Monitor gradient** had a typo in HBS: `--global-monitorgradientStart` (missing hyphen). Fixed in TSX.
3. **Shadow-strong** in HBS mouse used `rgb(0, 148, 255)` instead of base `rgb(0, 174, 255)`. TSX uses base consistently.
4. HBS only defined 3 categories (mouse, keyboard, monitor). TSX supports 10 with identical derivation for all.
5. HBS `--site-color` and `--brand-color` were hardcoded in CSS. TSX derives them from JSON, enabling seasonal theming.
