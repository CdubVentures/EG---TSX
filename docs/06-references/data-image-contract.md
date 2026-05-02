# Data & Image Contract

> **Status:** Active — all component developers must follow this contract
> **Last audited:** 2026-03-11
> **Also see:** [`VAULT-IMAGE-REFRESH-CONTRACT.md`](VAULT-IMAGE-REFRESH-CONTRACT.md) (how cached vault snapshots are repaired from live media defaults)

---

## Why This Document Exists

A component that shows a product card needs **two things**:

1. **DATA** — brand name, model name, specs, scores, affiliate links, pros/cons
2. **IMAGES** — the actual product photos on disk

These are **not two separate systems.** One product JSON object carries both. This document explains how components get both data and images from a single source, and which repository contracts keep lookups and media resolution stable.

---

## The Golden Rules

```
RULE 1: ONE OBJECT = BOTH DATA AND IMAGES
  The product JSON entry is the single source of truth for everything
  a component needs — specs, scores, display names, AND image paths.

RULE 2: NEVER DERIVE PATHS
  Never build image paths from brand + model strings in a component.
  Always use the pre-built `imagePath` field + the resolver function.

RULE 3: NEVER HARDCODE NAMES
  Never display brand/model from a hardcoded string.
  Always read `product.brand` and `product.model` from the JSON.
```

---

## How a Component Gets What It Needs

### Scenario 1: Product Card (TaggedCard, FeedScroller, etc.)

The component receives a **complete product object** from a content entry under `src/content/data-products/`:

```
┌─────────────────────────────────────────────────────────────┐
│                     PRODUCT OBJECT                          │
│  (one entry from src/content/data-products/{category}/{brand}/{slug}.json) │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  DATA FIELDS (for display + logic):                         │
│    product.brand       → "Razer"           (display name)   │
│    product.model       → "Viper V3 Pro"    (display name)   │
│    product.weight      → 54                (spec data)      │
│    product.overall     → 9.6               (score data)     │
│    product.price_range → 159.99            (price)          │
│    product.connection  → "wireless"        (spec)           │
│    product.pros        → ["Lightweight..."] (editorial)     │
│    product.url         → "/hubs/mouse/..."  (page link)     │
│    product.affiliateLinks → [...]          (deal buttons)   │
│    ... 100+ more fields                                     │
│                                                             │
│  MEDIA (structured image data):                             │
│    product.imagePath   → "/images/mouse/razer/viper-v3-pro" │
│    product.media.defaultColor → null                        │
│    product.media.colors → []                                │
│    product.media.images → [                                 │
│      { stem: "feature-image", view: "feature-image" },      │
│      { stem: "top", view: "top" },                          │
│      { stem: "left", view: "left" },                        │
│      { stem: "sangle", view: "sangle" },                    │
│    ]                                                        │
│                                                             │
└─────────────────────────────────────────────────────────────┘
                            │
                    Component reads:
                            │
          ┌─────────────────┼─────────────────┐
          ▼                                   ▼
   DATA (direct read)              IMAGES (via media helpers)
   product.brand → "Razer"         import { getImage } from '@core/media';
   product.model → "Viper V3 Pro"  const img = getImage(product.media, 'top');
   product.overall → 9.6           contentImage(product.imagePath, img.stem, 'm')
   product.url → link href         → CDN + "/images/mouse/razer/
                                       viper-v3-pro/top_m.webp"
```

**The component never constructs anything.** It reads data fields directly and uses media helpers + the resolver.

`product.url` is a repository URL contract. In the current snapshot those `/hubs/...` links are emitted by helpers and stored data, but Phase 0 did not verify local `src/pages/hubs/**` route files.

### Scenario 2: Review Page

A review article links to a product via `productId` in frontmatter:

```
┌──────────────────────────────┐     ┌────────────────────────────────┐
│     REVIEW FRONTMATTER       │     │      PRODUCT OBJECT            │
│  (alienware-aw610m-review/   │     │  (matching data-products entry) │
│   index.md)                  │
├──────────────────────────────┤     ├────────────────────────────────┤
│  category: mouse             │     │  slug: alienware-aw610m        │
│  brand: Alienware            │     │  brand: Alienware              │
│  model: AW610M               │     │  model: AW610M                 │
│  productId: alienware-aw610m ──────→  imagePath: /images/mouse/...  │
│  title: "Alienware AW610M.." │     │  weight: 120                   │
│  pros: [...]                 │     │  overall: 7.4                  │
│  cons: [...]                 │     │  ... all specs, scores, images │
│  verdict: "..."              │     │                                │
└──────────────────────────────┘     └────────────────────────────────┘
          │                                       │
          │  Article-specific data                 │  Product data + images
          │  (editorial: title, verdict,           │  (specs, scores, photos)
          │   pros, cons, body text)               │
          ▼                                       ▼
┌──────────────────────────────────────────────────────────────────────┐
│                        REVIEW PAGE COMPONENT                        │
│                                                                     │
│  Renders editorial from frontmatter (title, verdict, prose)         │
│  Renders specs/scores from product object (weight, overall, etc.)   │
│  Renders product photos from product.imagePath + stems              │
│  Renders article hero from article's own image folder               │
└──────────────────────────────────────────────────────────────────────┘
```

The lookup in code:

```typescript
// Review page loads article, then resolves the matching product content entry
import { getEntry } from 'astro:content';

const product = (await getEntry(
  'dataProducts',
  `${entry.data.category}/${entry.data.brand}/${entry.data.productId}`
))?.data;
// product now has ALL data fields AND imagePath for images
```

### Scenario 3: Guide / News Page

Guides and news articles are **not linked to a product**. They carry their own data in frontmatter and their own image folder:

```
┌──────────────────────────────┐     ┌────────────────────────────────┐
│     GUIDE FRONTMATTER        │     │     IMAGE FOLDER               │
│  (mouse-best-budget/         │     │  (public/images/guides/mouse/  │
│   index.md)                  │
├──────────────────────────────┤     │   mouse-best-budget/)          │
│  category: mouse             │     ├────────────────────────────────┤
│  guide: Best Budget          │     │  title_blur.webp               │
│  title: "Best Budget..."     │     │  title_m.webp                  │
│  description: "..."          │     │  title_xl.webp                 │
│  hero: title              │     │  ...                           │
└──────────────────────────────┘     └────────────────────────────────┘
```

For guides/news: the **article slug = image folder name**. Articles use slug-folder layout (`{slug}/index.md`), so each article is a self-contained folder. If you rename the article, you rename both the content folder and the image folder. Use `scripts/sync-rename.mjs` to do both atomically. This is simpler than products because there's no external identity system.

---

## 1. Product Data + Image Contract

### The product object — single source of truth

Every product in `src/content/data-products/{category}/{brand}/{slug}.json` carries ~100+ fields. Here are the identity and image fields that matter for this contract:

| Field | Example | Mutable? | Purpose |
|-------|---------|----------|---------|
| `slug` | `razer-viper-v3-pro` | Yes (on rename) | Primary key for lookups |
| `brand` | `Razer` | Yes (on rename) | Display name (title case) |
| `model` | `Viper V3 Pro` | Yes (on rename) | Display name |
| `category` | `mouse` | No | Category enum |
| `url` | `/hubs/mouse/razer/viper-v3-pro` | Yes (derived) | Pre-built product URL contract |
| `imagePath` | `/images/mouse/razer/viper-v3-pro` | Yes (derived) | Pre-built image folder prefix |

**Spec fields** (50+ fields like `weight`, `sensor`, `dpi`, `connection`, `polling_rate`) provide all hardware data.

**Score fields** (`overall`, `accuracy`, `response`, `quality`, `comfort`, `fps_score`, etc.) provide all ratings.

**Editorial fields** (`keytakeaway`, `verdict`, `pros`, `cons`, `youtube`) provide review content.

**Media object** (`media`) provides structured image data — views, colors, editions, auto-generated from filesystem.

**Affiliate fields** (`affiliateLinks[]`) provide deal button URLs.

**Key point:** `slug`, `url`, and `imagePath` are all **derived from brand + model** but pre-computed and stored in the JSON. Components read pre-built values - they never derive them. If "Razer" renames to "Razer Gaming", the sync script updates all three fields atomically. Components just read the new values.

### Product media schema

Product JSON stores a structured `media` object (auto-generated by `scripts/build-media.mjs`):

```typescript
interface ProductImage {
  stem: string;       // "top", "top---white", "top___cyberpunk-2077-edition---black+red"
  view: string;       // "top", "left", "feature-image", "shape-side"
  color?: string;     // "white", "pink", "black+red"
  edition?: string;   // "cyberpunk-2077-edition"
  seq?: number;       // 1, 2, 3 (for img1, img2, img3)
}

interface ProductMedia {
  defaultColor: string | null;      // colors[0] or null
  defaultEdition?: string | null;   // optional explicit default edition
  colors: string[];                 // all colors (default first)
  editions: string[];               // all editions
  images: ProductImage[];           // ordered by view priority
}
```

Images are ordered by view priority: `feature-image → top → left → right → sangle → angle → front → rear → bot → img`.

**Stem naming convention:**
- Base: `top` (default color / no color)
- Color variant: `top---white` (three hyphens = color separator)
- Edition+color: `top___cyberpunk-2077-edition---black+red` (three underscores = edition, three hyphens = color)
- SVG shapes: `side` (view = `shape-side`), `top` (view = `shape-top`)

**Adding new images:** Drop processed files into the product's image folder, then run `node scripts/build-media.mjs --scan-only`.

### Media query helpers — `src/core/media.ts`

Pure functions for querying the `media` object. No side effects, no imports.

| Function | Purpose |
|----------|---------|
| `getImage(media, view, color?, edition?)` | Best single image for a view, with deterministic color+edition fallback |
| `getImageWithFallback(media, views[], color?, edition?)` | Try views in priority order, return first match |
| `resolveImage(media, views[], stemExists, color?, edition?)` | Like `getImageWithFallback` but also checks filesystem via predicate |
| `getCarouselImages(media, color?)` | All photo views for a color (excludes SVG shapes) |
| `getImageForColor(media, color, view, edition?)` | Image for a specific color + view |
| `getAvailableColors(media)` | List of all colors |
| `hasColorVariants(media)` | True if product has 2+ colors |

**Fallback chains:** Components should use `getImageWithFallback()` with the view chain from `imageDefaults(category).defaultImageView` instead of hardcoding a single view name. This ensures images always resolve even when a product lacks the preferred view.

**Color + edition precedence (global):**

1. Preferred color = explicit `color` arg, else `media.defaultColor`.
2. Preferred edition = explicit `edition` arg, else `media.defaultEdition` (if present).
3. Rank candidates within the chosen view:
   - best color match
   - best edition match
   - lower `seq`
   - deterministic lexical tie-break (`edition`, then `stem`)

This guarantees stable selection when products include both color and edition variants.

```typescript
import { getImageWithFallback } from '@core/media';
import { imageDefaults } from '@core/config';

const viewChain = imageDefaults(product.category).defaultImageView;
// e.g. ["right", "top", "left", "sangle"] for mouse
const thumb = getImageWithFallback(product.media, viewChain);
if (thumb) {
  const url = contentImage(product.imagePath, thumb.stem, 't');
}
```

### Image defaults — `config/data/image-defaults.json`

Per-category image configuration. Managed by the Image Defaults panel in `config/eg-config.pyw`.

| Key | Type | Purpose |
|-----|------|---------|
| `defaultImageView` | `string[]` | Fallback chain for default product image (cards, vault) |
| `listThumbKeyBase` | `string[]` | Fallback chain for list/comparison thumbnails |
| `coverImageView` | `string[]` | Fallback chain for cover/hero images |
| `headerGame` | `string[]` | Views for game header backgrounds |
| `viewPriority` | `string[]` | Master ordering of all views |
| `viewMeta` | `object` | Per-view metadata (`objectFit`, labels) |
| `imageDisplayOptions` | `array` | Dropdown options for image viewer |

Category overrides replace arrays wholesale, deep-merge `viewMeta`. Resolver: `src/core/image-defaults-resolver.mjs`.

### Image size suffixes

Each stem is saved at multiple sizes on disk:

| Suffix | Width | Use |
|--------|-------|-----|
| `_t_blur` | 40px | Thumbnail blur placeholder (always generated) |
| `_blur` | 200px | Blurred placeholder (LQIP, blur-up) |
| `_t` | 300px | Thumbnail (always generated) |
| `_xxs` | 100px | Tiny (srcset lowest breakpoint) |
| `_xs` | 200px | Extra small |
| `_s` | 400px | Small |
| `_m` | 600px | Medium — default `src` |
| `_l` | 800px | Large |
| `_xl` | 1000px | Extra large |
| `_xxl` | 2000px | Hero / full-width |
| `_zoom` | 3200px | Full resolution lightbox |

**Always generated:** `_t` and `_t_blur` are exported on every Photoshop run regardless of the product's W/H size set. Other sizes are conditional based on the source image dimensions.

### Disk structure

```
public/images/{category}/{brand-slug}/{model-slug}/
    feature-image---white+black_blur.webp
    feature-image---white+black_xs.webp
    feature-image---white+black_m.webp
    feature-image---white+black_xl.webp
    top---white+black_m.webp
    angle---gray+black_m.webp
    ...
    originals/          # Source files (not served in prod)
```

---

## 2. The Resolver — `src/core/images.ts`

The **only** place in the codebase that constructs image URLs. Three functions:

```typescript
import { CONFIG, imageDefaults } from './config';

type ImageSize = 'blur' | 't_blur' | 't' | 'xxs' | 'xs' | 's' | 'm' | 'l' | 'xl' | 'xxl' | 'zoom';

/** Build any image URL: CDN base + basePath + stem + size + extension */
export function contentImage(basePath: string, stem: string, size: ImageSize, ext = 'webp'): string {
  return `${CONFIG.cdn.baseUrl}${basePath}/${stem}_${size}.${ext}`;
}

/** Derive image base path from collection + entry ID */
export function collectionImagePath(collection: string, entryId: string): string {
  return `/images/${collection}/${entryId}`;
}

/**
 * Runtime image error fallback — walks the category's defaultImageView chain.
 * Call from a React <img> onError handler. When all fallbacks are exhausted,
 * the global capture-phase handler (MainLayout) shows the EG logo SVG.
 */
export function tryImageFallback(
  img: HTMLImageElement,
  imagePath: string,
  category: string,
  sizeSuffix: string,       // e.g. "_t" or "_xs"
  originalStem: string,
): void;
```

**CDN routing:** `CONFIG.cdn.baseUrl` is empty in dev (relative paths) and the CloudFront URL in production. Every image URL in the codebase must go through `contentImage()` to get correct CDN routing in both environments.

### Runtime image error handling — `tryImageFallback()`

When a product image fails to load at runtime (404, network error, corrupt file), React `onError` handlers call `tryImageFallback()` to walk the category's fallback chain before giving up.

**How it works:**

1. Reads `imageDefaults(category).defaultImageView` — e.g. `["right", "top", "left", "sangle"]` for mouse
2. Tracks already-tried views via the `data-tried-views` attribute on the `<img>` element
3. Sets `img.src` to the next untried view in the chain
4. Clears `data-fallback` so the global handler can fire again if the next view also fails
5. When the chain is exhausted, does nothing — the global broken-image handler (MainLayout) has already set the EG logo SVG during the capture phase of the same error event

**Coordination with the global handler:**

```
Image error event fires
    ↓
CAPTURE PHASE: Global handler (MainLayout) fires first
  → Sets data-fallback="1" on the <img>
  → Sets img.src to EG logo SVG data URI
    ↓
BUBBLE PHASE: React onError fires second
  → tryImageFallback() checks the fallback chain
  → If untried view exists: clears data-fallback, sets new src (triggers another load attempt)
  → If chain exhausted: does nothing (EG logo SVG from capture phase stays)
```

**Key attributes:**
- `data-tried-views` — comma-separated list of views already attempted (set by `tryImageFallback`)
- `data-fallback` — set by the global capture-phase handler, cleared by `tryImageFallback` when trying next view

**Usage in React islands (VaultDropdown, VaultToast):**

```tsx
import { tryImageFallback } from '@core/images';

<img
  src={`${product.imagePath}/${stem}_t.webp`}
  onError={(e) => {
    tryImageFallback(e.currentTarget, product.imagePath, category, '_t', stem);
  }}
/>
```

**Configuration:** Fallback chains are defined in `config/data/image-defaults.json` and managed by the Image Defaults panel in `config/eg-config.pyw`. See Section 1 → "Image defaults" for the full key reference.

### Usage in an Astro component

```astro
---
import { contentImage, collectionImagePath } from '@core/images';
import { getImage, getImageWithFallback } from '@core/media';
import { imageDefaults } from '@core/config';

const { product } = Astro.props;
// product.brand    → display name
// product.model    → display name
// product.weight   → spec data
// product.overall  → score data
// product.media    → structured image data

// Single view lookup:
const topImg = getImage(product.media, 'top');

// Fallback chain lookup (preferred — never 404s):
const viewChain = imageDefaults(product.category).defaultImageView;
const thumb = getImageWithFallback(product.media, viewChain);

// Brand logos:
const brandLogo = contentImage(
  collectionImagePath('brands', brandSlug),
  'brand-logo-horizontal-mono-black', 'xs', 'png'
);

// Game images:
const boxArt = contentImage(
  collectionImagePath('games', gameSlug),
  'box-art-cover', 's'
);
---
<div class="product-card">
  <h3>{product.brand} {product.model}</h3>
  <span>{product.weight}g</span>
  <span>{product.overall}/10</span>
  {thumb && (
    <img
      src={contentImage(product.imagePath, thumb.stem, 'm')}
      alt={`${product.brand} ${product.model}`}
    />
  )}
  <a href={product.url}>View Details</a>
</div>
```

### Usage in a React island (client-side)

React islands (`client:visible`, `client:load`) run in the browser and **cannot** access `CONFIG.cdn.baseUrl`. Image URLs must be **pre-resolved in the parent Astro file** and passed as props.

```astro
---
// Parent .astro file — server-side, has access to contentImage()
import { contentImage, collectionImagePath } from '@core/images';
const logoUrl = contentImage(collectionImagePath('brands', slug), 'brand-logo-horizontal-mono-black', 'xs', 'png');
---
<MyReactIsland client:visible logoUrl={logoUrl} />
```

```tsx
// MyReactIsland.tsx — client-side, receives pre-resolved URL
function MyReactIsland({ logoUrl }: { logoUrl: string }) {
  return <img src={logoUrl} alt="Brand logo" />;
}
```

**Never construct image URLs inside React islands.** Always pre-resolve in the parent `.astro` file.

**Exception — `tryImageFallback()` in React `onError`:** React islands that display product images (VaultDropdown, VaultToast) may call `tryImageFallback()` from their `onError` handler. This function constructs fallback URLs using `imagePath` (already passed as a prop/data field) and the category's `defaultImageView` chain — it does NOT use `CONFIG.cdn.baseUrl`, so it works client-side. The initial `src` must still be pre-resolved or built from props.

**Notice:** In both examples, `product.brand` provides the display name AND `product.media` provides structured image data. One object, both pieces. No deriving.

---

## 3. Article Data + Image Contract

### Reviews — linked to a product

Reviews bridge two data sources:

| Data Source | What It Provides |
|-------------|-----------------|
| **Review frontmatter** | Editorial content — title, subtitle, description, verdict, pros, cons, body text, tags, author |
| **Product JSON** (via `productId` lookup) | Hardware data — all specs, scores, and images |

The `productId` field in review frontmatter is the **bridge**:

```yaml
---
category: mouse
brand: Alienware        # display (can also come from product)
model: AW610M           # display (can also come from product)
productId: alienware-aw610m   # ← lookup key into product JSON
title: "Alienware AW610M Review: ..."
verdict: "The AW610M's bold design..."
pros:
  - "Its daring design..."
cons:
  - "Heavier weight..."
---
```

**Component resolution:**

```typescript
// Load product via Astro content collection
const product = (await getEntry('dataProducts', `${category}/${brand}/${productId}`))?.data;

// NOW you have everything:
// DATA:   product.weight, product.sensor, product.overall, product.price_range
// MEDIA:  getImage(product.media, 'top') → { stem, view, color? }
//         contentImage(product.imagePath, stem, 'm') → URL
// EDITORIAL: entry.data.title, entry.data.verdict, entry.data.pros
```

### Review hero images

Review-specific images (hero, inline photos) live separately from product images:

```
Product images:  public/images/mouse/alienware/aw610m/          ← shared site-wide
Article images:  public/images/reviews/mouse/alienware/aw610m/  ← review-specific
```

### Guides and News — standalone articles

Guides and news are **not linked to a product**. They are self-contained:

| Data Source | What It Provides |
|-------------|-----------------|
| **Frontmatter** | All metadata — title, description, category, tags, author, hero |
| **MDX body** | The article content (may reference products inline via components) |
| **Image folder** | Named after the article slug: `public/images/guides/{category}/{slug}/` |

If a guide mentions specific products (like "Best Budget Mice"), those products are referenced by slug in MDX components, which look them up in the JSON the same way reviews do.

---

## 4. What Happens on an Article Rename

### Review slug-folder rename (safe — images unaffected)

Renaming `alienware-aw610m-review/` → `alienware-aw610m-full-review/` (the folder containing `index.md`):

- Astro `entry.id` changes → URL changes
- `productId` field stays the same → product lookup still works → images still resolve
- Article-specific images use brand/model subfolders (not the content slug), so no image folder move needed
- Use `scripts/sync-rename.mjs reviews mouse/alienware-aw610m-review mouse/alienware-aw610m-full-review`

### Guide/News slug-folder rename (requires image folder move)

Renaming `best-fps-mice-2026/` → `best-fps-mice-march-2026/` (the folder containing `index.md`):

- Astro `entry.id` changes → URL changes
- Image folder must also move: `best-fps-mice-2026/` → `best-fps-mice-march-2026/`
- Use `scripts/sync-rename.mjs` — handles both renames atomically

## 5. Content Type Summary

| Content Type | Data Source | Resolver | Example |
|-------------|------------|----------|---------|
| **Product card** | Product JSON | `getImageWithFallback()` + `contentImage()` | `contentImage(p.imagePath, getImageWithFallback(p.media, chain).stem, 'm')` |
| **Snapshot page** | Product JSON | `getImageWithFallback()` + `contentImage()` | `contentImage(p.imagePath, getImageWithFallback(p.media, coverChain).stem, 'xxl')` |
| **Review page** | Frontmatter + Product JSON | `getImageWithFallback()` + `contentImage()` | `contentImage(product.imagePath, img.stem, 'm')` |
| **Guide page** | Frontmatter | `contentImage(path, stem, size)` | `contentImage(collectionImagePath('guides', 'mouse/best-budget'), 'title', 'xl')` |
| **News page** | Frontmatter | `contentImage(path, stem, size)` | `contentImage(collectionImagePath('news', 'hardware/slug'), 'hero', 'm')` |
| **Brand page** | Brand collection | `contentImage()` | `contentImage(collectionImagePath('brands', slug), 'brand-logo-horizontal-mono-black', 'xs', 'png')` |
| **Game page** | Game collection | `contentImage()` | `contentImage(collectionImagePath('games', slug), 'box-art-cover', 's')` |

---

## 6. Validation Script

Use `scripts/validate-image-links.mjs` before deploys or content-sync runs to verify the contract:

```
For every product in src/content/data-products/**/*.json:
  ✓ Image folder exists at public/{imagePath}/
  ✓ media object exists with images array
  ✓ Every media.images stem resolves to {stem}_m.webp on disk
  ✓ media.defaultColor matches colors[0] or is null
  ✓ if media.defaultEdition is set, it exists in media.editions

For every review with a productId:
  ✓ A product with that slug exists

For every image folder in public/images/{category}/:
  ✓ A product references it (no orphaned folders)
```

---

## Quick Reference Card

```
╔══════════════════════════════════════════════════════════════════════╗
║  DATA & IMAGE CONTRACT — Quick Reference                            ║
╠══════════════════════════════════════════════════════════════════════╣
║                                                                      ║
║  ONE OBJECT = BOTH DATA AND IMAGES                                   ║
║  ──────────────────────────────────────────────────────────────────  ║
║  const product = products.find(p => p.slug === slug);                ║
║  // DATA:   product.brand, product.weight, product.overall           ║
║  // MEDIA:  product.media.images, product.media.colors               ║
║                                                                      ║
║  PRODUCT IMAGES (with fallback chain)                                ║
║  ──────────────────────────────────────────────────────────────────  ║
║  import { contentImage, collectionImagePath } from '@core/images';   ║
║  import { getImageWithFallback } from '@core/media';                 ║
║  import { imageDefaults } from '@core/config';                       ║
║  const chain = imageDefaults(product.category).defaultImageView;     ║
║  const img = getImageWithFallback(product.media, chain);             ║
║  contentImage(product.imagePath, img.stem, 'm')                      ║
║                                                                      ║
║  BRAND LOGOS                                                         ║
║  ──────────────────────────────────────────────────────────────────  ║
║  contentImage(                                                       ║
║    collectionImagePath('brands', slug),                              ║
║    'brand-logo-horizontal-mono-black', 'xs', 'png'                   ║
║  )                                                                   ║
║                                                                      ║
║  GAME IMAGES                                                         ║
║  ──────────────────────────────────────────────────────────────────  ║
║  contentImage(                                                       ║
║    collectionImagePath('games', slug),                               ║
║    'box-art-cover', 's'                                              ║
║  )                                                                   ║
║                                                                      ║
║  ARTICLE HERO                                                        ║
║  ──────────────────────────────────────────────────────────────────  ║
║  contentImage(                                                       ║
║    collectionImagePath('guides', `mouse/${slug}`),                   ║
║    heroStem, 'xl'                                                    ║
║  )                                                                   ║
║                                                                      ║
║  REVIEW → PRODUCT LOOKUP                                             ║
║  ──────────────────────────────────────────────────────────────────  ║
║  const product = products.find(p => p.slug === review.productId);    ║
║  // product now has ALL data AND media object                        ║
║                                                                      ║
║  CDN ROUTING                                                         ║
║  ──────────────────────────────────────────────────────────────────  ║
║  All image URLs go through contentImage() → CDN in prod, local       ║
║  in dev. React islands can't access CONFIG — pre-resolve URLs        ║
║  in parent .astro file and pass as props.                            ║
║                                                                      ║
║  RUNTIME IMAGE FALLBACK (React onError)                              ║
║  ──────────────────────────────────────────────────────────────────  ║
║  import { tryImageFallback } from '@core/images';                    ║
║  onError={(e) => tryImageFallback(                                   ║
║    e.currentTarget, product.imagePath, category, '_t', stem          ║
║  )}                                                                  ║
║  Walks imageDefaults(category).defaultImageView chain per error.     ║
║  When exhausted, global handler shows EG logo SVG.                   ║
║                                                                      ║
║  ✗ FORBIDDEN                                                         ║
║  ──────────────────────────────────────────────────────────────────  ║
║  `/images/${cat}/${slugify(brand)}/${slugify(model)}/...`            ║
║  Any string concatenation to build image paths in components         ║
║  Hardcoded brand/model strings instead of reading from product       ║
║  Hardcoded `/images/...` paths without contentImage() CDN routing    ║
║  Constructing image URLs inside React islands (client-side)          ║
║  Hardcoded fallback stems (e.g. always "top") in onError handlers    ║
║                                                                      ║
╚══════════════════════════════════════════════════════════════════════╝
```
