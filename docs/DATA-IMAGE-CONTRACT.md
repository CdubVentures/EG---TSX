# Data & Image Contract — Dual Source of Truth

> **Status:** Active — all component developers must follow this contract
> **Last updated:** 2026-03-04
> **Replaces:** `IMAGE-IDENTITY-CONTRACT.md` (image-only contract, now superseded)
> **Diagrams:** [`product-identity-flow.md`](diagrams/product-identity-flow.md) | [`article-identity-flow.md`](diagrams/article-identity-flow.md) | [`dual-source-of-truth.md`](diagrams/dual-source-of-truth.md)

---

## Why This Document Exists

A component that shows a product card needs **two things**:

1. **DATA** — brand name, model name, specs, scores, affiliate links, pros/cons
2. **IMAGES** — the actual product photos on disk

These are **not two separate systems.** One product JSON object carries both. This document explains how components get both data and images from a single source, and why renames never break anything.

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

The component receives a **complete product object** from the JSON:

```
┌─────────────────────────────────────────────────────────────┐
│                     PRODUCT OBJECT                          │
│  (one entry from mouse.json / keyboard.json / monitor.json) │
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

### Scenario 2: Review Page

A review article links to a product via `productId` in frontmatter:

```
┌──────────────────────────────┐     ┌────────────────────────────────┐
│     REVIEW FRONTMATTER       │     │      PRODUCT OBJECT            │
│  (alienware-aw610m-review/   │     │  (from mouse.json)             │
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
// Review page loads article, then looks up the product
import mouseProducts from '@data/products/mouse.json';

const product = mouseProducts.find(p => p.slug === entry.data.productId);
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
│  heroImg: title              │     │  ...                           │
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
| `url` | `/hubs/mouse/razer/viper-v3-pro` | Yes (derived) | Pre-built page URL |
| `imagePath` | `/images/mouse/razer/viper-v3-pro` | Yes (derived) | Pre-built image folder prefix |

**Spec fields** (50+ fields like `weight`, `sensor`, `dpi`, `connection`, `polling_rate`) provide all hardware data.

**Score fields** (`overall`, `accuracy`, `response`, `quality`, `comfort`, `fps_score`, etc.) provide all ratings.

**Editorial fields** (`keytakeaway`, `verdict`, `pros`, `cons`, `youtube`) provide review content.

**Media object** (`media`) provides structured image data — views, colors, editions, auto-generated from filesystem.

**Affiliate fields** (`affiliateLinks[]`) provide deal button URLs.

**Key point:** `slug`, `url`, and `imagePath` are all **derived from brand + model** but pre-computed and stored in the JSON. Components read pre-built values — they never derive them. If "Razer" renames to "Razer Gaming", the sync script updates all three fields atomically. Components just read the new values.

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
  defaultColor: string | null;  // colors[0] or null
  colors: string[];             // all colors (default first)
  editions: string[];           // all editions
  images: ProductImage[];       // ordered by view priority
}
```

Images are ordered by view priority: `feature-image → top → left → right → sangle → angle → front → rear → bot → img`.

**Stem naming convention:**
- Base: `top` (default color / no color)
- Color variant: `top---white` (three hyphens = color separator)
- Edition+color: `top___cyberpunk-2077-edition---black+red` (three underscores = edition, three hyphens = color)
- SVG shapes: `side` (view = `shape-side`), `top` (view = `shape-top`)

**Adding new images:** Drop processed files into the product's image folder, then run `node scripts/build-media.mjs --scan-only`.

### Image size suffixes

Each stem is saved at multiple sizes on disk:

| Suffix | Use |
|--------|-----|
| `_blur` | Blurred placeholder (LQIP, blur-up) |
| `_t` | Thumbnail |
| `_xs` | Extra small (~200px) |
| `_s` | Small (~400px) |
| `_m` | Medium (~600px) — default `src` |
| `_l` | Large (~800px) |
| `_xl` | Extra large (~1000px) |
| `_xxl` | Hero / zoom (~2000px) |
| `_zoom` | Full resolution lightbox |

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

The **only** place in the codebase that constructs image URLs.

```typescript
import { CONFIG } from './config';

type ImageSize = 'blur' | 't' | 'xs' | 's' | 'm' | 'l' | 'xl' | 'xxl' | 'zoom';

/** Build any content image URL from basePath + stem + size */
export function contentImage(basePath: string, stem: string, size: ImageSize, ext = 'webp'): string {
  return `${CONFIG.cdn.baseUrl}${basePath}/${stem}_${size}.${ext}`;
}

/** Derive image base path from collection + entry ID */
export function collectionImagePath(collection: string, entryId: string): string {
  return `/images/${collection}/${entryId}`;
}

/** Build a game image URL (box art, hero, cover) */
export function gameImage(gameSlug: string, stem: string, size: ImageSize): string {
  return `${CONFIG.cdn.baseUrl}/images/games/${gameSlug}/${stem}_${size}.webp`;
}

/** Build an article hero image URL */
export function articleImage(articleImagePath: string, stem: string, size: ImageSize): string {
  return `${CONFIG.cdn.baseUrl}${articleImagePath}/${stem}_${size}.webp`;
}
```

### Usage in an Astro component

```astro
---
import { contentImage } from '@core/images';
import { getImage } from '@core/media';
const { product } = Astro.props;
// product.brand    → display name
// product.model    → display name
// product.weight   → spec data
// product.overall  → score data
// product.media    → structured image data
const topImg = getImage(product.media, 'top');
---
<div class="product-card">
  <h3>{product.brand} {product.model}</h3>
  <span>{product.weight}g</span>
  <span>{product.overall}/10</span>
  {topImg && (
    <img
      src={contentImage(product.imagePath, topImg.stem, 'm')}
      alt={`${product.brand} ${product.model}`}
    />
  )}
  <a href={product.url}>View Details</a>
</div>
```

### Usage in a React island

```tsx
import { contentImage } from '@core/images';
import { getImage, getCarouselImages } from '@core/media';

function ProductCard({ product }: { product: Product }) {
  const topImg = getImage(product.media, 'top');
  return (
    <div>
      <h3>{product.brand} {product.model}</h3>
      {topImg && (
        <img
          src={contentImage(product.imagePath, topImg.stem, 'm')}
          alt={`${product.brand} ${product.model}`}
        />
      )}
    </div>
  );
}
```

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
| **Frontmatter** | All metadata — title, description, category, tags, author, heroImg |
| **MDX body** | The article content (may reference products inline via components) |
| **Image folder** | Named after the article slug: `public/images/guides/{category}/{slug}/` |

If a guide mentions specific products (like "Best Budget Mice"), those products are referenced by slug in MDX components, which look them up in the JSON the same way reviews do.

---

## 4. What Happens on a Product Rename

When Spec Factory (the CMS) renames a product — brand, model, or variant change:

### The sync script updates both data AND images atomically:

| Step | What Changes | Before | After |
|------|-------------|--------|-------|
| 1. Slug | Primary key | `razer-viper-v3-pro` | `razer-viper-v3-pro-max` |
| 2. Model | Display name | `Viper V3 Pro` | `Viper V3 Pro Max` |
| 3. URL | Page route | `/hubs/mouse/razer/viper-v3-pro` | `/hubs/mouse/razer/viper-v3-pro-max` |
| 4. imagePath | Image folder | `/images/mouse/razer/viper-v3-pro` | `/images/mouse/razer/viper-v3-pro-max` |
| 5. Move images | Disk folder | `public/images/.../viper-v3-pro/` | `public/images/.../viper-v3-pro-max/` |
| 6. Review refs | Frontmatter | `productId: razer-viper-v3-pro` | `productId: razer-viper-v3-pro-max` |
| 7. Cross-refs | Recommender | `similar: ["razer-viper-v3-pro"]` | `similar: ["razer-viper-v3-pro-max"]` |

### What does NOT change:

- **Zero component code changes** — components read `product.brand`, `product.imagePath`, etc. from the JSON. All values updated.
- **Media image stems** — `media.images[].stem` stays the same (photos don't change, just the folder)
- **Spec Factory's `identifier`** (8-char hex) — proves continuity across renames
- **The resolver function** — same code, same signature, always works

### Brand rename cascades:

If "Razer" → "Razer Gaming", the sync script updates **every Razer product's** `slug`, `brand`, `url`, `imagePath`, and moves every image folder. Components don't change.

---

## 5. What Happens on an Article Rename

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

---

## 6. Spec Factory Integration (Phase 13)

Spec Factory is the external CMS that manages product identity. It uses a three-layer identity system:

| Layer | Example | Mutability |
|-------|---------|-----------|
| **Immutable identifier** | `c730517d` (8-char hex) | Never changes |
| **Derived slug** | `razer-viper-v3-pro` | Changes on rename |
| **Display names** | `Razer` / `Viper V3 Pro` | Changes on rename |

The identifier is the join key between Spec Factory and EG-TSX. The sync script uses it to match "old product" to "new product" across renames, then updates all derived fields (slug, url, imagePath, brand, model) atomically.

### Sync workflow

```
Spec Factory renames product
    ↓
rename_log.json updated (old slug → new slug, identifier preserved)
    ↓
EG-TSX sync script reads rename_log.json
    ↓
For each rename:
    1. Update product JSON (slug, brand, model, url, imagePath)
    2. mv image folder (old path → new path)
    3. Rewrite review frontmatter productId
    4. Rewrite recommender/hub-tag references
    5. Log change locally
    ↓
astro build → new static HTML with correct paths
```

---

## 7. Content Type Summary

| Content Type | Data Source | Resolver | Example |
|-------------|------------|----------|---------|
| **Product card** | Product JSON | `getImage()` + `contentImage()` | `contentImage(p.imagePath, getImage(p.media, 'top').stem, 'm')` |
| **Snapshot page** | Product JSON | `getImage()` + `contentImage()` | `contentImage(p.imagePath, getImage(p.media, 'feature-image').stem, 'xxl')` |
| **Review page** | Frontmatter + Product JSON | `getImage()` + `contentImage()` for product; `articleImage()` for hero | `contentImage(product.imagePath, getImage(product.media, 'top').stem, 'm')` |
| **Guide page** | Frontmatter | `contentImage(path, stem, size)` | `contentImage('/images/guides/mouse/best-budget', 'title', 'xl')` |
| **News page** | Frontmatter | `contentImage(path, stem, size)` | `contentImage('/images/news/hardware/slug', 'hero', 'm')` |
| **Brand page** | Brand collection | `contentImage()` | `contentImage(collectionImagePath('brands', slug), 'logo_black', 'xs', 'png')` |
| **Game page** | Game collection | `contentImage()` | `contentImage(collectionImagePath('games', slug), 'box-art-cover', 's')` |

---

## 8. Validation Script

A validation script (`scripts/validate-image-links.mjs`) should run before every deploy:

```
For every product in src/content/data-products/**/*.json:
  ✓ Image folder exists at public/{imagePath}/
  ✓ media object exists with images array
  ✓ Every media.images stem resolves to {stem}_m.webp on disk
  ✓ media.defaultColor matches colors[0] or is null

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
║  PRODUCT IMAGES                                                      ║
║  ──────────────────────────────────────────────────────────────────  ║
║  import { contentImage } from '@core/images';                        ║
║  import { getImage } from '@core/media';                             ║
║  const img = getImage(product.media, 'top');                         ║
║  contentImage(product.imagePath, img.stem, 'm')                      ║
║                                                                      ║
║  BRAND LOGOS                                                         ║
║  ──────────────────────────────────────────────────────────────────  ║
║  import { brandImage } from '@core/images';                          ║
║  brandImage(brand.slug, 'logo_black', 'xs')                         ║
║                                                                      ║
║  GAME IMAGES                                                         ║
║  ──────────────────────────────────────────────────────────────────  ║
║  import { gameImage } from '@core/images';                           ║
║  gameImage(game.slug, 'box-art-cover', 's')                         ║
║                                                                      ║
║  ARTICLE HERO                                                        ║
║  ──────────────────────────────────────────────────────────────────  ║
║  import { articleImage } from '@core/images';                        ║
║  articleImage(article.imagePath, 'hero', 'xl')                       ║
║                                                                      ║
║  REVIEW → PRODUCT LOOKUP                                             ║
║  ──────────────────────────────────────────────────────────────────  ║
║  const product = products.find(p => p.slug === review.productId);    ║
║  // product now has ALL data AND media object                        ║
║                                                                      ║
║  ✗ FORBIDDEN                                                         ║
║  ──────────────────────────────────────────────────────────────────  ║
║  `/images/${cat}/${slugify(brand)}/${slugify(model)}/...`            ║
║  Any string concatenation to build image paths in components         ║
║  Hardcoded brand/model strings instead of reading from product       ║
║                                                                      ║
╚══════════════════════════════════════════════════════════════════════╝
```
