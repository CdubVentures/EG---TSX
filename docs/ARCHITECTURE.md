# EG-TSX Architecture Plan

> **Status:** Draft — awaiting founder approval before implementation
> **Last updated:** 2026-03-03
> **Stack:** Astro 5 · React 19 · Tailwind v4 · MDX · TypeScript
> **Migrating from:** EG-HBS (Express · Handlebars · jQuery · Redis)

---

## 1. Rendering Strategy: Astro Hybrid Mode

Astro hybrid mode gives us **two rendering modes in one project**:

| Render mode | What uses it | Why |
|-------------|-------------|-----|
| **Static (SSG)** | Reviews, guides, news, brands, games, pages, **hub pages** | Content doesn't change per-user. Built once → cached forever on CDN. Instant load. |
| **Server (SSR)** | Auth callbacks, user API routes | Needs to read cookies, talk to DynamoDB, validate tokens on every request. |

**Hub pages** (`/hubs/mouse?brand=razer&weight=50-80`) are **static shells** with a React island that reads URL query params and filters/sorts client-side. No server involved — all filtering happens in the browser. This is the modern industry standard (Amazon, Newegg, PCPartPicker all work this way). URLs with query params remain fully bookmarkable and shareable.

**How it works:**
- By default, every page is **static** (pre-built HTML at build time).
- Any file that exports `export const prerender = false` becomes **SSR** (rendered on each request by a server/Lambda).
- React islands (`client:visible`, `client:load`) hydrate on the client for interactivity (login popups, vault buttons, PC builder).

**In `astro.config.mjs`:**
```js
output: 'hybrid',              // static by default, opt-in SSR
adapter: aws(),                // or node() for dev, cloudflare(), etc.
```

---

## 2. Directory Structure (Canonical)

```
EG - TSX/
├── public/
│   └── images/                         # ← ALL product + article images live here
│       ├── mouse/{brand}/{model}/      #   Served at /images/mouse/razer/viper/...
│       ├── keyboard/{brand}/{model}/
│       ├── monitor/{brand}/{model}/
│       ├── brands/{slug}/
│       ├── reviews/{category}/{slug}/
│       ├── news/{category}/{slug}/
│       ├── guides/{category}/{slug}/
│       └── navbar/                     # Category + nav SVG icons (mask-image)
│           ├── mouse.svg              #   10 category icons + house.svg
│           ├── keyboard.svg
│           └── ...
│
├── scripts/
│   ├── migrate-content.mjs             # Phase 1 migration (done)
│   ├── migrate-to-slug-folders.mjs     # Flat → slug-folder migration (done, idempotent)
│   ├── validate-image-links.mjs        # Content → image folder validator
│   ├── sync-rename.mjs                 # Atomic content + image folder rename
│   ├── new-content.mjs                 # Create new MDX + image folder
│   └── archive/
│       └── .id-crosswalk.json          # Historical CUID2 crosswalk (migration artifact)
│
├── src/
│   ├── content.config.ts               # Zod schemas for all content collections
│   │
│   ├── content/                        # MDX content collections (Astro Content Layer)
│   │   ├── reviews/{category}/{slug}/index.mdx     # Slug-folder layout
│   │   ├── brands/{slug}/index.mdx
│   │   ├── games/{slug}/index.mdx
│   │   ├── guides/{category}/{slug}/index.mdx
│   │   ├── news/{category}/{slug}/index.mdx
│   │   └── pages/{slug}/index.mdx
│   │
│   ├── data/                           # Structured data (JSON registries)
│   │   ├── products/
│   │   │   ├── mouse.json              # 342 products, keyed by slug + all specs
│   │   │   ├── keyboard.json
│   │   │   └── monitor.json
│   │   ├── tooltips/
│   │   │   ├── mouse.ts                # Mouse tooltip content (~100 keys)
│   │   │   ├── keyboard.ts             # Keyboard tooltip content (~50 keys)
│   │   │   └── index.ts                # Unified lookup: getTooltip(category, key)
│   │   ├── metrics/
│   │   │   ├── mouse.json              # xxlMetrics config: which SVG type per metric, sections, suffixes
│   │   │   ├── distributions/
│   │   │   │   └── mouse.json          # Build-time computed: bin edges, counts, min/max per metric key
│   │   │   ├── scoring.ts              # scoreFromMinMax(), scoring pipeline (pure functions)
│   │   │   └── index.ts                # getMetricConfig(category), getDistribution(category, key)
│   │   ├── recommender/
│   │   │   ├── mouse.json              # Build-time computed: similar[] + recommended[] per product
│   │   │   ├── similarity.ts           # Similar scoring: spec-driven, within-category (pure functions)
│   │   │   ├── affinity.ts             # Recommended scoring: cross-category affinity (pure functions)
│   │   │   └── index.ts                # getSimilar(category, id), getRecommended(category, id)
│   │   ├── hub-tags/
│   │   │   ├── mouse.ts                # Per-category filter config (sliderItems, toggleItems, filterOrder)
│   │   │   ├── tag-scorer.ts           # hubTag selection: weighted scoring + deterministic "random" pick
│   │   │   └── index.ts                # getHubTags(category, product), tagValueWithLink(product, key, category)
│   │   ├── affiliates/
│   │   │   ├── retailers.yaml          # 5 retailers with search URL templates (Amazon primary)
│   │   │   └── resolver.ts             # dealLink(): primary affiliate → retailer search → Amazon fallback
│   │   └── schemas/                    # Zod schemas for product data validation
│   │
│   ├── core/                           # App-wide infrastructure (no UI)
│   │   ├── config.ts                   # Centralized knobs (pagination, timeouts, CDN)
│   │   ├── images.ts                   # Image URL resolver (contentImage) — ONLY place paths are built
│   │   ├── media.ts                    # Product media helpers (getImage, getCarouselImages, etc.)
│   │   ├── auth/
│   │   │   ├── cognito.ts              # OIDC client setup, token validation
│   │   │   ├── session.ts              # DynamoDB session read/write
│   │   │   └── guard.ts               # Auth guard helper for SSR endpoints
│   │   ├── routing/
│   │   │   └── slugs.ts               # Slug derivation helpers
│   │   └── seo/
│   │       ├── meta.ts                # Meta tag builders
│   │       └── structured-data.ts     # JSON-LD schema generators
│   │
│   ├── shared/                         # Reusable primitives (no business logic)
│   │   ├── ui/
│   │   │   ├── Button.tsx
│   │   │   ├── ModalShell.tsx          # Background blur + close button (Popover API)
│   │   │   ├── TooltipTrigger.astro     # Native Popover API trigger (? icon)
│   │   │   ├── ScoreRing.astro          # Overall score ring (0-10, used outside hub)
│   │   │   ├── MetricRating.astro      # Rating circle SVG (filled ring, 0-10 score)
│   │   │   ├── MetricGauge.astro       # Gauge SVG with needle (polling rate, DPI, etc.)
│   │   │   ├── MetricSpeedometer.astro # 10-segment shell SVG with needle (latency, force)
│   │   │   ├── MetricPerformance.astro # Arc/progress SVG (70% arc)
│   │   │   ├── MetricWeight.astro      # Reverse-fill ring with feather icon (lighter=better)
│   │   │   ├── MetricSensor.astro      # Concentric circles with crosshair (sensor recency)
│   │   │   ├── MetricFeet.astro        # Ring with mouse-foot art (skate score)
│   │   │   ├── DistributionChart.astro # Bar chart showing product distribution per metric
│   │   │   ├── TaggedCard.astro        # Product feed card (image, brand/model, deal link, hub tags, compare)
│   │   │   ├── FeedScroller.astro     # Horizontal scroller with left/right arrows (recommended, similar)
│   │   │   ├── SmartSlider.tsx         # Image gallery/carousel
│   │   │   └── TagBadge.tsx
│   │   ├── layouts/
│   │   │   ├── MainLayout.astro        # Shell: head, nav, footer, auth popups + color derivation engine (21 site + 150 category CSS vars)
│   │   │   ├── ArticleLayout.astro     # Review/guide/news article wrapper
│   │   │   └── HubLayout.astro         # Product hub/grid wrapper
│   │   └── lib/
│   │       └── cn.ts                   # CVA + clsx + tailwind-merge utility
│   │
│   ├── features/                       # Domain features (business logic + UI)
│   │   ├── auth/
│   │   │   ├── store.ts               # Nano Store: $auth + $authDialog + BroadcastChannel sync
│   │   │   ├── hosted-ui.ts           # Popup/redirect logic (postMessage + cookie poll)
│   │   │   ├── types.ts               # AuthState, GUEST, LOADING type definitions
│   │   │   ├── schemas.ts             # Zod schemas for /api/auth/me response
│   │   │   ├── server/
│   │   │   │   ├── cognito-config.ts  # Zod-validated Cognito config from env
│   │   │   │   ├── cookies.ts         # HttpOnly cookie helpers (session, refresh, hint, PKCE)
│   │   │   │   ├── jwt.ts             # JWT verification via jose JWKS + expiry helper
│   │   │   │   ├── oidc.ts            # OIDC state generation, PKCE challenge, return URL validation
│   │   │   │   ├── refresh.ts         # Token refresh via Cognito /oauth2/token
│   │   │   │   └── token-exchange.ts  # Authorization code → token exchange (with PKCE)
│   │   │   ├── components/
│   │   │   │   ├── AuthDialog.tsx     # <dialog> shell (showModal, auto-close on auth)
│   │   │   │   ├── LoginView.tsx      # Login panel (Google, Discord, Email buttons)
│   │   │   │   ├── SignupView.tsx     # Signup panel
│   │   │   │   ├── BrandLogo.tsx      # EG wordmark for auth dialog
│   │   │   │   └── GoogleIcon.tsx     # Google "G" SVG icon
│   │   │   └── tests/
│   │   │       ├── auth-server.test.mjs    # 39 tests (PKCE, cookies, refresh, return URL, JWT)
│   │   │       ├── auth-store.test.mjs     # Store state management tests
│   │   │       ├── auth-hydrate.test.mjs   # hydrateAuth() fetch tests
│   │   │       ├── auth-schemas.test.mjs   # Zod schema validation tests
│   │   │       └── auth-dialog-store.test.mjs # Dialog open/close + view switching
│   │   │
│   │   ├── hub/
│   │   │   ├── image-resolver.ts       # Stem → full CDN URL with size suffix
│   │   │   ├── store.ts               # Nano Store: filters, sort, view, compare state
│   │   │   ├── url-sync.ts            # Read/write query params ↔ store (pushState)
│   │   │   ├── filter-engine.ts       # Pure functions: apply filters, compute counts
│   │   │   └── components/
│   │   │       ├── HubApp.tsx          # Top-level island: reads URL → store → renders
│   │   │       ├── ProductCard.tsx
│   │   │       ├── ProductGrid.tsx     # Grid/list views (small, medium, large, list)
│   │   │       ├── FilterBar.tsx       # Brand toggles, slider ranges, search
│   │   │       ├── SortDropdown.tsx
│   │   │       ├── ViewSwitcher.tsx    # Small/medium/large/list toggle
│   │   │       ├── CompareMatrix.tsx   # Stats/shapes/radar comparison
│   │   │       └── SpecsGrid.tsx
│   │   │
│   │   ├── vault/
│   │   │   ├── store.ts               # Nano Store: persona-scoped localStorage + atom
│   │   │   ├── sync.ts                # Sync engine: auth ↔ vault ↔ DynamoDB ↔ cross-tab
│   │   │   ├── merge.ts               # Pure merge: guest + server → unified vault
│   │   │   ├── types.ts               # VaultProduct, VaultEntry, AddResult, sync types
│   │   │   ├── index.ts               # Public API barrel
│   │   │   ├── server/
│   │   │   │   ├── db.ts              # DynamoDB: readVault, writeVault, readVaultRev
│   │   │   │   └── schema.ts          # Zod schemas for API validation
│   │   │   ├── components/
│   │   │   │   ├── VaultToggleButton.tsx  # Save/unsave product (appears on cards)
│   │   │   │   ├── VaultCount.tsx         # Badge count in navbar
│   │   │   │   └── VaultDropdown.tsx      # Mega-menu vault preview
│   │   │   └── tests/
│   │   │       ├── vault-store.test.mjs
│   │   │       ├── vault-sync.test.mjs
│   │   │       └── vault-schema.test.mjs
│   │   │
│   │   ├── pc-builder/
│   │   │   ├── store.ts               # Nano Store: current build
│   │   │   └── components/
│   │   │       ├── PartSlot.tsx
│   │   │       ├── WattageMeter.tsx
│   │   │       └── AddToBuildBtn.tsx
│   │   │
│   │   ├── comments/
│   │   │   ├── services/
│   │   │   │   └── api.ts             # Fetch comments from API
│   │   │   └── components/
│   │   │       ├── CommentThread.tsx
│   │   │       └── CommentForm.tsx
│   │   │
│   │   └── profile/
│   │       └── components/
│   │           ├── ProfilePage.tsx     # Account settings island
│   │           └── UsernameEditor.tsx  # Username set/change with validation
│   │
│   ├── pages/                          # File-based routing
│   │   ├── index.astro                 # Home page (static)
│   │   │
│   │   ├── reviews/
│   │   │   ├── index.astro             # All reviews hub (static)
│   │   │   └── [...slug].astro         # Dynamic review pages (static, getStaticPaths)
│   │   │
│   │   ├── brands/
│   │   │   └── [...slug].astro
│   │   ├── games/
│   │   │   └── [...slug].astro
│   │   ├── guides/
│   │   │   └── [...slug].astro
│   │   ├── news/
│   │   │   └── [...slug].astro
│   │   │
│   │   ├── hubs/
│   │   │   ├── index.astro             # Hub index (tools: hub, database, versus, radar, shapes)
│   │   │   └── [category].astro        # Static shell → <HubApp client:load /> reads URL query params
│   │   │
│   │   ├── account.astro               # Profile page (static shell + React island)
│   │   │
│   │   ├── login/
│   │   │   ├── index.ts              # SSR: email/password (identity_provider=COGNITO, PKCE)
│   │   │   ├── google.ts             # SSR: Google OAuth (identity_provider=Google, PKCE)
│   │   │   └── discord.ts            # SSR: Discord OAuth (identity_provider=Discord, PKCE)
│   │   ├── logout.ts                  # SSR: clear cookies, Cognito sign-out
│   │   │
│   │   ├── auth/
│   │   │   └── callback.ts           # SSR: smart callback (popup postMessage OR mobile 302)
│   │   │
│   │   └── api/                        # SSR API endpoints
│   │       ├── auth/
│   │       │   └── me.ts              # GET: { loggedIn, user }
│   │       ├── user/
│   │       │   ├── prefs.ts           # GET/PUT user preferences
│   │       │   ├── vault.ts           # GET/PUT saved products
│   │       │   └── username.ts        # GET/PUT/check username
│   │       └── search.ts              # GET: search products + content
│   │
│   └── styles/
│       └── global.css                  # CSS variables + Tailwind v4 @theme
│
├── config/
│   ├── categories.json                   # SSOT: site colors, category IDs/labels/colors/flags
│   ├── category-manager.py               # GUI: edit site theme, category colors, toggle flags
│   └── navbar-manager.py                 # GUI: edit navbar mega-menu structure and links
│
├── cognitoUI/
│   └── template.css                    # Cognito Hosted UI dark theme CSS (upload to AWS Console)
│
├── astro.config.mjs
├── tsconfig.json
├── package.json
├── .env.example
├── ARCHITECTURE.md
└── AGENTS.md
```

---

## 2b. Config Tooling (`config/`)

The `config/` directory contains JSON data files and Python GUIs for managing site-wide settings without touching source code.

### `config/categories.json` — Single Source of Truth

Stores **all** category and site color data in one file:

```json
{
  "siteColors": { "primary": "#394cc8", "secondary": "#00aeff" },
  "categories": [
    { "id": "mouse", "label": "Mouse", "plural": "Mice", "color": "#00aeff",
      "product": { "production": true, "vite": true },
      "content": { "production": true, "vite": true } }
  ]
}
```

**Consumers:**
- `src/shared/layouts/MainLayout.astro` — derives 21 `--site-*` + 150 `--cat-*` CSS variables at build time
- `src/core/config.ts` — exports `CONFIG.categories` (product-active IDs), `CONFIG.contentCategories` (content-active IDs), `plural()`, `categoryColor()`
- `src/content.config.ts` — build-time drift check ensures Zod enums match JSON
- `config/navbar-manager.py` — reads category colors for navbar color coding

**Flags:** Each category has `product` and `content` sub-objects with `production` and `vite` booleans. A category is active when `production === true` OR `(DEV && vite === true)`. This allows staging new categories in dev before enabling in production.

### `config/category-manager.py`

Tkinter GUI (Catppuccin Mocha dark theme) for managing:
- **Site theme** — primary + secondary colors with live gradient preview, derived swatches
- **Category cards** — color picker, label/plural editing, product/content toggles, article counts, icon status
- **Auto-discovery** — scans content frontmatter for categories not yet in JSON
- **Icon audit** — red "MISSING ICON" flag for categories without `public/images/navbar/{id}.svg`

Run: `python config/category-manager.py`

### `config/navbar-manager.py`

Tkinter GUI for managing navbar mega-menu structure (guide sections, brand lists, hub links). Reads category colors from `categories.json` for consistent color coding.

Run: `python config/navbar-manager.py`

### Navbar Icons (`public/images/navbar/`)

10 SVG icons (one per category) used as CSS `mask-image` in the navbar mega-menus and vault dropdown. Convention: 24x24 viewBox, stroke-based (`stroke="#000" stroke-width="2"`), `fill="none"`.

Adding a new category icon:
1. Create `public/images/navbar/{id}.svg` matching the existing style
2. Add `.icon-{id}` CSS class in `src/shared/layouts/NavLinks.astro`
3. Verify via category-manager.py (icon status indicator)

Full color/icon documentation: `docs/CATEGORY-COLORS.md`

---

## 3. Image System

### Current state (EG-HBS)
- Images live at `EG-HBS/images/` (project root, NOT in `public/`)
- Express middleware serves `/images/*` from disk in dev (`USE_LOCAL_IMAGES=TRUE`)
- Express middleware 301-redirects `/images/*` to CloudFront in prod
- CloudFront URL: `https://d3m2jw9ed15b7k.cloudfront.net`
- Product JSON stored flat image stem fields (`imgTop`, `featureImgCover`, etc.)
- Templates append size suffixes: `_blur`, `_t`, `_xs`, `_s`, `_m`, `_l`, `_xl`, `_xxl`
- Color variants stored as `__c_{color}` fields in product JSON

### New state (EG-TSX)

**Images move to `public/images/`.**

In Astro, `public/` contents are served as-is at the root URL:
```
public/images/mouse/razer/viper/img_xl.webp
  → http://localhost:4321/images/mouse/razer/viper/img_xl.webp     (dev)
  → https://expertgaming.gg/images/mouse/razer/viper/img_xl.webp  (prod via CDN)
```

No middleware needed. Astro dev server serves `public/` automatically. In prod, the deploy adapter uploads `public/` to S3 → CloudFront serves it.

**Why this is better:**
- No custom Express middleware
- No `USE_LOCAL_IMAGES` env var
- Same path works in dev and prod
- Industry standard for every modern framework (Next.js, Remix, Astro, Vite)

### Image folder structure
```
public/images/
├── mouse/
│   └── {brand}/
│       └── {slug}/                     # matches product.imagePath
│           ├── top_blur.webp           # Blurred placeholder (LQIP)
│           ├── top_s.webp              # Small (320px)
│           ├── top_m.webp              # Medium (640px)
│           ├── top_l.webp              # Large (960px)
│           ├── top_xl.webp             # Extra large (1280px)
│           ├── top---white+black_m.webp  # Color variant (--- separator)
│           ├── feature-image_xxl.webp  # Hero/feature image
│           ├── shape-side.svg          # SVG shape diagram
│           └── originals/              # Source files (not served)
│
├── keyboard/{brand}/{slug}/...
├── monitor/{brand}/{slug}/...
│
├── reviews/{category}/{slug}/          # Article hero images
├── guides/{category}/{slug}/
├── news/{category}/{slug}/
├── brands/{slug}/                      # Brand logos and marketing
└── games/{slug}/                       # Game artwork
```

**Stem naming convention:**
- `{view}` — base view (`top`, `left`, `feature-image`, `bot`, `angle`, etc.)
- `{view}---{color}` — color variant (`---` separator, e.g., `top---white+black`)
- `{view}___{edition}` — edition variant (`___` separator)
- `{view}___{edition}---{color}` — edition + color combined
- `{view}{seq}` — sequential images (`img1`, `img2`, etc.)
- Size suffix always last: `_{size}.webp` (blur, t, xs, s, m, l, xl, xxl, zoom)

### Image resolver contract

> **Full documentation:** `docs/DATA-IMAGE-CONTRACT.md` (dual source of truth — data AND images)
> **Diagrams:** `docs/diagrams/dual-source-of-truth.md` | `docs/diagrams/product-identity-flow.md` | `docs/diagrams/article-identity-flow.md`

**Components NEVER build image paths from brand + model strings.** Every product carries a pre-built `imagePath` field and a structured `media` object. A centralized resolver constructs the full URL:

```typescript
// src/core/images.ts — the ONLY place image URLs are constructed
export function contentImage(basePath: string, stem: string, size: ImageSize, ext = 'webp'): string {
  return `${CONFIG.cdn.baseUrl}${basePath}/${stem}_${size}.${ext}`;
}

// src/core/media.ts — helpers for querying the structured media object
export function getImage(media: ProductMedia, view: string, color?: string): ProductImage | null;
export function getCarouselImages(media: ProductMedia, color?: string): ProductImage[];
export function getAvailableColors(media: ProductMedia): string[];
export function hasColorVariants(media: ProductMedia): boolean;
```

**Every component uses the media helpers + resolver:**

```astro
---
import { contentImage } from '@core/images';
import { getImage } from '@core/media';
const { product } = Astro.props;
const topImg = getImage(product.media, 'top');
---
{topImg && <img src={contentImage(product.imagePath, topImg.stem, 'm')} />}
```

**Why:** When a brand or model name changes, the sync script updates `imagePath` in the product JSON and moves the image folder. Components never change because they never knew what the path was built from. The `media` object is auto-generated from filesystem scan (`scripts/build-media.mjs`). See `docs/DATA-IMAGE-CONTRACT.md` for the full contract.

### Creating new content → image folders
The `scripts/new-content.mjs` script will:
1. Derive a slug from the content name (e.g., "Razer Viper V3" → `razer-viper-v3`)
2. Create the `.mdx` file with frontmatter template
3. For reviews: set `productId` to the product slug (images come from product folder)
4. For guides/news: create image folder at `public/images/{type}/{category}/{slug}/`
5. Open the file in your editor

**Product data** is managed by Spec Factory (Phase 13). Spec Factory exports product JSON registries with slug, imagePath, and all specs. A sync bridge propagates renames (brand/model/variant changes) to EG-TSX files and image folders atomically. During dev, product JSON files are edited directly.

---

## 4. Content Pipeline

### How content works in Astro 5

```
MDX file (frontmatter + body)
    ↓  validated by
Zod schema (src/content.config.ts)
    ↓  queried via
getCollection('reviews')  /  getEntry('reviews', slug)
    ↓  rendered by
Astro page ([...slug].astro)
    ↓  built into
Static HTML (dist/)
    ↓  deployed to
S3 + CloudFront
```

**No Redis. No RAM cache. No Express.** The content is compiled into HTML at build time. CloudFront caches and serves it globally.

### Migration path: `.md` → `.mdx`

| Phase | Format | Why |
|-------|--------|-----|
| Now (Phase 1 done) | `.md` | Source files have HBS helpers (`{{{pcards_row ...}}}`) that aren't valid MDX |
| Phase 4 (components) | `.mdx` | Replace HBS helpers with React components (`<ProductCards pins="home" />`) |

The migration script currently outputs `.md` because the body content has raw Handlebars syntax. When we build the React components that replace those helpers, we'll convert each file to `.mdx` and swap the syntax:

```mdx
{/* Before (Handlebars — invalid MDX) */}
{{{pcards_row pins="home" display_start=1 display_end=5}}}

{/* After (MDX — valid React component) */}
<ProductCards pins="home" start={1} end={5} badge="Best Buy" />
```

### Product data flow

Product JSON registries (`src/content/data-products/{category}/{brand}/{slug}.json`) are loaded via Astro's content layer as the `dataProducts` collection:

```typescript
// In an Astro page
import { getCollection, getEntry } from 'astro:content';
const allProducts = await getCollection('dataProducts');

// Look up product by slug (linked from review frontmatter)
const product = allProducts.find(p => p.data.slug === entry.data.productId);

// Get image URL via media helpers + resolver — NEVER build path from brand + model
import { contentImage } from '@core/images';
import { getImage } from '@core/media';
const heroImg = getImage(product.data.media, 'feature-image');
const heroSrc = heroImg ? contentImage(product.data.imagePath, heroImg.stem, 'xxl') : null;
```

**Dual Source of Truth:** Each product JSON object is the single source of truth for both **data** (specs, scores, display names) and **images** (pre-built `imagePath` field + image stem fields). Components receive one product object and get everything they need — `product.brand` for display, `product.weight` for specs, `product.imagePath` for images. Nothing is derived from brand + model strings. This makes the system **rename-safe** — when Spec Factory renames a brand or model, the sync script updates all fields atomically, and components render correctly without code changes.

**When product data changes** (new product, price update, spec correction):
1. Spec Factory exports updated JSON (or edit JSON manually during dev)
2. Rebuild and deploy (~2 min with Astro)
3. CloudFront serves the updated pages

**When a product is renamed** (brand, model, or variant change):
1. Spec Factory sync script updates product JSON (`slug`, `imagePath`, `url`, `model`)
2. Sync script moves image folder to match new slug path
3. Sync script rewrites `productId` in any linked reviews
4. Rebuild and deploy — components produce correct URLs automatically

See `docs/DATA-IMAGE-CONTRACT.md` for the full contract.

---

## 5. Hub Pages: Static Shell + Client-Side Filtering

Hub pages (`/hubs/mouse`, `/hubs/keyboard`, `/hubs/monitor`) use **fully bookmarkable URLs with query params** — but all filtering, sorting, and view switching happens **client-side in a React island**. No server involved.

### How it works

```
/hubs/mouse?brand=razer,logitech&weight=50-80&sort=price_low_to_high&view=large
     │
     ▼
┌──────────────────────────────────────────────────────┐
│  [category].astro  (STATIC — built once at build)    │
│                                                      │
│  Embeds slim product data in <script> tag            │
│  ┌────────────────────────────────────────────────┐  │
│  │  <HubApp client:load />  (React island)        │  │
│  │                                                │  │
│  │  1. Reads URL query params on mount            │  │
│  │  2. Hydrates Nano Store with filter state      │  │
│  │  3. Runs filter-engine → filtered products     │  │
│  │  4. Renders cards in selected view mode        │  │
│  │  5. On filter change → pushState() updates URL │  │
│  │                                                │  │
│  │  No server round-trips. Everything in-browser. │  │
│  └────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────┘
```

### URL query params (all bookmarkable, all client-side)

| Param | Example | Purpose |
|-------|---------|---------|
| `view` | `?view=large` | Grid layout: small, medium, large, list |
| `brand` | `?brand=razer,logitech` | Filter by brand (comma-separated) |
| `sort` | `?sort=price_low_to_high` | Sort order |
| `search` | `?search=viper` | Text search on brand + model |
| `{slider}` | `?weight=50-80` | Range filter (min-max) |
| `{toggle}` | `?colors=black,white` | Toggle filter (comma-separated values) |
| `compare` | `?compare=stats` | Comparison mode: stats, shapes, radar |
| `image` | `?image=img2` | Which product image to display |

### Data flow

```
Build time:
  mouse.json (1.4 MB, 145 fields)
      ↓  slim down to display fields only
  hubData.mouse.json (~80 KB, 15-20 fields per product)
      ↓  embedded in static HTML as <script>
  window.__HUB_DATA__

Runtime (browser):
  URL query params  →  url-sync.ts  →  $hubStore (Nano Store)
                                            ↓
  filter-engine.ts  ←  $hubStore  →  HubApp.tsx  →  renders cards
       ↓
  Filtered products  →  ProductGrid.tsx  →  DOM
       ↓
  Filter counts  →  FilterBar.tsx  →  "12 results" badges
```

### Why static + client-side (not SSR)

This is the industry standard. Amazon, Newegg, PCPartPicker, Best Buy — all serve a static shell and filter client-side. Reasons:

- **No server cost** — hub pages are the most visited, static = free CDN serving
- **Instant page load** — static HTML loads from nearest CDN edge
- **No filter flash** — skeleton shown for ~100ms while React hydrates, then filtered cards appear
- **Same bookmarkable URLs** — `pushState()` updates URL without page reload
- **Current system already works this way** — after initial server render, all filter changes happen client-side via React hydration

### Slim data vs full data

The full `mouse.json` has 145+ fields per product (1.4 MB). Hub cards only need ~15-20 fields. At build time, we generate a slim JSON with only what the hub needs:

```typescript
// Slim hub record — only display + filter fields
interface HubProduct {
  slug: string;           // primary key
  brand: string;
  model: string;
  imagePath: string;      // pre-built image folder prefix (e.g., "/images/mouse/razer/viper-v3-pro")
  img: string;            // image stem (e.g., "top---white+black")
  price: number;
  rating: number;
  releaseDate: string;
  weight: number;
  // ... filter-relevant specs (sensor, switch, shape, etc.)
  // NOT: full review text, all 145 fields, color variant data
}
```

This keeps the embedded data to ~80 KB for 342 mice — loads instantly.

---

## 6. Metrics System (Visual SVG Scoring)

### What metrics are
Metrics are **visual SVG displays** on product cards that show how a product's specs compare against the distribution of all products in that category. They are NOT tooltips — they are a separate visual system.

### The 5 SVG visual types

| SVG Type | Component | Used for | How it works |
|----------|-----------|----------|-------------|
| **Rating Circle** | `MetricRating.astro` | Accuracy, comfort, overall, genre scores | Filled ring proportional to 0-10 score. `stroke-dashoffset` + gradient. |
| **Reverse Rating** | `MetricWeight.astro` | Weight (lighter = better) | Same ring but fill is inverted. Feather icon inside. |
| **Gauge** | `MetricGauge.astro` | Polling rate, DPI, IPS, acceleration | 70% arc (235°–485°) with rotating needle + 5 tick marks. |
| **Performance Arc** | `MetricPerformance.astro` | Non-speedometer performance metrics | Progress arc with value text + suffix inside. |
| **Speedometer** | `MetricSpeedometer.astro` | Sensor latency, click force, click latency, lift-off | 10-segment fan shell with rotating needle. |

Plus special visual treatments:
- **Sensor** (`MetricSensor.astro`) — concentric circles + crosshair, shows sensor date as year
- **Feet/Skates** (`MetricFeet.astro`) — circle with mouse-foot SVG art inside a rating ring

### XXL card layout (4 sections, 2 rows of 2 columns)

```
┌─────────────────────────┬─────────────────────────┐
│  Ratings                │  Build                  │
│  ● Overall  ● Accuracy  │  ◎ Sensor  ◎ Weight    │
│  ● Response ● Quality   │  ◎ Skates              │
│  ● Comfort  ● Work      │                         │
│  ● FPS ● MMO ● MOBA     │                         │
│  ● AARPG ● RTS          │                         │
├─────────────────────────┼─────────────────────────┤
│  Hardware               │  Performance            │
│  ⊙ Polling  ⊙ DPI      │  ◉ Sensor Latency      │
│  ⊙ IPS     ⊙ Accel     │  ◉ Click Force         │
│                         │  ◉ Switch Latency      │
│                         │  ◉ Lift-Off            │
└─────────────────────────┴─────────────────────────┘
● = Rating circle  ◎ = Custom SVG  ⊙ = Gauge  ◉ = Speedometer
```

### Metric config: `src/data/metrics/{category}.json`

Per-category config that defines which metrics each card size shows, what SVG type to use, and per-metric options:

```json
{
  "sectionOne": "Ratings",
  "ratings": [
    { "key": "accuracy", "label": "Accuracy", "score": true },
    { "key": "response", "label": "Response", "score": true }
  ],
  "sectionTwo": "Build",
  "weight": [
    { "key": "weight", "label": "Weight", "suffix": "g", "invert": true }
  ],
  "sectionThree": "Hardware",
  "gauges": [
    { "key": "polling_rate", "label": "Polling", "arrayHighLow": "high", "suffix": "hz" },
    { "key": "dpi", "label": "DPI", "suffix": "k" }
  ],
  "sectionFour": "Performance",
  "speedometer": [
    { "key": "sensor_latency", "label": "Sensor Latency", "suffix": "ms", "invert": true }
  ]
}
```

Key flags:
- `score: true` — value is already 0-10 (no normalization needed)
- `invert: true` — lower raw value = higher score (weight, latency)
- `arrayHighLow: "high" | "low"` — which value to pick from array fields
- `suffix` / `prefix` — display formatting

### Metric distributions: `src/data/metrics/distributions/{category}.json`

**Computed at build time** by scanning all products. Each key is a product field:

```json
{
  "accuracy": {
    "values": [0, 0.5, 1, ..., 10],
    "counts": [0, 0, 0, ..., 22, 6, 22, 2, 0],
    "score": true,
    "invert": false,
    "min": 0,
    "max": 10
  },
  "weight": {
    "values": [42, 48, 55, 59, 63, 68, 75, 80, 85, 90, 95, 100, 110, 120, 130],
    "counts": [2, 5, 12, 18, 25, 30, 28, 20, 15, 8, 4, 3, 2, 1, 1],
    "score": false,
    "invert": true,
    "min": 42,
    "max": 130
  }
}
```

- **Score fields** (`score: true`): 21 fixed bins (0, 0.5, 1, ..., 10)
- **Raw value fields** (`score: false`): unique values as bin edges (max ~20 bins), plus min/max for scoring

### Scoring pipeline

```
Raw product value (e.g., weight = 63g)
    ↓
scoreFromMinMax(rawValue, distribution)
    ↓  if score: true  → clamp(rawValue, 0, 10)
    ↓  if score: false → frac = (raw - min) / (max - min)
    ↓                    if invert: frac = 1 - frac
    ↓                    score = frac * 10
    ↓
0-10 score
    ↓
categoryScoreColor(score, category)
    ↓  score ≥ 7.5 → category brand color
    ↓  score ≥ 5   → category brand color (lighter)
    ↓  score > 0   → neutral warm tone
    ↓  score = 0   → gray (N/A)
    ↓
SVG parameters (strokeOffset, needleAngle, colors)
    ↓
SVG component renders
```

### Composite tooltip pattern (metrics + tooltips combined)

Each metric SVG card also shows a **composite tooltip** on hover/click. This tooltip combines two things:

1. **Tooltip text** (top) — the category explainer from `src/data/tooltips/` (e.g., "What is DPI?")
2. **Distribution bar chart** (bottom) — shows where this product falls among all products

This means the `metricTooltip()` from HBS is replaced by the **same global popover** from Phase 4, but with an extended content area:

```html
<div id="global-tooltip" popover role="tooltip">
  <strong id="tooltip-title"></strong>
  <p id="tooltip-body"></p>
  <!-- Distribution section — only shown when data-tooltip-dist is present -->
  <div id="tooltip-dist" class="hidden">
    <h6>Distribution:</h6>
    <p>Each bar shows how many products received that score; the highlighted bar is this item's score.</p>
    <div id="tooltip-dist-bars"></div>
    <div id="tooltip-dist-range"></div>
  </div>
</div>
```

The trigger passes distribution data via `data-tooltip-dist` (JSON) and `data-tooltip-highlight` (bin index):

```html
<button
  popovertarget="global-tooltip"
  data-tooltip-title="What is DPI?"
  data-tooltip-body="Dots Per Inch — controls cursor sensitivity..."
  data-tooltip-dist='{"values":[4200,6000,...],"counts":[1,3,...]}'
  data-tooltip-highlight="7"
>?</button>
```

The positioning script in MainLayout checks for `data-tooltip-dist` — if present, it renders the bar chart; if absent, it shows text-only (same as filter menu tooltips).

### Build-time distribution computation

In HBS, `compileCategory.js::buildMetricDistributions()` scans all products at server startup. In Astro, this moves to a **build-time script**:

```
astro build
    ↓
scripts/build-distributions.mjs (runs before page generation)
    ↓  reads src/content/data-products/mouse/**/*.json (342 products)
    ↓  reads src/data/metrics/mouse.json (metric config)
    ↓  for each metric key:
    ↓    scans all products, collects values, bins them
    ↓    computes min/max/counts
    ↓
    ↓  writes src/data/metrics/distributions/mouse.json
    ↓
Pages import distributions at build time → embedded in static HTML
```

This replaces the runtime `cache.data.hubs.mouse.metricDistributions` with a static JSON file that Astro pages import directly.

---

## 7. Tagged Cards, Recommender & Affiliate System

### What tagged cards are
Tagged cards are the **product feed cards** shown throughout the site — on snapshot pages (recommended / similar sections), in MDX article content, and on the home page. Each card shows a product image, brand/model, a deal button (affiliate link), hub tag pills, and comparison links.

### The 4 sub-systems

| Sub-system | HBS source | TSX location | Purpose |
|-----------|-----------|-------------|---------|
| **Hub Tags** | `compileHubTags.js` (27 KB) | `src/data/hub-tags/` | Auto-select 3-5 spec pill labels per product |
| **Recommender** | `compile_Recommender.js` (42 KB) | `src/data/recommender/` | Compute `similar[]` (5) + `recommended[]` (3-8) per product |
| **Tagged Card** | `card-tagged.handlebars` (215 lines) | `src/shared/ui/TaggedCard.astro` | Renders the actual card UI |
| **Affiliate Links** | `affiliate-retailers.yaml` + `dealLink()` | `src/data/affiliates/` | Resolve deal button URL (primary → search → Amazon fallback) |

### Hub Tags: auto-generated spec pills

`compileHubTags.js` scores every filterable key per product using weighted heuristics, then picks the top 3-5 as clickable pill links on tagged cards.

**Algorithm:**
```
For each product:
  1. Collect all filterable keys (from sliderItems + toggleItems + filterOrder)
  2. Score each key:
     baseScore = UNIVERSAL_WEIGHT[key] + CATEGORY_WEIGHT[category][key]
     + numericPercentileBonus (up to +12)
     + mouseOverrides (polling ≥8000: +10, weight ≤55g: +8, etc.)
     + semanticBoost (left-handed: +12, ambi: +8)
     + scoreGenreBoost (overall ≥9.25: +16, fps=yes: +10, etc.)
  3. Sort by score descending (ties: filterOrder index, then alpha)
  4. Take top 4 deterministically + 1 "random" via seeded FNV-1a hash
  5. Guarantee price_range + at least one score/genre key
```

**Output:** `product.hubTags = ["polling_rate", "price_range", "overall", "weight", "fps"]`

Each tag renders as a clickable pill link that pre-fills the hub filter:
- Slider keys: `±10%` range (e.g., `/hubs/mouse?weight=67-83`)
- Toggle keys: exact value (e.g., `/hubs/mouse?wireless=true`)
- Date keys: `±2 months` window

### Recommender: similar + recommended

`compile_Recommender.js` builds two arrays per product:

**Similar** (within-category, spec-driven, top 5):
```
For each product pair (same category):
  Score = weighted sum of:
    shape match (10) + form_factor (10) + left-friendly pair (18)
    + grip overlap (6) + hand size overlap (6) + weight closeness (8)
    + width (4) + height (4) + connection match (6)
    + polling tier match (16) + MMO tier match (10) + side button closeness (6)
    + genre overlap (6) + price bucket (6) + brand (2) + overall closeness (20)
  Sort descending → take top SIM_LIMIT (5)
```

**Recommended** (cross-category, affinity-driven, 3-8 items):
```
Base score = similarity × (overall / 10) × affinityFactor × brandBonus

Candidate filtering (3 passes):
  Pass 1 (strict): overall ≥ QUALITY_CUTOFF (8), max REC_MAX_PER_CATEGORY (3), no streak > 2
  Pass 2 (relaxed): drop streak check if under REC_MIN (3)
  Pass 3 (floor): admit any remaining if still under REC_MIN
```

**Output shape:**
```json
{
  "slug": "razer-viper-v3-pro",
  "similar": ["razer-deathadder-v3-pro", "logitech-g-pro-x-superlight-2", ...],
  "recommended": ["razer-viper-v3-pro", "wooting-60he", "msi-mpg-321urx-qd-oled", ...]
}
```

### Affiliate link resolution (deal button)

Three-tier resolution for the deal button on every tagged card:

```
Tier 1: Primary affiliate link
  → product.affiliateLinks.find(l => l.isPrimary) → "View Deal"

Tier 2: Retailer search fallback
  → affiliate-retailers.yaml → primaryRetailer (Amazon)
  → urlTemplate: "https://www.amazon.com/s?k={query}&tag=eggear-20" → "Search"

Tier 3: Hard fallback
  → "https://www.amazon.com/s?k={brand}+{model}+{category}&tag=eggear-20" → "Search"
```

**5 configured retailers:** Amazon (primary, enabled), Best Buy (enabled), B&H (enabled), Walmart (disabled), Newegg (enabled). Each has a search URL template with `{query}`, `{brand}`, `{model}`, `{category}` tokens.

### Tagged Card component: `TaggedCard.astro`

Replaces `card-tagged.handlebars`. Static Astro component (zero JS). Contains:

```
┌──────────────────────────────────┐
│  Product image (responsive srcset)│
│  + EG logo watermark              │
├──────────────────────────────────┤
│  Brand   Model   [View Deal]     │
├──────────────────────────────────┤
│  [+ Add to Vault]                │
├──────────────────────────────────┤
│  Snap description                 │
│  [polling: 8000hz] [weight: 58g] │  ← hub tag pills (clickable filter links)
│  [overall: 9.3] [fps]            │
├──────────────────────────────────┤
│  Compare Side-by-Side:           │
│  [Stats] [Radar] [Shapes]        │  ← only when same category as host
├──────────────────────────────────┤
│  Last Updated | 2026-02-15  →    │
└──────────────────────────────────┘
```

### Feed scrollers: `FeedScroller.astro`

Replaces `card-xxlarge-recommended.handlebars` and `card-xxlarge-similar.handlebars`. Renders a collapsible section with horizontal scroller + left/right arrows. Iterates an array of product references and renders `TaggedCard` for each.

Also supports grid mode (`card-xxlarge-tagged-manual.handlebars`) — used in MDX article content via `{{{xxl_tagged}}}` helper, with configurable column count via `--grid-cols` CSS variable.

### Build-time computation (Astro)

All three build-time computations (hub tags, recommender, distributions) move to Astro build scripts:

```
astro build
    ↓
scripts/build-recommender.mjs
    ↓  reads src/content/data-products/mouse/**/*.json (342 products)
    ↓  computes similar[] (5 per product) + recommended[] (3-8 per product)
    ↓  writes src/data/recommender/mouse.json
    ↓
scripts/build-hub-tags.mjs
    ↓  reads src/content/data-products/mouse/**/*.json + filter config
    ↓  scores keys per product, picks top 3-5
    ↓  writes hubTags[] back to product JSON (or separate file)
    ↓
Pages import recommender + hub tag data at build time → rendered into static HTML
```

---

## 8. Authentication Architecture (Implemented)

### What stays the same
- **AWS Cognito User Pool** — same pool, same client ID, same hosted UI
- **DynamoDB tables** — `eg_profiles`, `eg_usernames` — untouched
- **OAuth flow** — Authorization Code Grant with OIDC
- **Social providers** — Google, Discord, email/password — configured in Cognito

### What changed from HBS

| Aspect | HBS (Express) | TSX (Astro) |
|--------|--------------|-------------|
| **Cookies** | Client-readable (`eg_idtoken`, `eg_acctoken`, `eg_reftoken`, `eg_uid`) | HttpOnly (`eg_session`, `eg_refresh`) + client hint (`eg_hint`) |
| **JWT verification** | `openid-client` | `jose` (JWKS-based, cached in memory) |
| **Session** | DynamoDB `eg_sessions` table | Stateless JWT (no session table needed) |
| **PKCE** | None | RFC 7636 S256 challenge on every login |
| **Token refresh** | None (1hr expiry = silent logout) | Middleware auto-refresh at 5-min threshold |
| **Popup detection** | Cookie polling (500ms) | postMessage (primary) + cookie poll (1s fallback) |
| **Mobile login** | Always redirected to `/` | Return URL preserved via `eg_return` cookie |
| **Callback** | Separate popup + mobile endpoints | Single smart `/auth/callback` (detects via `eg_return` cookie) |
| **Email login** | Showed all providers (Google + email form) | `identity_provider=COGNITO` (email/password only, no social buttons) |
| **Hosted UI style** | Default Cognito theme | Dark theme CSS matching site (`cognitoUI/template.css`) |
| **Auth UI** | jQuery popup + globals | `<dialog>` element + Nano Stores + React island |

### Cookie architecture

| Cookie | HttpOnly | Purpose | Max-Age |
|--------|----------|---------|---------|
| `eg_session` | Yes | JWT id_token | 30 days |
| `eg_refresh` | Yes | Cognito refresh token | 30 days |
| `eg_hint` | **No** | Client-readable auth flag (`1` = logged in) | 30 days |
| `eg_first` | **No** | First-signup flag (triggers vault merge) | 5 min |
| `eg_nonce` | Yes | OIDC CSRF state validation | 5 min |
| `eg_pkce` | Yes | PKCE code_verifier | 5 min |
| `eg_return` | **No** | Mobile return URL (set before redirect) | 5 min |

### Route mapping

```
CURRENT (Express)                        ASTRO SSR ENDPOINT
────────────────────────────────────────────────────────────────
GET  /login                    →   src/pages/login/index.ts      (identity_provider=COGNITO)
GET  /login/google             →   src/pages/login/google.ts     (identity_provider=Google)
GET  /login/discord            →   src/pages/login/discord.ts    (identity_provider=Discord)
GET  /signup                   →   src/pages/login/index.ts      (screen_hint=signup)
GET  /auth/callback            →   src/pages/auth/callback.ts    (smart: postMessage OR 302)
GET  /api/auth/me              →   src/pages/api/auth/me.ts      (Cache-Control: no-store)
GET  /logout                   →   src/pages/logout.ts
GET  /api/user/vault           →   src/pages/api/user/vault.ts
PUT  /api/user/vault           →   src/pages/api/user/vault.ts
```

**jQuery auth UI → React islands + Nano Store:**

```
CURRENT (jQuery + globals)                  ASTRO + REACT
────────────────────────────────────────────────────────────────
window.EG_UID                    →   $auth store (Nano Store atom)
window.refreshAuthState()        →   hydrateAuth() → fetch /api/auth/me
popup-login.handlebars           →   <AuthDialog client:load /> (native <dialog>)
popup-signup.handlebars          →   <AuthDialog /> with view='signup'
user_auth.js (600+ lines)        →   store.ts + hosted-ui.ts + middleware.ts
main.handlebars auth watcher     →   $auth.listen() → html.logged CSS class toggle
account_profile.handlebars       →   <ProfilePage client:load /> in account.astro
```

### Login flows

**Desktop (Google/Discord) — instant, no Hosted UI page:**
```
1. User clicks "Google" → openHostedUI('/login/google')
2. Popup opens → /login/google 302s to Cognito → Cognito 302s to Google
3. Google auth → Cognito 302s to /auth/callback
4. Callback sets HttpOnly cookies + returns HTML with postMessage('eg-auth-done')
5. Parent receives postMessage → hydrateAuth() → fetch /api/auth/me → setAuthenticated()
6. AuthDialog effect detects auth → closeAuth() → dialog closes
```

**Desktop (Email/Password) — shows Cognito Hosted UI:**
```
1. User clicks "Email" → openHostedUI('/login')
2. Popup opens → /login 302s to Cognito with identity_provider=COGNITO
3. Cognito renders email/password form (dark theme via cognitoUI/template.css)
4. COOP severs popup reference (popup.closed = true immediately)
5. Cookie poll keeps running (no popup.closed cancellation — 10-min timeout only)
6. User enters credentials → Cognito 302s to /auth/callback
7. Callback sets cookies (including eg_hint=1) + postMessage + self-closes
8. Cookie poll detects eg_hint=1 → hydrateAuth() → dialog closes
```

**Mobile (all providers):**
```
1. User clicks login → openHostedUI() detects mobile
2. Sets eg_return cookie with current page path
3. Full-page redirect to Cognito
4. Auth completes → /auth/callback reads eg_return cookie
5. Callback validates return URL → 302s back to original page (not /)
6. Page loads with eg_hint=1 → html.logged set before paint → hydrateAuth() confirms
```

### Smart callback: single endpoint for popup + mobile

The `/auth/callback` endpoint detects the caller via the `eg_return` cookie:

- **No `eg_return` cookie** → desktop popup → return HTML with `postMessage('eg-auth-done')` + `window.close()`
- **`eg_return` cookie present** → mobile → validate return URL → 302 redirect → clear cookie

Both paths: exchange code for tokens (with PKCE verifier), verify JWT via jose JWKS, set HttpOnly cookies, detect first-signup via DynamoDB `readVaultRev()`.

### PKCE (Proof Key for Code Exchange — RFC 7636)

Every login endpoint generates a PKCE challenge:
1. `code_verifier` = `randomBytes(32).toString('base64url')` (43 chars)
2. `code_challenge` = `SHA-256(verifier).toString('base64url')`
3. Verifier stored in `eg_pkce` HttpOnly cookie (5-min TTL)
4. Challenge sent to Cognito as `code_challenge` + `code_challenge_method=S256`
5. Callback reads `eg_pkce` cookie, passes verifier to token exchange
6. Cognito validates `SHA-256(verifier) === challenge` before issuing tokens

### Token refresh (middleware)

```
src/middleware.ts — runs on every SSR request:

1. Read eg_session cookie
2. If no token → guest (locals.user = null)
3. Decode JWT exp (without verification) via getTokenExpiry()
4. If fully expired (exp ≤ now) → clearAuthCookies() → guest
5. If near expiry (exp - now ≤ 5 min) → read eg_refresh → refreshTokens()
   - Success → setAuthCookies(new tokens) → verify → set locals.user
   - Failure → fall through (token still valid for up to 5 min)
6. Normal path → verifyIdToken(token) via jose JWKS → set locals.user
```

### Auth feature module

```
src/features/auth/
├── store.ts               # $auth atom + $authDialog atom + BroadcastChannel sync
│                          #   hydrateAuth() → fetch /api/auth/me → setAuthenticated()
│                          #   $auth.listen() → html.logged CSS class toggle
│                          #   BroadcastChannel('eg-auth-sync') for cross-tab sync
│
├── hosted-ui.ts           # openHostedUI(path) — popup/redirect logic
│                          #   Desktop: postMessage listener + cookie poll (1s) + 10-min timeout
│                          #   Mobile: eg_return cookie + full-page redirect
│                          #   COOP-resilient: no popup.closed cancellation
│
├── types.ts               # AuthState = { status, uid, email, username }
├── schemas.ts             # AuthMeResponseSchema (Zod)
│
├── server/
│   ├── cognito-config.ts  # Zod-validated Cognito env vars (getCognitoConfig())
│   ├── cookies.ts         # HttpOnly cookie helpers (build/read/clear/set)
│   ├── jwt.ts             # jose JWKS verification + getTokenExpiry()
│   ├── oidc.ts            # generateOidcState(), generatePkceChallenge(), validateReturnUrl()
│   ├── refresh.ts         # refreshTokens() via Cognito /oauth2/token
│   └── token-exchange.ts  # exchangeCodeForTokens(code, codeVerifier?)
│
├── components/
│   ├── AuthDialog.tsx     # Native <dialog> shell (showModal, animated close)
│   ├── LoginView.tsx      # Login panel (Google, Discord, Email buttons)
│   ├── SignupView.tsx     # Signup panel
│   ├── BrandLogo.tsx      # EG wordmark SVG
│   └── GoogleIcon.tsx     # Google "G" icon SVG
│
└── tests/                 # 69 tests total across 5 files
    ├── auth-server.test.mjs    # 39 tests (PKCE, cookies, refresh, return URL, JWT expiry)
    ├── auth-store.test.mjs     # Store state transitions
    ├── auth-hydrate.test.mjs   # hydrateAuth() fetch mock tests
    ├── auth-schemas.test.mjs   # Zod schema validation
    └── auth-dialog-store.test.mjs  # Dialog open/close, view switching
```

### Cognito Hosted UI customization

The file `cognitoUI/template.css` styles the Cognito Hosted UI pages to match the site's dark theme. Upload via AWS Console → Cognito → User Pool → App integration → Hosted UI customization.

**Color mapping:**
- Page background: `#1d2021` (nav-surface)
- Banner: `#161718` (nav-surface-dark)
- Input fields: `#111118` bg, `#3A3F41` border, `#394cc8` focus
- Submit button: `#394cc8` (site-color)
- Text: `#e5e7eb` / `#dddad5`
- Error: `#f87171`, Valid: `#4ade80`
- Links: `#00aeff` (brand-color)

CSS limit: 3KB (current file: ~1.9KB).

### Comments auth (deferred)

When comments are built, TSX HttpOnly cookies mean the client can't read tokens for Amplify/AppSync. Recommended approach:
- **Server-side GraphQL proxy** (`/api/comments/*`) reads HttpOnly cookie, verifies JWT, proxies to AppSync
- Guest reads use `AWS_IAM` via existing Identity Pool
- More secure than HBS's approach of exposing tokens to client JS

---

## 9. Replacing Redis / RAM Cache / Express

### Current system (EG-HBS)

```
Request → Express → RAM cache check → Redis check → S3 check → Render HTML → Cache in all 3
```

Three-tier cache (RAM → Redis → S3) exists because **Express renders HTML on every request**. Caching avoids re-rendering the same page repeatedly.

### New system (Astro)

```
Build → Static HTML → Upload to S3 → CloudFront caches → User gets HTML from CDN edge
```

**No Redis. No RAM cache. No Express rendering.** The HTML is built once during `astro build` and served directly from CloudFront. There's nothing to cache because the HTML already exists as static files.

| Current layer | What it did | Astro equivalent |
|---------------|-------------|------------------|
| RAM cache | Avoid re-rendering hot pages | Not needed — pages are static files |
| Redis cache | Persist rendered HTML across restarts | Not needed — HTML is on S3 |
| S3 cache | Backup for cold starts | S3 IS the primary storage now |
| Express render | Generate HTML per request | `astro build` generates all HTML once |

**For SSR endpoints** (auth, API): These are stateless Lambda functions. They don't need caching — they just read/write DynamoDB directly.

**For dynamic client-side data** (vault, prefs): React islands fetch from `/api/user/*` endpoints. Browser handles caching via standard HTTP headers.

### When product data changes

1. Update the JSON file in `src/content/data-products/`
2. Run `astro build` (~2 min for the full site)
3. Deploy to S3 + invalidate CloudFront cache
4. New HTML is live globally in ~60 seconds

This is the standard workflow for content sites. If you later need near-instant updates (e.g., live pricing), you can:
- Switch specific pages to SSR (`export const prerender = false`)
- Or use client-side fetch to load product data from an API

But start with static builds — it's simpler, faster, and cheaper.

---

## 10. Developer Workflow

### Creating a new review article

```bash
node scripts/new-content.mjs --type review --category mouse --brand "Razer" --model "Viper V3"
```

This script will:
1. Derive a slug from the content name
2. Create `src/content/reviews/mouse/razer-viper-v3-review/index.mdx` with frontmatter template (slug-folder layout)
3. Create `public/images/reviews/mouse/razer-viper-v3-review/` image folder
4. Print the file path and open it in your editor

**Generated MDX file:**
```mdx
---
category: mouse
brand: Razer
model: Viper V3
title: 'Razer Viper V3 Review'
subtitle: ''
description: ''
tags: []
datePublished: '2026-03-01'
author: EG Team
fullArticle: true
toc: false
draft: true
productId: razer-viper-v3
---

Write your review here. Use React components:

<ProductCards pins="home" start={1} end={5} />
```

### Creating a new product

Products are managed by the external CMS (Phase 13). The CMS outputs individual product JSON files (`src/content/data-products/{category}/{brand}/{slug}.json`) keyed by slug, with all specs, media, and brand references in the correct format. During development, edit the JSON files directly.

### Creating a new brand / game / guide / news

```bash
node scripts/new-content.mjs --type brand --name "Endgame Gear"
node scripts/new-content.mjs --type game --name "Marvel Rivals"
node scripts/new-content.mjs --type guide --category mouse --name "Best FPS Mice 2026"
node scripts/new-content.mjs --type news --category hardware --name "CES 2026 Highlights"
```

Each creates the `.mdx` file + matching image folder.

### Daily workflow

```
1. Create content     →  node scripts/new-content.mjs ...
2. Drop images        →  Copy images into public/images/{path}/
3. Write content      →  Edit the .mdx file in VS Code
4. Preview            →  astro dev  (localhost:4321, hot reload)
5. Build              →  astro build  (~2 min)
6. Deploy             →  Push to repo → CI/CD deploys to S3 + CloudFront
```

### Compared to current workflow

| Step | Current (EG-HBS) | New (EG-TSX) |
|------|-------------------|--------------|
| Create content | Right-click → md_new.py → creates .md + image folder | `node scripts/new-content.mjs` → creates .mdx + image folder |
| Add product | Edit JSON manually | CMS exports updated JSON (Phase 13) |
| Preview | `npm start` → Express renders on each refresh | `astro dev` → hot reload, instant updates |
| Build | `node scripts-jsons/convertMarkdownArticles.js` → RAM/Redis/S3 cache | `astro build` → static HTML to `dist/` |
| Deploy | Upload cache to S3, restart Express | Upload `dist/` to S3, invalidate CloudFront |
| Image serving | Express middleware → CloudFront redirect | Direct from `public/` (dev) or CloudFront (prod) |

---

## 11. Deployment Architecture

```
                        ┌─────────────────────────────┐
                        │       CloudFront CDN         │
                        │   (global edge caching)      │
                        └──────┬──────────┬───────────┘
                               │          │
                    Static     │          │  SSR
                    content    │          │  requests
                               ▼          ▼
                  ┌────────────────┐  ┌────────────────────┐
                  │   S3 Bucket    │  │   Lambda@Edge      │
                  │                │  │   (or Lambda +     │
                  │  dist/         │  │    API Gateway)     │
                  │  ├── index.html│  │                    │
                  │  ├── reviews/  │  │  Handles:          │
                  │  ├── guides/   │  │  /auth/callback    │
                  │  ├── images/   │  │  /api/user/*       │
                  │  └── ...       │  │  /login, /logout   │
                  └────────────────┘  └────────┬───────────┘
                                               │
                                               ▼
                                    ┌────────────────────┐
                                    │    DynamoDB         │
                                    │                    │
                                    │  eg_profiles       │
                                    │  eg_usernames      │
                                    │  eg_sessions       │
                                    └────────────────────┘
```

**Same infrastructure you already have.** The only change is:
- S3 stores static HTML files (instead of cached rendered HTML)
- Lambda handles SSR endpoints (instead of Express on EC2/ECS)
- No Redis instance to manage
- No Express server to keep running

---

## 12. Environment Variables

### Updated `.env.example`

```env
# ─── Site ─────────────────────────────────────────────────────
PUBLIC_SITE_URL=https://expertgaming.gg

# ─── AWS Cognito (public — safe to expose) ────────────────────
PUBLIC_COGNITO_REGION=us-east-2
PUBLIC_COGNITO_USER_POOL_ID=us-east-2_HIa5R29fk
PUBLIC_COGNITO_APP_CLIENT_ID=6e29cvrtq3kodvbglh0ks4kjbp
COGNITO_CLIENT_SECRET=                          # Only if confidential client
COGNITO_DOMAIN=us-east-2hia5r29fk.auth.us-east-2.amazoncognito.com
COGNITO_CALLBACK_URL=http://localhost:4321/auth/callback
COGNITO_LOGOUT_URL=http://localhost:4321

# ─── DynamoDB ─────────────────────────────────────────────────
DYNAMO_PROFILES_TABLE=eg_profiles
DYNAMO_USERNAMES_TABLE=eg_usernames

# ─── CDN / CloudFront ────────────────────────────────────────
CDN_BASE_URL=https://d3m2jw9ed15b7k.cloudfront.net

# ─── Affiliate tags (server-only) ────────────────────────────
AFFILIATE_AMAZON=expertgaming-20
AFFILIATE_BHPHOTO=
AFFILIATE_NEWEGG=

# ─── Analytics ────────────────────────────────────────────────
PUBLIC_GA_MEASUREMENT_ID=G-XXXXXXXXXX

# ─── Build ────────────────────────────────────────────────────
MIGRATION_MODE=false
```

**Auth cookies** (set by server, not env vars):

| Cookie | HttpOnly | Client-readable | Purpose |
|--------|----------|-----------------|---------|
| `eg_session` | Yes | No | JWT id_token (30-day TTL) |
| `eg_refresh` | Yes | No | Cognito refresh token (30-day TTL) |
| `eg_hint` | No | Yes | `1` when logged in (used by JS for UI state) |
| `eg_first` | No | Yes | `1` on first signup (triggers vault merge, 5-min TTL) |
| `eg_nonce` | Yes | No | OIDC CSRF state (5-min TTL, cleared after callback) |
| `eg_pkce` | Yes | No | PKCE code_verifier (5-min TTL, cleared after callback) |
| `eg_return` | No | Yes | Mobile return URL (5-min TTL, cleared after callback) |

---

## 13. Migration Phases

> **Build approach:** One component, one section, one page at a time. Phases 4–7 use numbered sub-phases for granular tracking. Components built in earlier phases are reused by later phases. Shared components are extracted into `src/shared/ui/` when a second page needs them.

### Phase 1: Data Foundation (DONE)
- [x] Content collections with Zod schemas
- [x] Migration script (`scripts/migrate-content.mjs`)
- [x] CUID2 crosswalk for idempotency (archived — slug is now primary key)
- [x] Product JSON registries (mouse, keyboard, monitor)
- [x] All content migrated: 47 reviews, 29 brands, 11 games, 33 guides, 23 news, 4 pages
- [x] Category subfolder structure preserved

### Phase 2: Project Scaffold (DONE)
- [x] Astro 5 + React 19 + Tailwind v4 + MDX + Sitemap
- [x] Content collections with Zod schemas
- [x] 4 themes via CSS variables
- [x] Path aliases, cn.ts, config.ts, slugs.ts
- [x] Images copied to `public/images/` (from EG-HBS/images/, never move)
- [ ] `scripts/new-content.mjs` — create new MDX + image folder (deferred)
- [ ] Convert migrated `.md` files to `.mdx` (as components are built)

### Phase 3: Content Migration (PARTIAL)
- [x] Migration script done, .md files migrated
- [ ] MDX conversion pending (as components are built in Phases 4–7)

### Phase 4: Global Shell & Home Page (sub-phases 4.1–4.15) — IN PROGRESS
- [x] 4.1 MainLayout shell (head, theme, popover host)
- [x] 4.2 GlobalNav desktop (logo, links, mega-menus)
- [ ] 4.3 NavMobile (hamburger drawer, React island)
- [ ] 4.4 GlobalFooter (4-column footer, copyright)
- [ ] 4.5 global.css updates (navbar/footer/home tokens)
- [ ] 4.6 Adbar (responsive text banner)
- [ ] 4.7 Hero section (H1/H2, stats buttons, count animation)
- [ ] 4.8 SlideShow carousel (product slides, arrows, rating bar)
- [ ] 4.9 Tools section (hub tool links)
- [ ] 4.10 Dashboard grid ("What's New" — 5 rows, news sidebar)
- [ ] 4.11 Game Gear Picks (game card scroller)
- [ ] 4.12 Featured Reviews (category tabs + card scroller)
- [ ] 4.13 Highlighted Guides (card scroller)
- [ ] 4.14 Latest News 4×4 (news card grid)
- [ ] 4.15 Home page QA (side-by-side at all breakpoints)

### Phase 5: Snapshot Page (sub-phases 5.1–5.10)
- [ ] 5.1 Snapshot layout (getStaticPaths, product data loading)
- [ ] 5.2 Product hero gallery (SmartSlider.tsx)
- [ ] 5.3 MetricsPanel orchestrator
- [ ] 5.4 Metric SVG components (7 types + scoring.ts)
- [ ] 5.5 Composite tooltips (distribution bar charts)
- [ ] 5.6 Spec table (SpecsGrid + SpecRow + text tooltips)
- [ ] 5.7 Recommended section (FeedScroller + TaggedCard + affiliates)
- [ ] 5.8 Similar section (reuses FeedScroller + TaggedCard)
- [ ] 5.9 Price widget (affiliate link resolver)
- [ ] 5.10 Snapshot page QA (side-by-side for 3+ products)

### Phase 6: Hub Page (sub-phases 6.1–6.11)
- [ ] 6.1 Hub layout (static shell, slim data embed)
- [ ] 6.2 HubApp island (top-level React island)
- [ ] 6.3 Nano Store (filters, sort, view, compare state)
- [ ] 6.4 URL sync (pushState ↔ store)
- [ ] 6.5 Filter engine (pure filter/sort functions)
- [ ] 6.6 FilterBar (brand toggles, sliders, search)
- [ ] 6.7 ProductCard + ProductGrid (4 view modes)
- [ ] 6.8 SortDropdown + ViewSwitcher
- [ ] 6.9 CompareMatrix (stats/shapes/radar)
- [ ] 6.10 Build-time pipelines (hub tags, recommender, distributions)
- [ ] 6.11 Hub page QA (all filter/sort/view combinations)

### Phase 7: Content Pages (sub-phases 7.1–7.9)
- [ ] 7.1 Review page (`/reviews/[category]/[slug]`)
- [ ] 7.2 Guide page (`/guides/[category]/[slug]`)
- [ ] 7.3 News page (`/news/[category]/[slug]`)
- [ ] 7.4 Brand page (`/brands/[slug]`)
- [ ] 7.5 Game page (`/games/[slug]`)
- [ ] 7.6 Index pages (listing + pagination)
- [ ] 7.7 Static pages (about, contact, privacy, terms)
- [ ] 7.8 404 page
- [ ] 7.9 Profile page shell (auth wired in Phase 9)

### Phase 8: Index Pages & Static Pages
- [ ] Covered by Phase 7 sub-phases 7.6–7.8

### Phase 9: Auth & Dynamic Features
- [x] `src/features/auth/server/` — cognito-config, cookies, jwt, oidc, token-exchange, refresh
- [x] SSR endpoints — login (email/Google/Discord), callback (smart popup+mobile), logout
- [x] SSR endpoint — /api/auth/me (Cache-Control: no-store)
- [ ] SSR endpoints — /api/user/prefs, username
- [x] SSR endpoint — /api/user/vault (GET with conditional 304 + PUT)
- [x] AuthDialog + LoginView + SignupView (native `<dialog>`, auto-close on auth)
- [x] $auth + $authDialog Nano Stores + BroadcastChannel cross-tab sync
- [x] hosted-ui.ts — postMessage popup flow + mobile return URL + COOP resilience
- [x] PKCE (RFC 7636) on all login endpoints
- [x] Middleware auto-refresh (5-min threshold, jose JWKS verification)
- [x] Cognito Hosted UI dark theme CSS (`cognitoUI/template.css`)
- [x] 69 auth tests (5 test files)
- [x] Guest-to-user vault merge (sync.ts: first-login detection via eg_first cookie + mergeVaults)
- [x] Vault store + sync layer (persona-scoped localStorage, DynamoDB sync, cross-tab BroadcastChannel)
- [x] Vault components (VaultToggleButton, VaultCount, VaultDropdown)
- [x] Vault API endpoints (GET/PUT /api/user/vault with conditional 304)
- [ ] Comments system (thread, form, auth gate)
- [ ] PC Builder store + components
- [ ] ProfilePage + UsernameEditor (wire auth into 7.9 shell)

### Phase 10: SEO & Performance
- [ ] Meta tag builders, JSON-LD structured data
- [ ] Sitemap, robots.txt, Open Graph
- [ ] Image optimization (responsive `srcset` via size tokens from media schema)

### Phase 11: Side-by-Side QA
- [ ] Full E2E testing
- [ ] Lighthouse audits
- [ ] Every page type verified against HBS

### Phase 12: Infrastructure & Launch
- [ ] Deploy pipeline (CI/CD → S3 + CloudFront)
- [ ] DNS cutover
- [ ] `scripts/build-sizes.mjs` — Sharp auto-generates size ladder from single source images (replaces manual Photoshop multi-export)

### Phase 13: CMS Configuration (Final)
- [ ] Define CMS output format for product JSON registries (match `src/content/data-products/` schema)
- [ ] Define CMS output format for brand data (slug-keyed, descriptions, logos)
- [ ] Map CMS fields to Zod schemas (content.config.ts validation)
- [ ] Determine which content types the CMS manages vs manual MDX creation
- [ ] Build CMS → site rebuild pipeline (CMS publish → trigger `astro build` → deploy)
- [ ] Validate CMS output against existing product JSON (zero regression)
- [ ] Document CMS workflow for day-to-day content operations

---

## Key Decisions Summary

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Rendering | Hybrid (SSG default + SSR opt-in) | Content is static; auth/API needs a server |
| Auth | Keep Cognito + DynamoDB, move routes to Astro SSR | Zero migration of auth infrastructure |
| Images | `public/images/`, served by Astro dev + CloudFront prod | Industry standard, no custom middleware |
| Caching | None needed (static HTML on CDN) | Replaces Redis + RAM + S3 cache with simpler static files |
| State | Nano Stores for cross-island state | Lightweight, framework-agnostic, perfect for Astro islands |
| Content format | MDX (after component phase) | Embed React components directly in articles |
| Product data | CMS → JSON registries → static build (Phase 13) | CMS outputs format matching Zod schemas; during dev, edit JSON directly |
| Deploy | S3 + CloudFront + Lambda | Same infra you have, minus Express/Redis |
| Categories | Stable enum (no CUID2 IDs) | 6 items, rarely change, not worth the indirection |
