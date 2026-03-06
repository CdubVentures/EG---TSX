# Phase E: Direct Sponsor System

> **Parent plan:** `../../AD-STACK-PLAN.md`
> **Status:** NOT STARTED
> **Prerequisite:** Phase A complete. Phase C.5 (GUI tab) can be built in parallel.
> **Effort:** Medium
> **Scope:** Weighted sponsor creative rotation with date scheduling, build-time selection, bootstrap wiring

---

## Overview

Direct sponsors are ads served from our own images — no ad network involved. This is the highest-margin ad type (100% revenue, no intermediary cut). HBS has this via `direct.json` with weighted rotation; TSX has the schema fields but no rotation logic.

**What we're building:**
1. Zod schema for `DirectCreative` and `DirectPlacement`
2. Config file (`direct-sponsors.json`) with creative data
3. `rotation.ts` — pure function for weighted selection with date filtering
4. Build-time integration — `AdSlot.astro` renders selected creative at SSG time
5. Runtime fallback — `bootstrap.ts` `mountDirect()` for SSR pages

**Key design decisions:**
- **Deterministic selection:** Same page + same campaign = same creative per build (seeded FNV-1a hash). This ensures CDN cache consistency.
- **Date filtering:** Creatives have start/end dates. Expired creatives are never selected. Future creatives are ignored until their start date.
- **Weight normalization:** Weights are relative, not percentages. If two creatives have weights 60 and 40, they get 60% and 40% of impressions. If the 40-weight expires, the 60-weight gets 100%.

---

## E.1 — Define Sponsor Schema + Config

**STATE:** CONTRACT

**Goal:** Create Zod schema for direct sponsor creatives and the config file.

**Schema:**

```typescript
// src/features/ads/sponsors/types.ts
import { z } from 'zod';

export const directCreativeSchema = z.object({
  id: z.string().min(1),              // unique ID (e.g., "razer-2026-q1")
  label: z.string().min(1),           // display name in GUI
  img: z.string().min(1),             // image path relative to /images/ads/
  href: z.string().url(),             // click-through URL
  width: z.number().int().positive(), // creative width in px
  height: z.number().int().positive(),// creative height in px
  weight: z.number().int().min(0),    // rotation weight (0 = never shown)
  start: z.string().date(),           // ISO date string: "2026-01-15"
  end: z.string().date(),             // ISO date string: "2026-06-30"
  rel: z.string().optional()          // link rel (default: "nofollow sponsored noopener")
    .default('nofollow sponsored noopener'),
  alt: z.string().optional()          // image alt text
    .default('Sponsored'),
});

export const directPlacementSchema = z.object({
  creatives: z.array(directCreativeSchema).min(1),
});

export const directSponsorsSchema = z.record(
  z.string(),                         // campaign name (must match ads-registry.json)
  directPlacementSchema
);

export type DirectCreative = z.infer<typeof directCreativeSchema>;
export type DirectPlacement = z.infer<typeof directPlacementSchema>;
export type DirectSponsors = z.infer<typeof directSponsorsSchema>;
```

**Config file:** `config/data/direct-sponsors.json`

```json
{
  "_comment": "Direct sponsor creatives. Each key is a campaign name matching ads-registry.json.",
  "hero-left": {
    "creatives": [
      {
        "id": "example-sponsor-2026",
        "label": "Example Sponsor",
        "img": "/images/ads/example-hero-300x400.webp",
        "href": "https://example.com/?ref=eggear",
        "width": 300,
        "height": 400,
        "weight": 100,
        "start": "2026-01-01",
        "end": "2026-12-31",
        "rel": "nofollow sponsored noopener",
        "alt": "Example Sponsor - Click to learn more"
      }
    ]
  }
}
```

**Loader:**

```typescript
// src/features/ads/sponsors/config.ts
import rawSponsors from '../../../config/data/direct-sponsors.json';
import { directSponsorsSchema, type DirectSponsors } from './types';

export const DIRECT_SPONSORS: DirectSponsors = directSponsorsSchema.parse(rawSponsors);

export function getSponsorsForCampaign(campaign: string): DirectPlacement | undefined {
  return DIRECT_SPONSORS[campaign];
}
```

**Tests (RED first):**

| Test | Input | Expected |
|------|-------|----------|
| Valid config parses | Full config above | No throw |
| Missing `id` | Creative without `id` | ZodError |
| Invalid `href` | `href: "not-a-url"` | ZodError |
| Negative weight | `weight: -5` | ZodError |
| Zero weight allowed | `weight: 0` | Passes (0 = never selected) |
| Invalid date format | `start: "Jan 15 2026"` | ZodError |
| Empty creatives array | `creatives: []` | ZodError (min 1) |
| End before start | `start: "2026-06-30", end: "2026-01-01"` | Passes (filtering handles this at runtime) |
| Unknown campaign key | `"unknown-campaign": { ... }` | Passes (record allows any string key) |
| Default `rel` applied | Creative without `rel` field | `rel = "nofollow sponsored noopener"` |

**Files:**
- `src/features/ads/sponsors/types.ts` (new)
- `src/features/ads/sponsors/config.ts` (new)
- `config/data/direct-sponsors.json` (new)
- `src/features/ads/sponsors/tests/config.test.mjs` (new)

---

## E.2 — Build rotation.ts (Weighted Selection)

**STATE:** CONTRACT → RED → GREEN

**Goal:** Pure function that selects a creative based on weighted rotation with date filtering.

**Contract:**

```typescript
// src/features/ads/sponsors/rotation.ts

/**
 * Select a creative from the list based on:
 * 1. Date filtering — only active creatives (today between start and end)
 * 2. Weighted random — seeded FNV-1a hash for deterministic selection
 *
 * @param creatives - Array of DirectCreative objects
 * @param seed - Deterministic seed string (e.g., page slug + campaign name)
 * @param now - Override current date (for testing)
 * @returns Selected creative, or null if none are active
 */
export function selectCreative(
  creatives: DirectCreative[],
  seed: string,
  now?: Date,
): DirectCreative | null;
```

**Algorithm:**
1. Filter by date: keep only creatives where `now >= start && now <= end`
2. If no active creatives → return `null`
3. If one active creative → return it
4. Calculate total weight of active creatives
5. If total weight is 0 → return first active creative (fallback)
6. Hash the seed with FNV-1a → get a number in `[0, totalWeight)`
7. Walk active creatives, accumulating weights. Return the creative where cumulative weight exceeds the hash value.

**FNV-1a hash (already used in hub-tags):**

```typescript
// WHY: FNV-1a is used in hub-tags (tag-scorer.ts) for deterministic selection.
// Reuse the same hash function for consistency.
function fnv1a(str: string): number {
  let hash = 2166136261; // FNV offset basis
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = (hash * 16777619) >>> 0; // FNV prime, unsigned
  }
  return hash;
}
```

**Boundary tests (table-driven):**

| Creatives | Seed | Now | Expected | Why |
|-----------|------|-----|----------|-----|
| [] | "page-1" | any | null | No creatives |
| [A(w:100, 01-01→12-31)] | "page-1" | 2026-06-15 | A | Single active |
| [A(w:100, 01-01→03-01)] | "page-1" | 2026-06-15 | null | All expired |
| [A(w:100, 07-01→12-31)] | "page-1" | 2026-06-15 | null | All future |
| [A(w:50), B(w:50)] | "page-1" | 2026-06-15 | deterministic | Same seed always returns same result |
| [A(w:50), B(w:50)] | "page-2" | 2026-06-15 | deterministic | Different seed may return different result |
| [A(w:0), B(w:100)] | "page-1" | 2026-06-15 | B | Zero weight never selected |
| [A(w:0), B(w:0)] | "page-1" | 2026-06-15 | A | All zero → fallback to first |
| [A(w:60), B(w:40, expired)] | "page-1" | 2026-06-15 | A | Expired filtered out, A gets 100% |
| [A(w:70), B(w:20), C(w:10)] | "seed-X" | 2026-06-15 | deterministic | Three-way weighted selection |

**Determinism test:**
```javascript
// Same seed + same creatives + same date = ALWAYS the same result
const result1 = selectCreative(creatives, 'my-page/hero-left', new Date('2026-06-15'));
const result2 = selectCreative(creatives, 'my-page/hero-left', new Date('2026-06-15'));
assert.strictEqual(result1.id, result2.id);
```

**Distribution test (statistical):**
```javascript
// Run 10,000 selections with different seeds, verify distribution is roughly proportional
// A(70) + B(30) → A should be selected ~70% of the time (±5%)
let aCount = 0;
for (let i = 0; i < 10000; i++) {
  const result = selectCreative(creatives, `page-${i}`, now);
  if (result.id === 'a') aCount++;
}
assert(aCount > 6500 && aCount < 7500, `A selected ${aCount}/10000 times, expected ~7000`);
```

**Files:**
- `src/features/ads/sponsors/rotation.ts` (new)
- `src/features/ads/sponsors/tests/rotation.test.mjs` (new)

---

## E.3 — Wire Rotation into AdSlot.astro (Build-Time Path)

**STATE:** GREEN

**Goal:** For SSG pages, creative selection happens at build time. `AdSlot.astro` calls `selectCreative()` and renders the image+link directly (no JS needed for direct sponsor rendering).

**Implementation:**

Add a new render path to `AdSlot.astro` for `provider === 'direct'`:

```astro
---
import { getSponsorsForCampaign } from '../sponsors/config';
import { selectCreative } from '../sponsors/rotation';

// ... existing frontmatter ...

// Direct sponsor: select creative at build time
const isDirectProvider = placement?.provider === 'direct';
const directSponsors = isDirectProvider ? getSponsorsForCampaign(campaign) : undefined;
const directCreative = directSponsors
  ? selectCreative(
      directSponsors.creatives,
      `${Astro.url.pathname}/${campaign}`,  // seed = page path + campaign
    )
  : undefined;
---

{/* ── Direct Sponsor: build-time rendered image+link ── */}
{shouldRender && isDirectProvider && directCreative && (
  <div
    class="ad-slot ad-slot--direct"
    data-campaign={campaign}
    data-provider="direct"
    data-creative-id={directCreative.id}
    data-first-size={`${directCreative.width}x${directCreative.height}`}
    data-placement-type={placementType}
    data-fill="filled"
    style={`--ad-w: ${directCreative.width}px; --ad-h: ${directCreative.height}px;`}
    role="complementary"
    aria-label={ariaLabel}
  >
    <a
      href={directCreative.href}
      rel={directCreative.rel}
      target="_blank"
      class="ad-slot__direct-link"
    >
      <img
        src={directCreative.img}
        alt={directCreative.alt}
        width={directCreative.width}
        height={directCreative.height}
        loading="lazy"
        class="ad-slot__direct-img"
      />
    </a>
  </div>
)}

{/* ── Direct Sponsor: no active creative → production placeholder ── */}
{shouldRender && isDirectProvider && !directCreative && SHOW_PRODUCTION_PLACEHOLDERS && (
  <div
    class="ad-slot ad-slot--production"
    data-campaign={campaign}
    data-provider="direct"
    data-first-size={sizeStr}
    data-placement-type={placementType}
    style={`--ad-w: ${w}px; --ad-h: ${h}px;`}
    role="complementary"
    aria-label={ariaLabel}
  >
    <span class="ad-label">{AD_LABEL}</span>
  </div>
)}
```

**CSS (add to AdSlot.astro styles):**

```css
/* Direct sponsor — image fills the slot */
.ad-slot--direct {
  width: var(--ad-w, 300px);
  max-width: 100%;
  overflow: hidden;
}

.ad-slot__direct-link {
  display: block;
  line-height: 0;
}

.ad-slot__direct-img {
  width: 100%;
  height: auto;
  display: block;
}
```

**Test:** Build a page that has a direct-provider placement with one active creative. View the HTML source → contains `<a href="..."><img src="..." />` (no JS, no adsbygoogle). The creative image is rendered statically.

**File:** `src/features/ads/components/AdSlot.astro`

---

## E.4 — Wire Rotation into bootstrap.ts (Runtime Fallback)

**STATE:** GREEN

**Goal:** For SSR pages or dynamic contexts, `mountDirect()` in bootstrap.ts renders the creative at runtime.

**Current `mountDirect()` (bootstrap.ts):**
The existing function reads `data-*` attributes from the slot element. For direct sponsors, we need to pass the selected creative's data via data attributes (set by Astro at build time or SSR time).

**Implementation:**

```typescript
// bootstrap.ts — updated mountDirect()
function mountDirect(el: HTMLElement): void {
  const creativeId = el.dataset.creativeId;
  if (!creativeId) {
    // No creative selected (all expired or none configured)
    markUnfilled(el);
    return;
  }

  // Creative was pre-selected at build time and rendered as <a><img></a>
  // For SSG pages, the HTML is already there — nothing to mount.
  // For SSR pages, the data attributes contain the creative info.
  const existing = el.querySelector('.ad-slot__direct-link');
  if (existing) {
    // Already rendered by Astro — just mark filled
    markFilled(el);
    return;
  }

  // SSR fallback: read creative data from data attributes and build the DOM
  const img = el.dataset.directImg;
  const href = el.dataset.directHref;
  const alt = el.dataset.directAlt ?? 'Sponsored';
  const rel = el.dataset.directRel ?? 'nofollow sponsored noopener';

  if (!img || !href) {
    markUnfilled(el);
    return;
  }

  const link = document.createElement('a');
  link.href = href;
  link.rel = rel;
  link.target = '_blank';
  link.className = 'ad-slot__direct-link';

  const image = document.createElement('img');
  image.src = img;
  image.alt = alt;
  image.className = 'ad-slot__direct-img';
  image.loading = 'lazy';

  link.appendChild(image);
  el.appendChild(link);
  markFilled(el);
}
```

**Test:** Mock a direct-provider slot element with creative data attributes. Call `mountDirect()`. Assert: link and image elements are created, `data-fill="filled"` is set.

**File:** `src/features/ads/bootstrap.ts`

---

## Dependency Graph

```
E.1 (schema + config)
  |
  +---> E.2 (rotation.ts — pure logic)
          |
          +---> E.3 (AdSlot.astro — build-time)
          |
          +---> E.4 (bootstrap.ts — runtime)
```

E.1 first (defines types). E.2 depends on E.1 (uses types). E.3 and E.4 can be built in parallel after E.2 — they're independent integration points.

---

## Image Assets for Direct Sponsors

**Location:** `public/images/ads/` (Astro serves from `/images/ads/`)

**Naming convention:** `{sponsor-slug}-{placement}-{width}x{height}.webp`

Examples:
- `razer-hero-300x400.webp`
- `steelseries-sidebar-300x250.webp`
- `hyperx-inline-728x90.webp`

**Requirements:**
- WebP format (best size-to-quality ratio)
- Exact dimensions matching the placement's target size
- Optimized file size (< 100KB for 300x250, < 200KB for 728x90)
- No transparent backgrounds (solid bg matching the creative design)

---

## Checklist

- [ ] E.1 — Sponsor schema (Zod) + config file + loader + tests
- [ ] E.2 — rotation.ts (weighted selection) + FNV-1a hash + tests
- [ ] E.3 — AdSlot.astro direct render path (build-time)
- [ ] E.4 — bootstrap.ts mountDirect() update (runtime)
