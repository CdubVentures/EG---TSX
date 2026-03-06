# EG-TSX Architecture Plan

> **Status:** Draft â€” awaiting founder approval before implementation
> **Last updated:** 2026-03-04
> **Stack:** Astro 5 Â· React 19 Â· Tailwind v4 Â· MDX Â· TypeScript
> **Migrating from:** EG-HBS (Express Â· Handlebars Â· jQuery Â· Redis)

---

## 1. Rendering Strategy: Astro Hybrid Mode

Astro hybrid mode gives us **two rendering modes in one project**:

| Render mode | What uses it | Why |
|-------------|-------------|-----|
| **Static (SSG)** | Reviews, guides, news, brands, games, pages, **hub pages** | Content doesn't change per-user. Built once â†’ cached forever on CDN. Instant load. |
| **Server (SSR)** | Auth callbacks, user API routes | Needs to read cookies, talk to DynamoDB, validate tokens on every request. |

**Hub pages** (`/hubs/mouse?brand=razer&weight=50-80`) are **static shells** with a React island that reads URL query params and filters/sorts client-side. No server involved â€” all filtering happens in the browser. This is the modern industry standard (Amazon, Newegg, PCPartPicker all work this way). URLs with query params remain fully bookmarkable and shareable.

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
â”œâ”€â”€ public/
â”‚   â””â”€â”€ images/                         # â† ALL product + article images live here
â”‚       â”œâ”€â”€ mouse/{brand}/{model}/      #   Served at /images/mouse/razer/viper/...
â”‚       â”œâ”€â”€ keyboard/{brand}/{model}/
â”‚       â”œâ”€â”€ monitor/{brand}/{model}/
â”‚       â”œâ”€â”€ brands/{slug}/
â”‚       â”œâ”€â”€ reviews/{category}/{slug}/
â”‚       â”œâ”€â”€ news/{category}/{slug}/
â”‚       â”œâ”€â”€ guides/{category}/{slug}/
â”‚       â””â”€â”€ navbar/                     # Category + nav SVG icons (mask-image)
â”‚           â”œâ”€â”€ mouse.svg              #   10 category icons + house.svg
â”‚           â”œâ”€â”€ keyboard.svg
â”‚           â””â”€â”€ ...
â”‚
â”œâ”€â”€ scripts/
â”‚   â”œâ”€â”€ migrate-content.mjs             # Phase 1 migration (done)
â”‚   â”œâ”€â”€ migrate-to-slug-folders.mjs     # Flat â†’ slug-folder migration (done, idempotent)
â”‚   â”œâ”€â”€ validate-image-links.mjs        # Content â†’ image folder validator
â”‚   â”œâ”€â”€ sync-rename.mjs                 # Atomic content + image folder rename
â”‚   â”œâ”€â”€ new-content.mjs                 # Create new MDX + image folder
â”‚   â””â”€â”€ archive/
â”‚       â””â”€â”€ .id-crosswalk.json          # Historical CUID2 crosswalk (migration artifact)
â”‚
â”œâ”€â”€ src/
â”‚   â”œâ”€â”€ content.config.ts               # Zod schemas for all content collections
â”‚   â”‚
â”‚   â”œâ”€â”€ content/                        # MDX content collections (Astro Content Layer)
â”‚   â”‚   â”œâ”€â”€ reviews/{category}/{slug}/index.mdx     # Slug-folder layout
â”‚   â”‚   â”œâ”€â”€ brands/{slug}/index.mdx
â”‚   â”‚   â”œâ”€â”€ games/{slug}/index.mdx
â”‚   â”‚   â”œâ”€â”€ guides/{category}/{slug}/index.mdx
â”‚   â”‚   â”œâ”€â”€ news/{category}/{slug}/index.mdx
â”‚   â”‚   â””â”€â”€ pages/{slug}/index.mdx
â”‚   â”‚
â”‚   â”œâ”€â”€ data/                           # Structured data (JSON registries)
â”‚   â”‚   â”œâ”€â”€ products/
â”‚   â”‚   â”‚   â”œâ”€â”€ mouse.json              # 342 products, keyed by slug + all specs
â”‚   â”‚   â”‚   â”œâ”€â”€ keyboard.json
â”‚   â”‚   â”‚   â””â”€â”€ monitor.json
â”‚   â”‚   â”œâ”€â”€ tooltips/
â”‚   â”‚   â”‚   â”œâ”€â”€ mouse.ts                # Mouse tooltip content (~100 keys)
â”‚   â”‚   â”‚   â”œâ”€â”€ keyboard.ts             # Keyboard tooltip content (~50 keys)
â”‚   â”‚   â”‚   â””â”€â”€ index.ts                # Unified lookup: getTooltip(category, key)
â”‚   â”‚   â”œâ”€â”€ metrics/
â”‚   â”‚   â”‚   â”œâ”€â”€ mouse.json              # xxlMetrics config: which SVG type per metric, sections, suffixes
â”‚   â”‚   â”‚   â”œâ”€â”€ distributions/
â”‚   â”‚   â”‚   â”‚   â””â”€â”€ mouse.json          # Build-time computed: bin edges, counts, min/max per metric key
â”‚   â”‚   â”‚   â”œâ”€â”€ scoring.ts              # scoreFromMinMax(), scoring pipeline (pure functions)
â”‚   â”‚   â”‚   â””â”€â”€ index.ts                # getMetricConfig(category), getDistribution(category, key)
â”‚   â”‚   â”œâ”€â”€ recommender/
â”‚   â”‚   â”‚   â”œâ”€â”€ mouse.json              # Build-time computed: similar[] + recommended[] per product
â”‚   â”‚   â”‚   â”œâ”€â”€ similarity.ts           # Similar scoring: spec-driven, within-category (pure functions)
â”‚   â”‚   â”‚   â”œâ”€â”€ affinity.ts             # Recommended scoring: cross-category affinity (pure functions)
â”‚   â”‚   â”‚   â””â”€â”€ index.ts                # getSimilar(category, id), getRecommended(category, id)
â”‚   â”‚   â”œâ”€â”€ hub-tags/
â”‚   â”‚   â”‚   â”œâ”€â”€ mouse.ts                # Per-category filter config (sliderItems, toggleItems, filterOrder)
â”‚   â”‚   â”‚   â”œâ”€â”€ tag-scorer.ts           # hubTag selection: weighted scoring + deterministic "random" pick
â”‚   â”‚   â”‚   â””â”€â”€ index.ts                # getHubTags(category, product), tagValueWithLink(product, key, category)
â”‚   â”‚   â”œâ”€â”€ affiliates/
â”‚   â”‚   â”‚   â”œâ”€â”€ retailers.yaml          # 5 retailers with search URL templates (Amazon primary)
â”‚   â”‚   â”‚   â””â”€â”€ resolver.ts             # dealLink(): primary affiliate â†’ retailer search â†’ Amazon fallback
â”‚   â”‚   â””â”€â”€ schemas/                    # Zod schemas for product data validation
â”‚   â”‚
â”‚   â”œâ”€â”€ core/                           # App-wide infrastructure (no UI)
â”‚   â”‚   â”œâ”€â”€ config.ts                   # Centralized knobs (pagination, timeouts, CDN)
â”‚   â”‚   â”œâ”€â”€ images.ts                   # Image URL resolver (contentImage) â€” ONLY place paths are built
â”‚   â”‚   â”œâ”€â”€ media.ts                    # Product media helpers (getImage, getCarouselImages, etc.)
â”‚   â”‚   â”œâ”€â”€ hub-tools.ts                # Hub tools gateway â€” getDesktopTools(), getMobileTools()
â”‚   â”‚   â”œâ”€â”€ hub-tools-filter.mjs        # Pure filter/sort logic for hub tools (testable)
â”‚   â”‚   â”œâ”€â”€ hub-tools-filter.d.mts      # TypeScript declarations for hub-tools-filter
â”‚   â”‚   â”œâ”€â”€ auth/
â”‚   â”‚   â”‚   â”œâ”€â”€ cognito.ts              # OIDC client setup, token validation
â”‚   â”‚   â”‚   â”œâ”€â”€ session.ts              # DynamoDB session read/write
â”‚   â”‚   â”‚   â””â”€â”€ guard.ts               # Auth guard helper for SSR endpoints
â”‚   â”‚   â”œâ”€â”€ routing/
â”‚   â”‚   â”‚   â””â”€â”€ slugs.ts               # Slug derivation helpers
â”‚   â”‚   â””â”€â”€ seo/
â”‚   â”‚       â”œâ”€â”€ meta.ts                # Meta tag builders
â”‚   â”‚       â””â”€â”€ structured-data.ts     # JSON-LD schema generators
â”‚   â”‚
â”‚   â”œâ”€â”€ shared/                         # Reusable primitives (no business logic)
â”‚   â”‚   â”œâ”€â”€ ui/
â”‚   â”‚   â”‚   â”œâ”€â”€ Button.tsx
â”‚   â”‚   â”‚   â”œâ”€â”€ ModalShell.tsx          # Background blur + close button (Popover API)
â”‚   â”‚   â”‚   â”œâ”€â”€ TooltipTrigger.astro     # Native Popover API trigger (? icon)
â”‚   â”‚   â”‚   â”œâ”€â”€ ScoreRing.astro          # Overall score ring (0-10, used outside hub)
â”‚   â”‚   â”‚   â”œâ”€â”€ MetricRating.astro      # Rating circle SVG (filled ring, 0-10 score)
â”‚   â”‚   â”‚   â”œâ”€â”€ MetricGauge.astro       # Gauge SVG with needle (polling rate, DPI, etc.)
â”‚   â”‚   â”‚   â”œâ”€â”€ MetricSpeedometer.astro # 10-segment shell SVG with needle (latency, force)
â”‚   â”‚   â”‚   â”œâ”€â”€ MetricPerformance.astro # Arc/progress SVG (70% arc)
â”‚   â”‚   â”‚   â”œâ”€â”€ MetricWeight.astro      # Reverse-fill ring with feather icon (lighter=better)
â”‚   â”‚   â”‚   â”œâ”€â”€ MetricSensor.astro      # Concentric circles with crosshair (sensor recency)
â”‚   â”‚   â”‚   â”œâ”€â”€ MetricFeet.astro        # Ring with mouse-foot art (skate score)
â”‚   â”‚   â”‚   â”œâ”€â”€ DistributionChart.astro # Bar chart showing product distribution per metric
â”‚   â”‚   â”‚   â”œâ”€â”€ TaggedCard.astro        # Product feed card (image, brand/model, deal link, hub tags, compare)
â”‚   â”‚   â”‚   â”œâ”€â”€ FeedScroller.astro     # Horizontal scroller with left/right arrows (recommended, similar)
â”‚   â”‚   â”‚   â”œâ”€â”€ SmartSlider.tsx         # Image gallery/carousel
â”‚   â”‚   â”‚   â””â”€â”€ TagBadge.tsx
â”‚   â”‚   â”œâ”€â”€ layouts/
â”‚   â”‚   â”‚   â”œâ”€â”€ MainLayout.astro        # Shell: head, nav, footer, auth popups + color derivation engine (21 site + 150 category CSS vars)
â”‚   â”‚   â”‚   â”œâ”€â”€ ArticleLayout.astro     # Review/guide/news article wrapper
â”‚   â”‚   â”‚   â””â”€â”€ HubLayout.astro         # Product hub/grid wrapper
â”‚   â”‚   â””â”€â”€ lib/
â”‚   â”‚       â””â”€â”€ cn.ts                   # CVA + clsx + tailwind-merge utility
â”‚   â”‚
â”‚   â”œâ”€â”€ features/                       # Domain features (business logic + UI)
â”‚   â”‚   â”œâ”€â”€ auth/
â”‚   â”‚   â”‚   â”œâ”€â”€ store.ts               # Nano Store: $auth + $authDialog + BroadcastChannel sync
â”‚   â”‚   â”‚   â”œâ”€â”€ hosted-ui.ts           # Popup/redirect logic (postMessage + cookie poll)
â”‚   â”‚   â”‚   â”œâ”€â”€ types.ts               # AuthState, GUEST, LOADING type definitions
â”‚   â”‚   â”‚   â”œâ”€â”€ schemas.ts             # Zod schemas for /api/auth/me response
â”‚   â”‚   â”‚   â”œâ”€â”€ server/
â”‚   â”‚   â”‚   â”‚   â”œâ”€â”€ cognito-config.ts  # Zod-validated Cognito config from env
â”‚   â”‚   â”‚   â”‚   â”œâ”€â”€ cookies.ts         # HttpOnly cookie helpers (session, refresh, hint, PKCE)
â”‚   â”‚   â”‚   â”‚   â”œâ”€â”€ jwt.ts             # JWT verification via jose JWKS + expiry helper
â”‚   â”‚   â”‚   â”‚   â”œâ”€â”€ oidc.ts            # OIDC state generation, PKCE challenge, return URL validation
â”‚   â”‚   â”‚   â”‚   â”œâ”€â”€ refresh.ts         # Token refresh via Cognito /oauth2/token
â”‚   â”‚   â”‚   â”‚   â””â”€â”€ token-exchange.ts  # Authorization code â†’ token exchange (with PKCE)
â”‚   â”‚   â”‚   â”œâ”€â”€ components/
â”‚   â”‚   â”‚   â”‚   â”œâ”€â”€ AuthDialog.tsx     # <dialog> shell (showModal, auto-close on auth)
â”‚   â”‚   â”‚   â”‚   â”œâ”€â”€ LoginView.tsx      # Login panel (Google, Discord, Email buttons)
â”‚   â”‚   â”‚   â”‚   â”œâ”€â”€ SignupView.tsx     # Signup panel
â”‚   â”‚   â”‚   â”‚   â”œâ”€â”€ BrandLogo.tsx      # EG wordmark for auth dialog
â”‚   â”‚   â”‚   â”‚   â””â”€â”€ GoogleIcon.tsx     # Google "G" SVG icon
â”‚   â”‚   â”‚   â””â”€â”€ tests/
â”‚   â”‚   â”‚       â”œâ”€â”€ auth-server.test.mjs    # 39 tests (PKCE, cookies, refresh, return URL, JWT)
â”‚   â”‚   â”‚       â”œâ”€â”€ auth-store.test.mjs     # Store state management tests
â”‚   â”‚   â”‚       â”œâ”€â”€ auth-hydrate.test.mjs   # hydrateAuth() fetch tests
â”‚   â”‚   â”‚       â”œâ”€â”€ auth-schemas.test.mjs   # Zod schema validation tests
â”‚   â”‚   â”‚       â””â”€â”€ auth-dialog-store.test.mjs # Dialog open/close + view switching
â”‚   â”‚   â”‚
â”‚   â”‚   â”œâ”€â”€ hub/
â”‚   â”‚   â”‚   â”œâ”€â”€ image-resolver.ts       # Stem â†’ full CDN URL with size suffix
â”‚   â”‚   â”‚   â”œâ”€â”€ store.ts               # Nano Store: filters, sort, view, compare state
â”‚   â”‚   â”‚   â”œâ”€â”€ url-sync.ts            # Read/write query params â†” store (pushState)
â”‚   â”‚   â”‚   â”œâ”€â”€ filter-engine.ts       # Pure functions: apply filters, compute counts
â”‚   â”‚   â”‚   â””â”€â”€ components/
â”‚   â”‚   â”‚       â”œâ”€â”€ HubApp.tsx          # Top-level island: reads URL â†’ store â†’ renders
â”‚   â”‚   â”‚       â”œâ”€â”€ ProductCard.tsx
â”‚   â”‚   â”‚       â”œâ”€â”€ ProductGrid.tsx     # Grid/list views (small, medium, large, list)
â”‚   â”‚   â”‚       â”œâ”€â”€ FilterBar.tsx       # Brand toggles, slider ranges, search
â”‚   â”‚   â”‚       â”œâ”€â”€ SortDropdown.tsx
â”‚   â”‚   â”‚       â”œâ”€â”€ ViewSwitcher.tsx    # Small/medium/large/list toggle
â”‚   â”‚   â”‚       â”œâ”€â”€ CompareMatrix.tsx   # Stats/shapes/radar comparison
â”‚   â”‚   â”‚       â””â”€â”€ SpecsGrid.tsx
â”‚   â”‚   â”‚
â”‚   â”‚   â”œâ”€â”€ vault/
â”‚   â”‚   â”‚   â”œâ”€â”€ store.ts               # Nano Store: persona-scoped localStorage + atom
â”‚   â”‚   â”‚   â”œâ”€â”€ sync.ts                # Sync engine: auth â†” vault â†” DynamoDB â†” cross-tab
â”‚   â”‚   â”‚   â”œâ”€â”€ merge.ts               # Pure merge: guest + server â†’ unified vault
â”‚   â”‚   â”‚   â”œâ”€â”€ types.ts               # VaultProduct, VaultEntry, AddResult, sync types
â”‚   â”‚   â”‚   â”œâ”€â”€ index.ts               # Public API barrel
â”‚   â”‚   â”‚   â”œâ”€â”€ server/
â”‚   â”‚   â”‚   â”‚   â”œâ”€â”€ db.ts              # DynamoDB: readVault, writeVault, readVaultRev
â”‚   â”‚   â”‚   â”‚   â””â”€â”€ schema.ts          # Zod schemas for API validation
â”‚   â”‚   â”‚   â”œâ”€â”€ components/
â”‚   â”‚   â”‚   â”‚   â”œâ”€â”€ VaultToggleButton.tsx  # Save/unsave product (appears on cards)
â”‚   â”‚   â”‚   â”‚   â”œâ”€â”€ VaultCount.tsx         # Badge count in navbar
â”‚   â”‚   â”‚   â”‚   â””â”€â”€ VaultDropdown.tsx      # Mega-menu vault preview
â”‚   â”‚   â”‚   â””â”€â”€ tests/
â”‚   â”‚   â”‚       â”œâ”€â”€ vault-store.test.mjs
â”‚   â”‚   â”‚       â”œâ”€â”€ vault-sync.test.mjs
â”‚   â”‚   â”‚       â””â”€â”€ vault-schema.test.mjs
â”‚   â”‚   â”‚
â”‚   â”‚   â”œâ”€â”€ pc-builder/
â”‚   â”‚   â”‚   â”œâ”€â”€ store.ts               # Nano Store: current build
â”‚   â”‚   â”‚   â””â”€â”€ components/
â”‚   â”‚   â”‚       â”œâ”€â”€ PartSlot.tsx
â”‚   â”‚   â”‚       â”œâ”€â”€ WattageMeter.tsx
â”‚   â”‚   â”‚       â””â”€â”€ AddToBuildBtn.tsx
â”‚   â”‚   â”‚
â”‚   â”‚   â”œâ”€â”€ ads/
â”‚   â”‚   â”‚   â”œâ”€â”€ config.ts              # AD_REGISTRY (22 HBS placements), ADSENSE_CLIENT, Zod schemas
â”‚   â”‚   â”‚   â”œâ”€â”€ resolve.ts             # resolveAd(campaign), isAdsEnabled(), parseSize()
â”‚   â”‚   â”‚   â”œâ”€â”€ index.ts               # Public barrel export
â”‚   â”‚   â”‚   â”œâ”€â”€ components/
â”‚   â”‚   â”‚   â”‚   â””â”€â”€ AdSlot.astro       # Universal ad slot (placeholder or live, zero JS)
â”‚   â”‚   â”‚   â””â”€â”€ tests/
â”‚   â”‚   â”‚       â””â”€â”€ placements.test.mjs  # 23 contract tests (schema, lookup, HBS parity)
â”‚   â”‚   â”‚
â”‚   â”‚   â”œâ”€â”€ comments/
â”‚   â”‚   â”‚   â”œâ”€â”€ services/
â”‚   â”‚   â”‚   â”‚   â””â”€â”€ api.ts             # Fetch comments from API
â”‚   â”‚   â”‚   â””â”€â”€ components/
â”‚   â”‚   â”‚       â”œâ”€â”€ CommentThread.tsx
â”‚   â”‚   â”‚       â””â”€â”€ CommentForm.tsx
â”‚   â”‚   â”‚
â”‚   â”‚   â””â”€â”€ profile/
â”‚   â”‚       â””â”€â”€ components/
â”‚   â”‚           â”œâ”€â”€ ProfilePage.tsx     # Account settings island
â”‚   â”‚           â””â”€â”€ UsernameEditor.tsx  # Username set/change with validation
â”‚   â”‚
â”‚   â”œâ”€â”€ pages/                          # File-based routing
â”‚   â”‚   â”œâ”€â”€ index.astro                 # Home page (static)
â”‚   â”‚   â”‚
â”‚   â”‚   â”œâ”€â”€ reviews/
â”‚   â”‚   â”‚   â”œâ”€â”€ index.astro             # All reviews hub (static)
â”‚   â”‚   â”‚   â””â”€â”€ [...slug].astro         # Dynamic review pages (static, getStaticPaths)
â”‚   â”‚   â”‚
â”‚   â”‚   â”œâ”€â”€ brands/
â”‚   â”‚   â”‚   â””â”€â”€ [...slug].astro
â”‚   â”‚   â”œâ”€â”€ games/
â”‚   â”‚   â”‚   â””â”€â”€ [...slug].astro
â”‚   â”‚   â”œâ”€â”€ guides/
â”‚   â”‚   â”‚   â””â”€â”€ [...slug].astro
â”‚   â”‚   â”œâ”€â”€ news/
â”‚   â”‚   â”‚   â””â”€â”€ [...slug].astro
â”‚   â”‚   â”‚
â”‚   â”‚   â”œâ”€â”€ hubs/
â”‚   â”‚   â”‚   â”œâ”€â”€ index.astro             # Hub index (tools: hub, database, versus, radar, shapes)
â”‚   â”‚   â”‚   â””â”€â”€ [category].astro        # Static shell â†’ <HubApp client:load /> reads URL query params
â”‚   â”‚   â”‚
â”‚   â”‚   â”œâ”€â”€ account.astro               # Profile page (static shell + React island)
â”‚   â”‚   â”‚
â”‚   â”‚   â”œâ”€â”€ login/
â”‚   â”‚   â”‚   â”œâ”€â”€ index.ts              # SSR: email/password (identity_provider=COGNITO, PKCE)
â”‚   â”‚   â”‚   â”œâ”€â”€ google.ts             # SSR: Google OAuth (identity_provider=Google, PKCE)
â”‚   â”‚   â”‚   â””â”€â”€ discord.ts            # SSR: Discord OAuth (identity_provider=Discord, PKCE)
â”‚   â”‚   â”œâ”€â”€ logout.ts                  # SSR: clear cookies, Cognito sign-out
â”‚   â”‚   â”‚
â”‚   â”‚   â”œâ”€â”€ auth/
â”‚   â”‚   â”‚   â””â”€â”€ callback.ts           # SSR: smart callback (popup postMessage OR mobile 302)
â”‚   â”‚   â”‚
â”‚   â”‚   â””â”€â”€ api/                        # SSR API endpoints
â”‚   â”‚       â”œâ”€â”€ auth/
â”‚   â”‚       â”‚   â””â”€â”€ me.ts              # GET: { loggedIn, user }
â”‚   â”‚       â”œâ”€â”€ user/
â”‚   â”‚       â”‚   â”œâ”€â”€ prefs.ts           # GET/PUT user preferences
â”‚   â”‚       â”‚   â”œâ”€â”€ vault.ts           # GET/PUT saved products
â”‚   â”‚       â”‚   â””â”€â”€ username.ts        # GET/PUT/check username
â”‚   â”‚       â””â”€â”€ search.ts              # GET: search products + content
â”‚   â”‚
â”‚   â””â”€â”€ styles/
â”‚       â””â”€â”€ global.css                  # CSS variables (11px base, 146 fluid typography, themes) + Tailwind v4 @theme
â”‚
â”œâ”€â”€ config/
â”‚   â”œâ”€â”€ data/
â”‚   â”‚   â”œâ”€â”€ categories.json               # SSOT: site colors, category IDs/labels/colors/flags
â”‚   â”‚   â”œâ”€â”€ hub-tools.json                # Hub tool definitions per category (5 tools Ã— N categories)
â”‚   â”‚   â”œâ”€â”€ slideshow.json                # Home page carousel product order
â”‚   â”‚   â””â”€â”€ dashboard.json                # Dashboard card configuration
â”‚   â”œâ”€â”€ category-manager.py               # GUI: edit site theme, category colors, toggle flags
â”‚   â”œâ”€â”€ hub-tools-manager.pyw             # GUI: edit hub sidebar tools per category
â”‚   â””â”€â”€ navbar-manager.py                 # GUI: edit navbar mega-menu structure and links
â”‚
â”œâ”€â”€ cognitoUI/
â”‚   â””â”€â”€ template.css                    # Cognito Hosted UI dark theme CSS (upload to AWS Console)
â”‚
â”œâ”€â”€ astro.config.mjs
â”œâ”€â”€ tsconfig.json
â”œâ”€â”€ package.json
â”œâ”€â”€ .env.example
â”œâ”€â”€ ARCHITECTURE.md
â””â”€â”€ AGENTS.md
```

---

## 2b. Config Tooling (`config/`)

The `config/` directory contains JSON data files and Python GUIs for managing site-wide settings without touching source code.

### `config/data/categories.json` â€” Single Source of Truth

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
- `src/shared/layouts/MainLayout.astro` â€” derives 21 `--site-*` + 150 `--cat-*` CSS variables at build time
- `src/core/config.ts` â€” exports `CONFIG.categories` (product-active IDs), `CONFIG.contentCategories` (content-active IDs), `plural()`, `categoryColor()`
- `src/content.config.ts` â€” build-time drift check ensures Zod enums match JSON
- `config/navbar-manager.py` â€” reads category colors for navbar color coding

**Flags:** Each category has `product` and `content` sub-objects with `production` and `vite` booleans. A category is active when `production === true` OR `(DEV && vite === true)`. This allows staging new categories in dev before enabling in production.

### `config/category-manager.py`

Tkinter GUI (Catppuccin Mocha dark theme) for managing:
- **Site theme** â€” primary + secondary colors with live gradient preview, derived swatches
- **Category cards** â€” color picker, label/plural editing, product/content toggles, article counts, icon status
- **Auto-discovery** â€” scans content frontmatter for categories not yet in JSON
- **Icon audit** â€” red "MISSING ICON" flag for categories without `public/images/navbar/{id}.svg`

Run: `python config/category-manager.py`

### `config/navbar-manager.py`

Tkinter GUI for managing navbar mega-menu structure (guide sections, brand lists, hub links). Reads category colors from `categories.json` for consistent color coding.

Run: `python config/navbar-manager.py`

### `config/hub-tools-manager.pyw`

Tkinter GUI for managing hub sidebar tool entries per product category. Reads/writes `config/data/hub-tools.json`. Two tabs: Home (per-category tool cards with SVG editor) and Index (drag-and-drop `/hubs/` dashboard slot assignments).

Uses flag-based category detection (product gateway pattern) â€” `is_product_active()` checks `categories.json` flags, not filesystem.

Run: `python config/hub-tools-manager.pyw`

Full documentation: `docs/config-tools/HUB-TOOLS-MANAGER.md`

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
  â†’ http://localhost:4321/images/mouse/razer/viper/img_xl.webp     (dev)
  â†’ https://expertgaming.gg/images/mouse/razer/viper/img_xl.webp  (prod via CDN)
```

No middleware needed. Astro dev server serves `public/` automatically. In prod, the deploy adapter uploads `public/` to S3 â†’ CloudFront serves it.

**Why this is better:**
- No custom Express middleware
- No `USE_LOCAL_IMAGES` env var
- Same path works in dev and prod
- Industry standard for every modern framework (Next.js, Remix, Astro, Vite)

### Image folder structure
```
public/images/
â”œâ”€â”€ mouse/
â”‚   â””â”€â”€ {brand}/
â”‚       â””â”€â”€ {slug}/                     # matches product.imagePath
â”‚           â”œâ”€â”€ top_blur.webp           # Blurred placeholder (LQIP)
â”‚           â”œâ”€â”€ top_s.webp              # Small (320px)
â”‚           â”œâ”€â”€ top_m.webp              # Medium (640px)
â”‚           â”œâ”€â”€ top_l.webp              # Large (960px)
â”‚           â”œâ”€â”€ top_xl.webp             # Extra large (1280px)
â”‚           â”œâ”€â”€ top---white+black_m.webp  # Color variant (--- separator)
â”‚           â”œâ”€â”€ feature-image_xxl.webp  # Hero/feature image
â”‚           â”œâ”€â”€ shape-side.svg          # SVG shape diagram
â”‚           â””â”€â”€ originals/              # Source files (not served)
â”‚
â”œâ”€â”€ keyboard/{brand}/{slug}/...
â”œâ”€â”€ monitor/{brand}/{slug}/...
â”‚
â”œâ”€â”€ reviews/{category}/{slug}/          # Article hero images
â”œâ”€â”€ guides/{category}/{slug}/
â”œâ”€â”€ news/{category}/{slug}/
â”œâ”€â”€ brands/{slug}/                      # Brand logos and marketing
â””â”€â”€ games/{slug}/                       # Game artwork
```

**Stem naming convention:**
- `{view}` â€” base view (`top`, `left`, `feature-image`, `bot`, `angle`, etc.)
- `{view}---{color}` â€” color variant (`---` separator, e.g., `top---white+black`)
- `{view}___{edition}` â€” edition variant (`___` separator)
- `{view}___{edition}---{color}` â€” edition + color combined
- `{view}{seq}` â€” sequential images (`img1`, `img2`, etc.)
- Size suffix always last: `_{size}.webp` (blur, t, xs, s, m, l, xl, xxl, zoom)

### Image resolver contract

> **Full documentation:** `docs/DATA-IMAGE-CONTRACT.md` (dual source of truth â€” data AND images)
> **Diagrams:** `docs/diagrams/dual-source-of-truth.md` | `docs/diagrams/product-identity-flow.md` | `docs/diagrams/article-identity-flow.md`

**Components NEVER build image paths from brand + model strings.** Every product carries a pre-built `imagePath` field and a structured `media` object. A centralized resolver constructs the full URL:

```typescript
// src/core/images.ts â€” the ONLY place image URLs are constructed
export function contentImage(basePath: string, stem: string, size: ImageSize, ext = 'webp'): string {
  return `${CONFIG.cdn.baseUrl}${basePath}/${stem}_${size}.${ext}`;
}

// src/core/media.ts â€” helpers for querying the structured media object
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

### Creating new content â†’ image folders
The `scripts/new-content.mjs` script will:
1. Derive a slug from the content name (e.g., "Razer Viper V3" â†’ `razer-viper-v3`)
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
    â†“  validated by
Zod schema (src/content.config.ts)
    â†“  queried via
getCollection('reviews')  /  getEntry('reviews', slug)
    â†“  rendered by
Astro page ([...slug].astro)
    â†“  built into
Static HTML (dist/)
    â†“  deployed to
S3 + CloudFront
```

**No Redis. No RAM cache. No Express.** The content is compiled into HTML at build time. CloudFront caches and serves it globally.

### Migration path: `.md` â†’ `.mdx`

| Phase | Format | Why |
|-------|--------|-----|
| Now (Phase 1 done) | `.md` | Source files have HBS helpers (`{{{pcards_row ...}}}`) that aren't valid MDX |
| Phase 4 (components) | `.mdx` | Replace HBS helpers with React components (`<ProductCards pins="home" />`) |

The migration script currently outputs `.md` because the body content has raw Handlebars syntax. When we build the React components that replace those helpers, we'll convert each file to `.mdx` and swap the syntax:

```mdx
{/* Before (Handlebars â€” invalid MDX) */}
{{{pcards_row pins="home" display_start=1 display_end=5}}}

{/* After (MDX â€” valid React component) */}
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

// Get image URL via media helpers + resolver â€” NEVER build path from brand + model
import { contentImage } from '@core/images';
import { getImage } from '@core/media';
const heroImg = getImage(product.data.media, 'feature-image');
const heroSrc = heroImg ? contentImage(product.data.imagePath, heroImg.stem, 'xxl') : null;
```

**Dual Source of Truth:** Each product JSON object is the single source of truth for both **data** (specs, scores, display names) and **images** (pre-built `imagePath` field + image stem fields). Components receive one product object and get everything they need â€” `product.brand` for display, `product.weight` for specs, `product.imagePath` for images. Nothing is derived from brand + model strings. This makes the system **rename-safe** â€” when Spec Factory renames a brand or model, the sync script updates all fields atomically, and components render correctly without code changes.

**When product data changes** (new product, price update, spec correction):
1. Spec Factory exports updated JSON (or edit JSON manually during dev)
2. Rebuild and deploy (~2 min with Astro)
3. CloudFront serves the updated pages

**When a product is renamed** (brand, model, or variant change):
1. Spec Factory sync script updates product JSON (`slug`, `imagePath`, `url`, `model`)
2. Sync script moves image folder to match new slug path
3. Sync script rewrites `productId` in any linked reviews
4. Rebuild and deploy â€” components produce correct URLs automatically

See `docs/DATA-IMAGE-CONTRACT.md` for the full contract.

---

## 5. Hub Pages: Static Shell + Client-Side Filtering

Hub pages (`/hubs/mouse`, `/hubs/keyboard`, `/hubs/monitor`) use **fully bookmarkable URLs with query params** â€” but all filtering, sorting, and view switching happens **client-side in a React island**. No server involved.

### How it works

```
/hubs/mouse?brand=razer,logitech&weight=50-80&sort=price_low_to_high&view=large
     â”‚
     â–¼
â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
â”‚  [category].astro  (STATIC â€” built once at build)    â”‚
â”‚                                                      â”‚
â”‚  Embeds slim product data in <script> tag            â”‚
â”‚  â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”  â”‚
â”‚  â”‚  <HubApp client:load />  (React island)        â”‚  â”‚
â”‚  â”‚                                                â”‚  â”‚
â”‚  â”‚  1. Reads URL query params on mount            â”‚  â”‚
â”‚  â”‚  2. Hydrates Nano Store with filter state      â”‚  â”‚
â”‚  â”‚  3. Runs filter-engine â†’ filtered products     â”‚  â”‚
â”‚  â”‚  4. Renders cards in selected view mode        â”‚  â”‚
â”‚  â”‚  5. On filter change â†’ pushState() updates URL â”‚  â”‚
â”‚  â”‚                                                â”‚  â”‚
â”‚  â”‚  No server round-trips. Everything in-browser. â”‚  â”‚
â”‚  â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜  â”‚
â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
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
      â†“  slim down to display fields only
  hubData.mouse.json (~80 KB, 15-20 fields per product)
      â†“  embedded in static HTML as <script>
  window.__HUB_DATA__

Runtime (browser):
  URL query params  â†’  url-sync.ts  â†’  $hubStore (Nano Store)
                                            â†“
  filter-engine.ts  â†  $hubStore  â†’  HubApp.tsx  â†’  renders cards
       â†“
  Filtered products  â†’  ProductGrid.tsx  â†’  DOM
       â†“
  Filter counts  â†’  FilterBar.tsx  â†’  "12 results" badges
```

### Why static + client-side (not SSR)

This is the industry standard. Amazon, Newegg, PCPartPicker, Best Buy â€” all serve a static shell and filter client-side. Reasons:

- **No server cost** â€” hub pages are the most visited, static = free CDN serving
- **Instant page load** â€” static HTML loads from nearest CDN edge
- **No filter flash** â€” skeleton shown for ~100ms while React hydrates, then filtered cards appear
- **Same bookmarkable URLs** â€” `pushState()` updates URL without page reload
- **Current system already works this way** â€” after initial server render, all filter changes happen client-side via React hydration

### Slim data vs full data

The full `mouse.json` has 145+ fields per product (1.4 MB). Hub cards only need ~15-20 fields. At build time, we generate a slim JSON with only what the hub needs:

```typescript
// Slim hub record â€” only display + filter fields
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

This keeps the embedded data to ~80 KB for 342 mice â€” loads instantly.

---

## 6. Metrics System (Visual SVG Scoring)

### What metrics are
Metrics are **visual SVG displays** on product cards that show how a product's specs compare against the distribution of all products in that category. They are NOT tooltips â€” they are a separate visual system.

### The 5 SVG visual types

| SVG Type | Component | Used for | How it works |
|----------|-----------|----------|-------------|
| **Rating Circle** | `MetricRating.astro` | Accuracy, comfort, overall, genre scores | Filled ring proportional to 0-10 score. `stroke-dashoffset` + gradient. |
| **Reverse Rating** | `MetricWeight.astro` | Weight (lighter = better) | Same ring but fill is inverted. Feather icon inside. |
| **Gauge** | `MetricGauge.astro` | Polling rate, DPI, IPS, acceleration | 70% arc (235Â°â€“485Â°) with rotating needle + 5 tick marks. |
| **Performance Arc** | `MetricPerformance.astro` | Non-speedometer performance metrics | Progress arc with value text + suffix inside. |
| **Speedometer** | `MetricSpeedometer.astro` | Sensor latency, click force, click latency, lift-off | 10-segment fan shell with rotating needle. |

Plus special visual treatments:
- **Sensor** (`MetricSensor.astro`) â€” concentric circles + crosshair, shows sensor date as year
- **Feet/Skates** (`MetricFeet.astro`) â€” circle with mouse-foot SVG art inside a rating ring

### XXL card layout (4 sections, 2 rows of 2 columns)

```
â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¬â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
â”‚  Ratings                â”‚  Build                  â”‚
â”‚  â— Overall  â— Accuracy  â”‚  â—Ž Sensor  â—Ž Weight    â”‚
â”‚  â— Response â— Quality   â”‚  â—Ž Skates              â”‚
â”‚  â— Comfort  â— Work      â”‚                         â”‚
â”‚  â— FPS â— MMO â— MOBA     â”‚                         â”‚
â”‚  â— AARPG â— RTS          â”‚                         â”‚
â”œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¼â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¤
â”‚  Hardware               â”‚  Performance            â”‚
â”‚  âŠ™ Polling  âŠ™ DPI      â”‚  â—‰ Sensor Latency      â”‚
â”‚  âŠ™ IPS     âŠ™ Accel     â”‚  â—‰ Click Force         â”‚
â”‚                         â”‚  â—‰ Switch Latency      â”‚
â”‚                         â”‚  â—‰ Lift-Off            â”‚
â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”´â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
â— = Rating circle  â—Ž = Custom SVG  âŠ™ = Gauge  â—‰ = Speedometer
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
- `score: true` â€” value is already 0-10 (no normalization needed)
- `invert: true` â€” lower raw value = higher score (weight, latency)
- `arrayHighLow: "high" | "low"` â€” which value to pick from array fields
- `suffix` / `prefix` â€” display formatting

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
    â†“
scoreFromMinMax(rawValue, distribution)
    â†“  if score: true  â†’ clamp(rawValue, 0, 10)
    â†“  if score: false â†’ frac = (raw - min) / (max - min)
    â†“                    if invert: frac = 1 - frac
    â†“                    score = frac * 10
    â†“
0-10 score
    â†“
categoryScoreColor(score, category)
    â†“  score â‰¥ 7.5 â†’ category brand color
    â†“  score â‰¥ 5   â†’ category brand color (lighter)
    â†“  score > 0   â†’ neutral warm tone
    â†“  score = 0   â†’ gray (N/A)
    â†“
SVG parameters (strokeOffset, needleAngle, colors)
    â†“
SVG component renders
```

### Composite tooltip pattern (metrics + tooltips combined)

Each metric SVG card also shows a **composite tooltip** on hover/click. This tooltip combines two things:

1. **Tooltip text** (top) â€” the category explainer from `src/data/tooltips/` (e.g., "What is DPI?")
2. **Distribution bar chart** (bottom) â€” shows where this product falls among all products

This means the `metricTooltip()` from HBS is replaced by the **same global popover** from Phase 4, but with an extended content area:

```html
<div id="global-tooltip" popover role="tooltip">
  <strong id="tooltip-title"></strong>
  <p id="tooltip-body"></p>
  <!-- Distribution section â€” only shown when data-tooltip-dist is present -->
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
  data-tooltip-body="Dots Per Inch â€” controls cursor sensitivity..."
  data-tooltip-dist='{"values":[4200,6000,...],"counts":[1,3,...]}'
  data-tooltip-highlight="7"
>?</button>
```

The positioning script in MainLayout checks for `data-tooltip-dist` â€” if present, it renders the bar chart; if absent, it shows text-only (same as filter menu tooltips).

### Build-time distribution computation

In HBS, `compileCategory.js::buildMetricDistributions()` scans all products at server startup. In Astro, this moves to a **build-time script**:

```
astro build
    â†“
scripts/build-distributions.mjs (runs before page generation)
    â†“  reads src/content/data-products/mouse/**/*.json (342 products)
    â†“  reads src/data/metrics/mouse.json (metric config)
    â†“  for each metric key:
    â†“    scans all products, collects values, bins them
    â†“    computes min/max/counts
    â†“
    â†“  writes src/data/metrics/distributions/mouse.json
    â†“
Pages import distributions at build time â†’ embedded in static HTML
```

This replaces the runtime `cache.data.hubs.mouse.metricDistributions` with a static JSON file that Astro pages import directly.

---

## 7. Tagged Cards, Recommender & Affiliate System

### What tagged cards are
Tagged cards are the **product feed cards** shown throughout the site â€” on snapshot pages (recommended / similar sections), in MDX article content, and on the home page. Each card shows a product image, brand/model, a deal button (affiliate link), hub tag pills, and comparison links.

### The 4 sub-systems

| Sub-system | HBS source | TSX location | Purpose |
|-----------|-----------|-------------|---------|
| **Hub Tags** | `compileHubTags.js` (27 KB) | `src/data/hub-tags/` | Auto-select 3-5 spec pill labels per product |
| **Recommender** | `compile_Recommender.js` (42 KB) | `src/data/recommender/` | Compute `similar[]` (5) + `recommended[]` (3-8) per product |
| **Tagged Card** | `card-tagged.handlebars` (215 lines) | `src/shared/ui/TaggedCard.astro` | Renders the actual card UI |
| **Affiliate Links** | `affiliate-retailers.yaml` + `dealLink()` | `src/data/affiliates/` | Resolve deal button URL (primary â†’ search â†’ Amazon fallback) |

### Hub Tags: auto-generated spec pills

`compileHubTags.js` scores every filterable key per product using weighted heuristics, then picks the top 3-5 as clickable pill links on tagged cards.

**Algorithm:**
```
For each product:
  1. Collect all filterable keys (from sliderItems + toggleItems + filterOrder)
  2. Score each key:
     baseScore = UNIVERSAL_WEIGHT[key] + CATEGORY_WEIGHT[category][key]
     + numericPercentileBonus (up to +12)
     + mouseOverrides (polling â‰¥8000: +10, weight â‰¤55g: +8, etc.)
     + semanticBoost (left-handed: +12, ambi: +8)
     + scoreGenreBoost (overall â‰¥9.25: +16, fps=yes: +10, etc.)
  3. Sort by score descending (ties: filterOrder index, then alpha)
  4. Take top 4 deterministically + 1 "random" via seeded FNV-1a hash
  5. Guarantee price_range + at least one score/genre key
```

**Output:** `product.hubTags = ["polling_rate", "price_range", "overall", "weight", "fps"]`

Each tag renders as a clickable pill link that pre-fills the hub filter:
- Slider keys: `Â±10%` range (e.g., `/hubs/mouse?weight=67-83`)
- Toggle keys: exact value (e.g., `/hubs/mouse?wireless=true`)
- Date keys: `Â±2 months` window

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
  Sort descending â†’ take top SIM_LIMIT (5)
```

**Recommended** (cross-category, affinity-driven, 3-8 items):
```
Base score = similarity Ã— (overall / 10) Ã— affinityFactor Ã— brandBonus

Candidate filtering (3 passes):
  Pass 1 (strict): overall â‰¥ QUALITY_CUTOFF (8), max REC_MAX_PER_CATEGORY (3), no streak > 2
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
  â†’ product.affiliateLinks.find(l => l.isPrimary) â†’ "View Deal"

Tier 2: Retailer search fallback
  â†’ affiliate-retailers.yaml â†’ primaryRetailer (Amazon)
  â†’ urlTemplate: "https://www.amazon.com/s?k={query}&tag=eggear-20" â†’ "Search"

Tier 3: Hard fallback
  â†’ "https://www.amazon.com/s?k={brand}+{model}+{category}&tag=eggear-20" â†’ "Search"
```

**5 configured retailers:** Amazon (primary, enabled), Best Buy (enabled), B&H (enabled), Walmart (disabled), Newegg (enabled). Each has a search URL template with `{query}`, `{brand}`, `{model}`, `{category}` tokens.

### Tagged Card component: `TaggedCard.astro`

Replaces `card-tagged.handlebars`. Static Astro component (zero JS). Contains:

```
â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
â”‚  Product image (responsive srcset)â”‚
â”‚  + EG logo watermark              â”‚
â”œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¤
â”‚  Brand   Model   [View Deal]     â”‚
â”œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¤
â”‚  [+ Add to Vault]                â”‚
â”œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¤
â”‚  Snap description                 â”‚
â”‚  [polling: 8000hz] [weight: 58g] â”‚  â† hub tag pills (clickable filter links)
â”‚  [overall: 9.3] [fps]            â”‚
â”œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¤
â”‚  Compare Side-by-Side:           â”‚
â”‚  [Stats] [Radar] [Shapes]        â”‚  â† only when same category as host
â”œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¤
â”‚  Last Updated | 2026-02-15  â†’    â”‚
â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
```

### Feed scrollers: `FeedScroller.astro`

Replaces `card-xxlarge-recommended.handlebars` and `card-xxlarge-similar.handlebars`. Renders a collapsible section with horizontal scroller + left/right arrows. Iterates an array of product references and renders `TaggedCard` for each.

Also supports grid mode (`card-xxlarge-tagged-manual.handlebars`) â€” used in MDX article content via `{{{xxl_tagged}}}` helper, with configurable column count via `--grid-cols` CSS variable.

### Build-time computation (Astro)

All three build-time computations (hub tags, recommender, distributions) move to Astro build scripts:

```
astro build
    â†“
scripts/build-recommender.mjs
    â†“  reads src/content/data-products/mouse/**/*.json (342 products)
    â†“  computes similar[] (5 per product) + recommended[] (3-8 per product)
    â†“  writes src/data/recommender/mouse.json
    â†“
scripts/build-hub-tags.mjs
    â†“  reads src/content/data-products/mouse/**/*.json + filter config
    â†“  scores keys per product, picks top 3-5
    â†“  writes hubTags[] back to product JSON (or separate file)
    â†“
Pages import recommender + hub tag data at build time â†’ rendered into static HTML
```

---

## 8. Authentication Architecture (Implemented)

### What stays the same
- **AWS Cognito User Pool** â€” same pool, same client ID, same hosted UI
- **DynamoDB tables** â€” `eg_profiles`, `eg_usernames` â€” untouched
- **OAuth flow** â€” Authorization Code Grant with OIDC
- **Social providers** â€” Google, Discord, email/password â€” configured in Cognito

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
â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
GET  /login                    â†’   src/pages/login/index.ts      (identity_provider=COGNITO)
GET  /login/google             â†’   src/pages/login/google.ts     (identity_provider=Google)
GET  /login/discord            â†’   src/pages/login/discord.ts    (identity_provider=Discord)
GET  /signup                   â†’   src/pages/login/index.ts      (screen_hint=signup)
GET  /auth/callback            â†’   src/pages/auth/callback.ts    (smart: postMessage OR 302)
GET  /api/auth/me              â†’   src/pages/api/auth/me.ts      (Cache-Control: no-store)
GET  /logout                   â†’   src/pages/logout.ts
GET  /api/user/vault           â†’   src/pages/api/user/vault.ts
PUT  /api/user/vault           â†’   src/pages/api/user/vault.ts
```

**jQuery auth UI â†’ React islands + Nano Store:**

```
CURRENT (jQuery + globals)                  ASTRO + REACT
â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
window.EG_UID                    â†’   $auth store (Nano Store atom)
window.refreshAuthState()        â†’   hydrateAuth() â†’ fetch /api/auth/me
popup-login.handlebars           â†’   <AuthDialog client:load /> (native <dialog>)
popup-signup.handlebars          â†’   <AuthDialog /> with view='signup'
user_auth.js (600+ lines)        â†’   store.ts + hosted-ui.ts + middleware.ts
main.handlebars auth watcher     â†’   $auth.listen() â†’ html.logged CSS class toggle
account_profile.handlebars       â†’   <ProfilePage client:load /> in account.astro
```

### Login flows

**Desktop (Google/Discord) â€” instant, no Hosted UI page:**
```
1. User clicks "Google" â†’ openHostedUI('/login/google')
2. Popup opens â†’ /login/google 302s to Cognito â†’ Cognito 302s to Google
3. Google auth â†’ Cognito 302s to /auth/callback
4. Callback sets HttpOnly cookies + returns HTML with postMessage('eg-auth-done')
5. Parent receives postMessage â†’ hydrateAuth() â†’ fetch /api/auth/me â†’ setAuthenticated()
6. AuthDialog effect detects auth â†’ closeAuth() â†’ dialog closes
```

**Desktop (Email/Password) â€” shows Cognito Hosted UI:**
```
1. User clicks "Email" â†’ openHostedUI('/login')
2. Popup opens â†’ /login 302s to Cognito with identity_provider=COGNITO
3. Cognito renders email/password form (dark theme via cognitoUI/template.css)
4. COOP severs popup reference (popup.closed = true immediately)
5. Cookie poll keeps running (no popup.closed cancellation â€” 10-min timeout only)
6. User enters credentials â†’ Cognito 302s to /auth/callback
7. Callback sets cookies (including eg_hint=1) + postMessage + self-closes
8. Cookie poll detects eg_hint=1 â†’ hydrateAuth() â†’ dialog closes
```

**Mobile (all providers):**
```
1. User clicks login â†’ openHostedUI() detects mobile
2. Sets eg_return cookie with current page path
3. Full-page redirect to Cognito
4. Auth completes â†’ /auth/callback reads eg_return cookie
5. Callback validates return URL â†’ 302s back to original page (not /)
6. Page loads with eg_hint=1 â†’ html.logged set before paint â†’ hydrateAuth() confirms
```

### Smart callback: single endpoint for popup + mobile

The `/auth/callback` endpoint detects the caller via the `eg_return` cookie:

- **No `eg_return` cookie** â†’ desktop popup â†’ return HTML with `postMessage('eg-auth-done')` + `window.close()`
- **`eg_return` cookie present** â†’ mobile â†’ validate return URL â†’ 302 redirect â†’ clear cookie

Both paths: exchange code for tokens (with PKCE verifier), verify JWT via jose JWKS, set HttpOnly cookies, detect first-signup via DynamoDB `readVaultRev()`.

### PKCE (Proof Key for Code Exchange â€” RFC 7636)

Every login endpoint generates a PKCE challenge:
1. `code_verifier` = `randomBytes(32).toString('base64url')` (43 chars)
2. `code_challenge` = `SHA-256(verifier).toString('base64url')`
3. Verifier stored in `eg_pkce` HttpOnly cookie (5-min TTL)
4. Challenge sent to Cognito as `code_challenge` + `code_challenge_method=S256`
5. Callback reads `eg_pkce` cookie, passes verifier to token exchange
6. Cognito validates `SHA-256(verifier) === challenge` before issuing tokens

### Token refresh (middleware)

```
src/middleware.ts â€” runs on every SSR request:

1. Read eg_session cookie
2. If no token â†’ guest (locals.user = null)
3. Decode JWT exp (without verification) via getTokenExpiry()
4. If fully expired (exp â‰¤ now) â†’ clearAuthCookies() â†’ guest
5. If near expiry (exp - now â‰¤ 5 min) â†’ read eg_refresh â†’ refreshTokens()
   - Success â†’ setAuthCookies(new tokens) â†’ verify â†’ set locals.user
   - Failure â†’ fall through (token still valid for up to 5 min)
6. Normal path â†’ verifyIdToken(token) via jose JWKS â†’ set locals.user
```

### Auth feature module

```
src/features/auth/
â”œâ”€â”€ store.ts               # $auth atom + $authDialog atom + BroadcastChannel sync
â”‚                          #   hydrateAuth() â†’ fetch /api/auth/me â†’ setAuthenticated()
â”‚                          #   $auth.listen() â†’ html.logged CSS class toggle
â”‚                          #   BroadcastChannel('eg-auth-sync') for cross-tab sync
â”‚
â”œâ”€â”€ hosted-ui.ts           # openHostedUI(path) â€” popup/redirect logic
â”‚                          #   Desktop: postMessage listener + cookie poll (1s) + 10-min timeout
â”‚                          #   Mobile: eg_return cookie + full-page redirect
â”‚                          #   COOP-resilient: no popup.closed cancellation
â”‚
â”œâ”€â”€ types.ts               # AuthState = { status, uid, email, username }
â”œâ”€â”€ schemas.ts             # AuthMeResponseSchema (Zod)
â”‚
â”œâ”€â”€ server/
â”‚   â”œâ”€â”€ cognito-config.ts  # Zod-validated Cognito env vars (getCognitoConfig())
â”‚   â”œâ”€â”€ cookies.ts         # HttpOnly cookie helpers (build/read/clear/set)
â”‚   â”œâ”€â”€ jwt.ts             # jose JWKS verification + getTokenExpiry()
â”‚   â”œâ”€â”€ oidc.ts            # generateOidcState(), generatePkceChallenge(), validateReturnUrl()
â”‚   â”œâ”€â”€ refresh.ts         # refreshTokens() via Cognito /oauth2/token
â”‚   â””â”€â”€ token-exchange.ts  # exchangeCodeForTokens(code, codeVerifier?)
â”‚
â”œâ”€â”€ components/
â”‚   â”œâ”€â”€ AuthDialog.tsx     # Native <dialog> shell (showModal, animated close)
â”‚   â”œâ”€â”€ LoginView.tsx      # Login panel (Google, Discord, Email buttons)
â”‚   â”œâ”€â”€ SignupView.tsx     # Signup panel
â”‚   â”œâ”€â”€ BrandLogo.tsx      # EG wordmark SVG
â”‚   â””â”€â”€ GoogleIcon.tsx     # Google "G" icon SVG
â”‚
â””â”€â”€ tests/                 # 69 tests total across 5 files
    â”œâ”€â”€ auth-server.test.mjs    # 39 tests (PKCE, cookies, refresh, return URL, JWT expiry)
    â”œâ”€â”€ auth-store.test.mjs     # Store state transitions
    â”œâ”€â”€ auth-hydrate.test.mjs   # hydrateAuth() fetch mock tests
    â”œâ”€â”€ auth-schemas.test.mjs   # Zod schema validation
    â””â”€â”€ auth-dialog-store.test.mjs  # Dialog open/close, view switching
```

### Cognito Hosted UI customization

The file `cognitoUI/template.css` styles the Cognito Hosted UI pages to match the site's dark theme. Upload via AWS Console â†’ Cognito â†’ User Pool â†’ App integration â†’ Hosted UI customization.

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
Request â†’ Express â†’ RAM cache check â†’ Redis check â†’ S3 check â†’ Render HTML â†’ Cache in all 3
```

Three-tier cache (RAM â†’ Redis â†’ S3) exists because **Express renders HTML on every request**. Caching avoids re-rendering the same page repeatedly.

### New system (Astro)

```
Build â†’ Static HTML â†’ Upload to S3 â†’ CloudFront caches â†’ User gets HTML from CDN edge
```

**No Redis. No RAM cache. No Express rendering.** The HTML is built once during `astro build` and served directly from CloudFront. There's nothing to cache because the HTML already exists as static files.

| Current layer | What it did | Astro equivalent |
|---------------|-------------|------------------|
| RAM cache | Avoid re-rendering hot pages | Not needed â€” pages are static files |
| Redis cache | Persist rendered HTML across restarts | Not needed â€” HTML is on S3 |
| S3 cache | Backup for cold starts | S3 IS the primary storage now |
| Express render | Generate HTML per request | `astro build` generates all HTML once |

**For SSR endpoints** (auth, API): These are stateless Lambda functions. They don't need caching â€” they just read/write DynamoDB directly.

**For dynamic client-side data** (vault, prefs): React islands fetch from `/api/user/*` endpoints. Browser handles caching via standard HTTP headers.

### When product data changes

1. Update the JSON file in `src/content/data-products/`
2. Run `astro build` (~2 min for the full site)
3. Deploy to S3 + invalidate CloudFront cache
4. New HTML is live globally in ~60 seconds

This is the standard workflow for content sites. If you later need near-instant updates (e.g., live pricing), you can:
- Switch specific pages to SSR (`export const prerender = false`)
- Or use client-side fetch to load product data from an API

But start with static builds â€” it's simpler, faster, and cheaper.

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
publish: true
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
1. Create content     â†’  node scripts/new-content.mjs ...
2. Drop images        â†’  Copy images into public/images/{path}/
3. Write content      â†’  Edit the .mdx file in VS Code
4. Preview            â†’  astro dev  (localhost:4321, hot reload)
5. Build              â†’  astro build  (~2 min)
6. Deploy             â†’  Push to repo â†’ CI/CD deploys to S3 + CloudFront
```

### Compared to current workflow

| Step | Current (EG-HBS) | New (EG-TSX) |
|------|-------------------|--------------|
| Create content | Right-click â†’ md_new.py â†’ creates .md + image folder | `node scripts/new-content.mjs` â†’ creates .mdx + image folder |
| Add product | Edit JSON manually | CMS exports updated JSON (Phase 13) |
| Preview | `npm start` â†’ Express renders on each refresh | `astro dev` â†’ hot reload, instant updates |
| Build | `node scripts-jsons/convertMarkdownArticles.js` â†’ RAM/Redis/S3 cache | `astro build` â†’ static HTML to `dist/` |
| Deploy | Upload cache to S3, restart Express | Upload `dist/` to S3, invalidate CloudFront |
| Image serving | Express middleware â†’ CloudFront redirect | Direct from `public/` (dev) or CloudFront (prod) |

---

## 11. Deployment Architecture

```
                        â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
                        â”‚       CloudFront CDN         â”‚
                        â”‚   (global edge caching)      â”‚
                        â””â”€â”€â”€â”€â”€â”€â”¬â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¬â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
                               â”‚          â”‚
                    Static     â”‚          â”‚  SSR
                    content    â”‚          â”‚  requests
                               â–¼          â–¼
                  â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”  â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
                  â”‚   S3 Bucket    â”‚  â”‚   Lambda@Edge      â”‚
                  â”‚                â”‚  â”‚   (or Lambda +     â”‚
                  â”‚  dist/         â”‚  â”‚    API Gateway)     â”‚
                  â”‚  â”œâ”€â”€ index.htmlâ”‚  â”‚                    â”‚
                  â”‚  â”œâ”€â”€ reviews/  â”‚  â”‚  Handles:          â”‚
                  â”‚  â”œâ”€â”€ guides/   â”‚  â”‚  /auth/callback    â”‚
                  â”‚  â”œâ”€â”€ images/   â”‚  â”‚  /api/user/*       â”‚
                  â”‚  â””â”€â”€ ...       â”‚  â”‚  /login, /logout   â”‚
                  â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜  â””â”€â”€â”€â”€â”€â”€â”€â”€â”¬â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
                                               â”‚
                                               â–¼
                                    â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
                                    â”‚    DynamoDB         â”‚
                                    â”‚                    â”‚
                                    â”‚  eg_profiles       â”‚
                                    â”‚  eg_usernames      â”‚
                                    â”‚  eg_sessions       â”‚
                                    â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
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
# â”€â”€â”€ Site â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
PUBLIC_SITE_URL=https://expertgaming.gg

# â”€â”€â”€ AWS Cognito (public â€” safe to expose) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
PUBLIC_COGNITO_REGION=us-east-2
PUBLIC_COGNITO_USER_POOL_ID=us-east-2_HIa5R29fk
PUBLIC_COGNITO_APP_CLIENT_ID=6e29cvrtq3kodvbglh0ks4kjbp
COGNITO_CLIENT_SECRET=                          # Only if confidential client
COGNITO_DOMAIN=us-east-2hia5r29fk.auth.us-east-2.amazoncognito.com
COGNITO_CALLBACK_URL=http://localhost:4321/auth/callback
COGNITO_LOGOUT_URL=http://localhost:4321

# â”€â”€â”€ DynamoDB â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
DYNAMO_PROFILES_TABLE=eg_profiles
DYNAMO_USERNAMES_TABLE=eg_usernames

# â”€â”€â”€ CDN / CloudFront â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
CDN_BASE_URL=https://d3m2jw9ed15b7k.cloudfront.net

# â”€â”€â”€ Affiliate tags (server-only) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
AFFILIATE_AMAZON=expertgaming-20
AFFILIATE_BHPHOTO=
AFFILIATE_NEWEGG=

# â”€â”€â”€ Analytics â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
PUBLIC_GA_MEASUREMENT_ID=G-XXXXXXXXXX

# â”€â”€â”€ Build â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

> **Build approach:** One component, one section, one page at a time. Phases 4â€“7 use numbered sub-phases for granular tracking. Components built in earlier phases are reused by later phases. Shared components are extracted into `src/shared/ui/` when a second page needs them.

### Phase 1: Data Foundation (DONE)
- [x] Content collections with Zod schemas
- [x] Migration script (`scripts/migrate-content.mjs`)
- [x] CUID2 crosswalk for idempotency (archived â€” slug is now primary key)
- [x] Product JSON registries (mouse, keyboard, monitor)
- [x] All content migrated: 47 reviews, 29 brands, 11 games, 33 guides, 23 news, 4 pages
- [x] Category subfolder structure preserved

### Phase 2: Project Scaffold (DONE)
- [x] Astro 5 + React 19 + Tailwind v4 + MDX + Sitemap
- [x] Content collections with Zod schemas
- [x] 4 themes via CSS variables
- [x] Path aliases, cn.ts, config.ts, slugs.ts
- [x] Images copied to `public/images/` (from EG-HBS/images/, never move)
- [ ] `scripts/new-content.mjs` â€” create new MDX + image folder (deferred)
- [ ] Convert migrated `.md` files to `.mdx` (as components are built)

### Phase 3: Content Migration (PARTIAL)
- [x] Migration script done, .md files migrated
- [ ] MDX conversion pending (as components are built in Phases 4â€“7)

### Phase 4: Global Shell & Home Page (sub-phases 4.1â€“4.15) â€” IN PROGRESS
- [x] 4.1 MainLayout shell (head, theme, popover host)
- [x] 4.2 GlobalNav desktop (logo, links, mega-menus)
- [x] 4.3 NavMobile (hamburger drawer, React island)
- [ ] 4.4 GlobalFooter (4-column footer, copyright)
- [x] 4.5 global.css updates (11px base font, 146 fluid typography vars, theme tokens)
- [x] 4.6 Adbar (responsive text banner)
- [x] 4.7 Hero section (H1/H2, stats buttons, count animation)
- [x] 4.8 SlideShow carousel (product slides, Embla, rating bar)
- [x] 4.9 Tools section (hub tool links â€” gateway + filter + wired sidebar)
- [x] 4.9b Ads feature (AD_REGISTRY, resolveAd, AdSlot.astro, home rail placeholder, 23 tests)
- [ ] 4.10 Dashboard grid ("What's New" â€” 5 rows, news sidebar)
- [ ] 4.11 Game Gear Picks (game card scroller)
- [ ] 4.12 Featured Reviews (category tabs + card scroller)
- [ ] 4.13 Highlighted Guides (card scroller)
- [ ] 4.14 Latest News 4Ã—4 (news card grid)
- [ ] 4.15 Home page QA (side-by-side at all breakpoints)

### Phase 5: Snapshot Page (sub-phases 5.1â€“5.10)
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

### Phase 6: Hub Page (sub-phases 6.1â€“6.11)
- [ ] 6.1 Hub layout (static shell, slim data embed)
- [ ] 6.2 HubApp island (top-level React island)
- [ ] 6.3 Nano Store (filters, sort, view, compare state)
- [ ] 6.4 URL sync (pushState â†” store)
- [ ] 6.5 Filter engine (pure filter/sort functions)
- [ ] 6.6 FilterBar (brand toggles, sliders, search)
- [ ] 6.7 ProductCard + ProductGrid (4 view modes)
- [ ] 6.8 SortDropdown + ViewSwitcher
- [ ] 6.9 CompareMatrix (stats/shapes/radar)
- [ ] 6.10 Build-time pipelines (hub tags, recommender, distributions)
- [ ] 6.11 Hub page QA (all filter/sort/view combinations)

### Phase 7: Content Pages (sub-phases 7.1â€“7.9)
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
- [ ] Covered by Phase 7 sub-phases 7.6â€“7.8

### Phase 9: Auth & Dynamic Features
- [x] `src/features/auth/server/` â€” cognito-config, cookies, jwt, oidc, token-exchange, refresh
- [x] SSR endpoints â€” login (email/Google/Discord), callback (smart popup+mobile), logout
- [x] SSR endpoint â€” /api/auth/me (Cache-Control: no-store)
- [ ] SSR endpoints â€” /api/user/prefs, username
- [x] SSR endpoint â€” /api/user/vault (GET with conditional 304 + PUT)
- [x] AuthDialog + LoginView + SignupView (native `<dialog>`, auto-close on auth)
- [x] $auth + $authDialog Nano Stores + BroadcastChannel cross-tab sync
- [x] hosted-ui.ts â€” postMessage popup flow + mobile return URL + COOP resilience
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
- [ ] Deploy pipeline (CI/CD â†’ S3 + CloudFront)
- [ ] DNS cutover
- [ ] `scripts/build-sizes.mjs` â€” Sharp auto-generates size ladder from single source images (replaces manual Photoshop multi-export)

### Phase 13: CMS Configuration (Final)
- [ ] Define CMS output format for product JSON registries (match `src/content/data-products/` schema)
- [ ] Define CMS output format for brand data (slug-keyed, descriptions, logos)
- [ ] Map CMS fields to Zod schemas (content.config.ts validation)
- [ ] Determine which content types the CMS manages vs manual MDX creation
- [ ] Build CMS â†’ site rebuild pipeline (CMS publish â†’ trigger `astro build` â†’ deploy)
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
| Product data | CMS â†’ JSON registries â†’ static build (Phase 13) | CMS outputs format matching Zod schemas; during dev, edit JSON directly |
| Deploy | S3 + CloudFront + Lambda | Same infra you have, minus Express/Redis |
| Categories | Stable enum (no CUID2 IDs) | 6 items, rarely change, not worth the indirection |
