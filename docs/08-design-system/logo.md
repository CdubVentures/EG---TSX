# EG Logo — Theme-Aware SVG System

## Overview

The EG logo ("E" and "G" letter marks) is a **vector SVG** with two tones that
adapts to the active theme at runtime. It powers two features from a single
set of path data:

1. **Browser tab favicon** — updates live when the user switches themes
2. **Broken image placeholder** — branded fallback shown when any `<img>` fails to load

## Logo Source Files

| File | Purpose |
|------|---------|
| `public/images/favicons/favicon.svg` | Clean vector SVG (static, blue default). Used as the `<link rel="icon">` fallback before JS runs. |
| `public/images/favicons/SVG 1.1-1.svg` | Illustrator vector export (source of truth for path data). |
| `public/images/favicons/icon-512.png` | Raster PNG for contexts that don't support SVG (Android, Apple, etc.). |

## Two Tones

The logo has two visual tones derived from the letter shapes:

| Element | Paths | CSS Variable | Default (blue) |
|---------|-------|-------------|----------------|
| **E letter** + 3 join seams | `E`, `J1`, `J2`, `J3` | `--site-end-color` | `#3258a6` |
| **G letter** (gradient) | `G` | `--site-start-color` → `--site-end-color` | `#3fa3db` → `#3258a6` |

These CSS variables (`--site-start-color`, `--site-end-color`) are set in
`src/core/categories.ts` from `config/data/categories.json → siteColors`.

## How It Works

### Problem

SVGs loaded via `<img src>` or `<link rel="icon">` are **sandboxed** — they
cannot read CSS variables from the parent document. So a static `.svg` file
will always show hardcoded colors regardless of theme.

### Solution

A single `is:inline` script in `MainLayout.astro` (runs before first paint):

1. Stores the 5 vector path strings (`G`, `E`, `J1`, `J2`, `J3`) as JS variables
2. Exposes `egLogoSvg(opts?)` — reads computed CSS vars, builds a `data:image/svg+xml` URI
3. Exposes `window.__egUpdateFavicon()` — updates the `<link rel="icon">` href
4. Registers a global `error` event listener (capture phase) for broken images

### Favicon (browser tab)

```
Page load → egLogoSvg() → data URI → link[rel="icon"].href
Theme switch → setTheme() → rAF → window.__egUpdateFavicon() → same flow
```

- `setTheme()` in `src/features/settings/store.ts` calls `__egUpdateFavicon()`
  after a `requestAnimationFrame` — CSS vars need one frame to resolve after
  `data-theme` attribute changes.
- The static `favicon.svg` in `<head>` shows the blue default until JS runs
  (typically <50ms). After that, the themed data URI takes over.

### Broken Image Placeholder

```
<img> error → capture listener → egLogoSvg({ placeholder: true }) → el.src
```

- Placeholder mode adds a background rect (`--section-dark-background-color`)
  and renders the logo at 20% opacity as a watermark.
- Sets `data-fallback="1"` on the element to prevent retry loops.
- Clears `srcset` so the browser doesn't re-attempt failed responsive sources.
- CSS rule `img[data-fallback]` in `global.css` applies:
  - `object-fit: contain` — centers the logo
  - `background: var(--section-dark-background-color)` — themed background
  - `padding: 10%` — breathing room

### Coordination with `tryImageFallback()` (product images)

Product images in React islands (VaultDropdown, VaultToast) use a **two-layer
fallback system** that coordinates the global capture-phase handler with
per-category image fallback chains:

```
Image fails to load
    │
    ├─ CAPTURE PHASE (global handler, MainLayout)
    │   → Sets data-fallback="1"
    │   → Sets img.src to EG logo SVG data URI
    │
    └─ BUBBLE PHASE (React onError)
        → tryImageFallback() checks defaultImageView chain
        → If untried view exists:
        │   → Clears data-fallback (re-arms global handler)
        │   → Sets img.src to next view (triggers new load attempt)
        └─ If chain exhausted:
            → Does nothing (EG logo stays from capture phase)
```

**Key attributes on the `<img>` element:**

| Attribute | Set by | Purpose |
|-----------|--------|---------|
| `data-fallback` | Global capture handler | Prevents infinite retry. Cleared by `tryImageFallback()` when trying next view. |
| `data-tried-views` | `tryImageFallback()` | Comma-separated list of views already attempted. Prevents cycling. |

**Result:** Product images try all configured fallback views (e.g. `right → top → left → sangle` for mouse) before showing the EG logo. Static images (brands, articles, etc.) without React `onError` handlers go straight to the EG logo on first error.

**Source:** `tryImageFallback()` lives in `src/core/images.ts`. Fallback chains are configured in `config/data/image-defaults.json` (managed by the Image Defaults panel in `config/eg-config.pyw`).

### Files Involved

| File | Role |
|------|------|
| `src/shared/layouts/MainLayout.astro` | `is:inline` script with path data, `egLogoSvg()`, error listener, `__egUpdateFavicon()` |
| `src/core/images.ts` | `tryImageFallback()` — per-category fallback chain for React `onError` handlers |
| `src/features/settings/store.ts` | `setTheme()` calls `__egUpdateFavicon()` on theme change |
| `src/styles/global.css` | `img[data-fallback]` CSS rule for broken image styling |
| `config/data/image-defaults.json` | Per-category `defaultImageView` fallback chains (managed by the Image Defaults panel in `config/eg-config.pyw`) |
| `public/images/favicons/favicon.svg` | Static vector fallback (before JS hydrates) |

## Updating the Logo

If the logo design changes:

1. Export new vector from Illustrator: **Object → Image Trace → Expand → Export As SVG**
   (Presentation Attributes, not inline styles)
2. Copy the `<path d="...">` values from the exported SVG
3. Update the 5 path variables (`G`, `E`, `J1`, `J2`, `J3`) in `MainLayout.astro`
4. Update `public/images/favicons/favicon.svg` with the same paths (static fallback)
5. Re-export raster PNGs (`icon-512.png`, etc.) from the new design for
   Android/Apple/MS icon references in `<head>`

## Theme Integration

The logo inherits whatever `--site-start-color` and `--site-end-color` resolve
to in the active theme. Currently these are set globally from `siteColors` in
`categories.json` and do not change per-theme — but if per-theme site colors
are added in the future, the logo will automatically follow.

The placeholder background uses `--section-dark-background-color`, which IS
theme-scoped (dark `#1d2021` in gaming, `#ffffff` in light themes via the
body-level override).
