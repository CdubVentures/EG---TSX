# Ads Feature

## Purpose
Ad slot rendering for the site. AdSense-only today, expandable to GPT, direct sponsors, and native ads. Architecture follows `CONTENT_LAYOUT_AND_ADS.md` reference design.

## Architecture
- **`config.ts`** — `AD_REGISTRY` (all 22 HBS placements), `ADSENSE_CLIENT`, `AD_LABEL`, Zod schemas, types. `placementType` field: `'inline'` or `'rail'` (default).
- **`resolve.ts`** — `resolveAd(campaign)`, `isAdsEnabled()`, `parseSize()`, `parseFirstSize()`, `parseAllSizes()`, `parseLargestSize()`, `parseSmallestSize()`
- **`bootstrap.ts`** — Client-side ad hydration. Vite-processed module imported from MainLayout. Handles: `eg-ads-on` class, kill switch, lazy IO loading, provider routing (adsense/gpt/direct/native), fill observation, anti-flicker, sticky policy warnings. Exposed as `window.egAds`.
- **`index.ts`** — Public barrel export

## Kill Switch
- **`PUBLIC_ADS_ENABLED=false`** in `.env` — renders placeholders (dashed outline, labels). Bootstrap adds `eg-ads-killed` class.
- **`PUBLIC_ADS_ENABLED=true`** — renders live provider markup. Bootstrap adds `eg-ads-on` class, loads provider scripts, observes fill status.

## IAB Compliance
- **`public/ads.txt`** — AdSense DIRECT authorization line

## Public API (`index.ts`)
- `resolveAd(campaign)` — returns `AdSlotConfig | undefined`
- `getAdsenseClient()` — returns the AdSense publisher client ID
- `isAdsEnabled()` — reads `PUBLIC_ADS_ENABLED` env var
- `parseSize(size)` / `parseFirstSize(sizes)` — parse "WxH" strings
- `parseAllSizes(sizes)` — all valid sizes as `ParsedSize[]`
- `parseLargestSize(sizes)` — largest by area (CLS reservation)
- `parseSmallestSize(sizes)` — smallest by area (mobile reservation)
- `AD_REGISTRY`, `ADSENSE_CLIENT`, `AD_LABEL` — constants

## Components
- `AdSlot.astro` — Universal ad slot. Props: `campaign`, `sticky?`. Renders placeholder (disabled) or live provider markup (enabled). Splits inline vs rail for AdSense format. Includes "Ad" badge, fill-state CSS, responsive size reservations, inline overflow clamp.

## Bootstrap (`bootstrap.ts`)
- **Init:** `init()` — checks kill switch, adds CSS class, mounts all slots
- **Lazy loading:** IntersectionObserver with 200px rootMargin for below-fold
- **Provider routing:** adsense → gpt → direct → native
- **Fill observation:** MutationObserver on `data-adsbygoogle-status` → sets `data-fill` attr
- **Anti-flicker:** `watchAutoSizing()` strips Google-injected `height:auto!important` on inline ads
- **Pure exports:** `parseSizesForGPT()`, `checkStickyPolicy()`, `resolveProviderRoute()` — testable

## Boundary Rules
- This feature imports from `zod` (validation)
- No other feature should import this feature's internals — use `index.ts` barrel
- `bootstrap.ts` is imported directly by MainLayout (client-side script, not via barrel)

## Expansion Path
1. `InlineAd.astro` + `rehype-inline-ads.ts` + `inline-cadence.ts` — Phase 7 (content pages)
2. `RailAd.astro` — Phase 5 (snapshot pages, zone-based sidebar)
3. `NativeCard.astro` — when sponsored cards are needed
4. Prebid.js — post-launch

## Tests
- `tests/placements.test.mjs` — 40 contract tests (schema, lookup, parsing, size functions, placementType, HBS parity)
- `tests/bootstrap.test.mjs` — 17 tests (pure logic: GPT sizes, sticky policy, provider routing, module exports)
- Run: `npx tsx --test src/features/ads/tests/placements.test.mjs src/features/ads/tests/bootstrap.test.mjs`
