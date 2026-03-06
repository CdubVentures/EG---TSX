# Ads Feature Audit

> **Date:** 2026-03-05
> **Scope:** Full audit of `src/features/ads/` against HBS parity, reference design (`CONTENT_LAYOUT_AND_ADS.md`), and industry best practices (IAB, Google, Core Web Vitals, WCAG, privacy).

---

## Table of Contents

1. [Current State Summary](#1-current-state-summary)
2. [HBS Parity Check](#2-hbs-parity-check)
3. [Reference Design Alignment](#3-reference-design-alignment)
4. [Industry Standards Audit](#4-industry-standards-audit)
5. [Findings & Recommendations](#5-findings--recommendations)
6. [Priority Matrix](#6-priority-matrix)

---

## 1. Current State Summary

### Files Implemented

| File | Lines | Purpose |
|------|-------|---------|
| `src/features/ads/config.ts` | 81 | `AD_REGISTRY` (22 HBS placements + 2 GPT), Zod schemas, types |
| `src/features/ads/resolve.ts` | 37 | `resolveAd()`, `isAdsEnabled()`, `parseSize()`, `parseFirstSize()` |
| `src/features/ads/index.ts` | 3 | Public barrel export |
| `src/features/ads/components/AdSlot.astro` | 133 | Universal ad slot component (placeholder + live AdSense) |
| `src/features/ads/tests/placements.test.mjs` | 202 | 23 contract tests |
| `src/features/ads/DOMAIN.md` | 39 | Feature documentation |

### What Works Today

- **Registry:** All 22 HBS placements migrated with exact slot IDs and sizes
- **Kill switch:** `PUBLIC_ADS_ENABLED=false` renders CLS-safe placeholders; `true` renders AdSense `<ins>` tags
- **Zod validation:** Schema checked at module load time
- **CLS prevention:** CSS custom properties (`--ad-w`, `--ad-h`) reserve space
- **Placeholder mode:** Dashed outline + campaign/provider label + size chip
- **Accessibility:** `role="region"` + `aria-label="Advertisement"` on every slot
- **Tests:** 23 passing contract tests covering schema, lookup, parsing, HBS parity
- **Zero client JS:** All resolution happens at build time (Astro SSG)

### What Is Deferred (By Phase)

| Component | Phase | Status |
|-----------|-------|--------|
| `InlineAd.astro` | 7 | Not started |
| `rehype-inline-ads.ts` | 7 | Not started |
| `inline-cadence.ts` | 7 | Not started |
| `RailAd.astro` | 5 | Not started |
| `NativeCard.astro` | Future | Not started |
| `bootstrap.ts` (IntersectionObserver) | Future | Not started |
| `ArticleSidebar.astro` (zone-based) | 5 | Not started |
| Consent management | Future | Not started |
| `ads.txt` | Before launch | Not started |
| GPT/GAM integration | Future | Placeholder only |
| Direct sponsor rotation | Future | Schema ready, no runtime |

---

## 2. HBS Parity Check

### 2.1 Registry Parity (config.ts vs HBS registry.json)

Every HBS placement has been compared field-by-field:

| Placement | adClient | adSlot | sizes | display | Status |
|-----------|----------|--------|-------|---------|--------|
| `inline-ad` | `ca-pub-5013419984370459` | `1051669276` | `970x250,728x90,336x280,300x250,320x100,320x50` | true | MATCH |
| `hero-right` | `ca-pub-5013419984370459` | `6560707323` | `300x400,300x250,300x300` | true | MATCH |
| `hero-left` | `ca-pub-5013419984370459` | `6560707323` | `300x400,300x250,300x300` | true | MATCH |
| `home-rail-top` | `ca-pub-5013419984370459` | `6560707323` | `300x400,300x250,300x300` | true | MATCH |
| `home-rail-body-1` | `ca-pub-5013419984370459` | `6560707323` | `300x400,300x250,300x300` | true | MATCH |
| `home-rail-body-2` | `ca-pub-5013419984370459` | `6560707323` | `300x400,300x250,300x300` | true | MATCH |
| `home-rail-body-3` | `ca-pub-5013419984370459` | `6560707323` | `300x400,300x250,300x300` | true | MATCH |
| `sidebar-right-top` | `ca-pub-5013419984370459` | `6560707323` | `300x250,300x300` | true | MATCH |
| `sidebar-right-mid` | `ca-pub-5013419984370459` | `3735233435` | `300x600,300x250` | true | MATCH |
| `sidebar-right-index2` | `ca-pub-5013419984370459` | `6560707323` | `300x450,300x300,300x250` | true | MATCH |
| `sidebar-right-index3` | `ca-pub-5013419984370459` | `3735233435` | `300x600,300x250` | true | MATCH |
| `sidebar-right-index4` | `ca-pub-5013419984370459` | `3735233435` | `300x600,300x250` | true | MATCH |
| `footer-right` | `ca-pub-5013419984370459` | `3735233435` | `300x300,300x250` | true | MATCH |
| `footer-left` | `ca-pub-5013419984370459` | `6560707323` | `300x300,300x250` | true | MATCH |
| `site-index-rail` | `ca-pub-5013419984370459` | `3735233435` | `300x600,300x250,300x300` | true | MATCH |
| `type-dashboard-rail` | `ca-pub-5013419984370459` | `3735233435` | `300x450,300x300,300x250` | true | MATCH |
| `type-dashboard-rail-1row` | `ca-pub-5013419984370459` | `3735233435` | `300x300,300x250` | true | MATCH |
| `moreof-rail` | `ca-pub-5013419984370459` | `6560707323` | `300x450,300x300,300x250` | true | MATCH |
| `snap-rail-one` | `ca-pub-5013419984370459` | `6560707323` | `300x400,300x250,300x300` | true | MATCH |
| `snap-rail-two` | `ca-pub-5013419984370459` | `3735233435` | `300x600,300x400,300x250,300x300` | true | MATCH |
| `inline-gpt` | N/A | N/A (GPT slot path) | `300x250,336x280,320x100,320x50` | **false** | INTENTIONAL DEVIATION (HBS had `true`, TSX disables by default since GAM not configured) |
| `gpt-sidebar-right-top` | N/A | N/A (GPT slot path) | `300x600,300x250,300x300` | **false** | INTENTIONAL DEVIATION (same reason) |

**Result: 20/22 exact match. 2 intentional deviations (GPT disabled by default — correct since GAM is not configured).**

### 2.2 HBS Campaigns Not Migrated to TSX Registry

HBS `campaigns.json` contains 27 campaigns. TSX `AD_REGISTRY` has 22 placements. The delta:

| HBS Campaign | Provider | HBS Target | TSX Status |
|--------------|----------|------------|------------|
| `site-rail-gpt-top` | gpt | `gpt-sidebar-right-top` | Covered by `gpt-sidebar-right-top` registry entry |
| `inline-direct` | direct | `inline-paragraph` | **NOT in registry** — deferred (direct sponsors) |
| `inline-widget-direct` | direct | `inline-widget` | **NOT in registry** — deferred (direct sponsors) |
| `hero-left-direct` | direct | `hero-left` | **NOT in registry** — deferred (direct sponsors) |
| `sidebar-right-top-direct` | direct | `sidebar-right-top` | **NOT in registry** — deferred (direct sponsors) |
| `sidebar-right-index2-direct` | direct | `sidebar-right-index2` | **NOT in registry** — deferred (direct sponsors) |
| `native-sponsored-card` | native | `native-card-standard` | **NOT in registry** — deferred (native cards) |

**Finding:** 5 direct-sponsor campaigns and 1 native-card campaign from HBS are not in the TSX registry. This is acceptable for now since the schema supports `direct` and `native` providers and `NativeCard.astro` is a planned future component.

### 2.3 HBS Features Not Yet Ported

| HBS Feature | HBS File(s) | TSX Equivalent | Status |
|-------------|-------------|----------------|--------|
| Client-side ad mounting | `ads_bootstrap.js` (277 lines) | `bootstrap.ts` | **Not started** — critical for live ads |
| Inline ad auto-injection | `_ad_injection.js` (300+ lines) | `rehype-inline-ads.ts` | **Not started** — Phase 7 |
| Inline ad device hydration | `ads_inline_bootstrap.js` (150+ lines) | Tailwind responsive classes | **Designed** — not implemented |
| Zone-based sidebar | `sidebars.handlebars` + JS | `ArticleSidebar.astro` | **Not started** — Phase 5 |
| Direct sponsor rotation | `direct.json` + mount logic | `config.ts` (schema ready) | **Not started** |
| Native sponsored cards | `native.json` + template | `NativeCard.astro` | **Not started** |
| Ad fill detection | `observeAdSenseFill()` in bootstrap | N/A | **Not started** |
| Placeholder query-param mode | `?adsPlaceholder=1` middleware | N/A | **Not implemented** — lower priority |
| AdSense fill clamp CSS | `widget_ads.css` overflow clamp | N/A | **Not implemented** — needed when ads go live |

---

## 3. Reference Design Alignment

Checked against `CONTENT_LAYOUT_AND_ADS.md` (952 lines):

| Section | Reference Design | Current Implementation | Status |
|---------|-----------------|----------------------|--------|
| 1. Page layout model | Persistent sidebar, CSS grid | Not implemented yet | Phase 5 |
| 2. Sticky zones | Zone-based `position: sticky` | Not implemented yet | Phase 5 |
| 3. Sidebar config | Per-content-type zone configs | Not implemented yet | Phase 5 |
| 4. Inline ads | rehype plugin + `<InlineAd />` + cadence config | Not implemented yet | Phase 7 |
| 5.1 Bootstrap script | IntersectionObserver lazy load | Not implemented yet | Pre-launch |
| 5.2 Config resolution | `AD_REGISTRY` single source of truth | **DONE** | Complete |
| 5.3 Kill switch | `PUBLIC_ADS_ENABLED` env var | **DONE** | Complete |
| 6. End-to-end flow | Author writes MDX → build → hydrate | Partially done (config + component) | Phases 5-7 |
| 8. File map | 14 files listed | 6 of 14 created | In progress |
| 10. HBS source map | 15 HBS files → TSX replacements | 3 of 15 replaced | In progress |

**Result: Config layer (5.2, 5.3) is complete. Component layer (AdSlot) is complete. Layout layer (1-3) and content layer (4) are correctly deferred to their respective phases.**

---

## 4. Industry Standards Audit

### 4.1 Core Web Vitals

| Requirement | Standard | Current State | Grade |
|-------------|----------|--------------|-------|
| CLS < 0.1 | Google | CSS `min-height`/`min-width` via `--ad-w`/`--ad-h` custom properties | **A** — Size reservation is correct |
| CLS: reserve for correct size | Google GPT docs | Reserves for **first** listed size (matches HBS `policy.json` `reserve.strategy: "first"`) | **A** — Matches HBS behavior |
| Responsive size reservation | Best practice | Only reserves one size, no media-query breakpoints | **B-** — Needs responsive reservations for mobile |
| Ad scripts async | Google | No ad scripts loaded yet (deferred) | **N/A** — Must be async when added |
| No JS-based size reservation | Google GPT docs | Correct — CSS only | **A** |
| Lazy loading below-fold | Best practice | IntersectionObserver planned in `bootstrap.ts` | **N/A** — Not yet implemented |
| Above-fold ads load immediately | Best practice | Not yet implemented | **N/A** |

**CLS Finding:** The `parseFirstSize()` strategy reserves space based on the first size in the list. For most placements this is the largest size (e.g., `300x400` for home-rail, `970x250` for inline, `300x600` for sidebar-right-mid). This is good — it prevents layout shift from larger creatives. However, `sidebar-right-top` lists `300x250` first but could serve `300x300`, causing a 50px shift. **Recommendation:** Consider reserving for the **largest** size in each list, or at minimum audit each placement to ensure the first size is the largest.

### 4.2 IAB Standards

| Requirement | Standard | Current State | Grade |
|-------------|----------|--------------|-------|
| Standard ad sizes | IAB New Ad Portfolio | All sizes are IAB-standard (300x250, 300x600, 728x90, 970x250, 320x50, 320x100, 336x280) | **A** |
| Ad labeling | IAB + Google | Placeholder shows campaign/provider label. Live mode: no visible "Advertisement" text | **C** — Live ads need visible label |
| Viewability (50% pixels, 1s) | MRC/IAB | No viewability tracking | **N/A** — handled by AdSense/GAM automatically |
| File weight limits | IAB | AdSense manages creative weight | **N/A** — not publisher's concern |

**Labeling Finding:** The placeholder mode displays campaign + provider info (great for dev). But when `PUBLIC_ADS_ENABLED=true`, the live AdSense `<ins>` tag renders with no visible "Advertisement" label. Google AdSense policy and IAB standards require ads to be clearly labeled. **Recommendation:** Add a visible "Advertisement" text label above or adjacent to every live ad slot.

### 4.3 Accessibility (WCAG 2.2)

| Requirement | Standard | Current State | Grade |
|-------------|----------|--------------|-------|
| Landmark role | WCAG | `role="region"` with `aria-label="Advertisement"` | **B+** — Works, but `role="complementary"` or `<aside>` is more semantically correct for ads |
| Unique labels | WCAG | All slots use identical `aria-label="Advertisement"` | **C** — Multiple landmarks with identical labels confuses screen readers |
| Skip links | WCAG | Not implemented | **C** — Needed when multiple ad blocks exist on a page |
| iframe titles | WCAG | AdSense handles its own iframes | **N/A** |
| Focus management | WCAG | Ads don't steal focus (static HTML) | **A** |
| Motion/animation | WCAG 2.3.1 | No animation in ad containers | **A** |
| Label contrast | WCAG | Placeholder label `#dbe2ea` on semi-transparent stripe — needs contrast check | **B** — Verify 4.5:1 ratio |

**Accessibility Finding:** Using `role="region"` is acceptable but not optimal. The semantically correct role for ad containers is either `role="complementary"` or using native `<aside>` elements. Additionally, all slots share the same `aria-label="Advertisement"` — a page with 5 ads creates 5 identically-labeled landmarks, which is unhelpful for screen reader navigation. **Recommendation:** Include the campaign name in the aria-label (e.g., `aria-label="Advertisement: sidebar-right-top"`) or use a sequential number.

### 4.4 Google AdSense Compliance

| Requirement | Policy | Current State | Grade |
|-------------|--------|--------------|-------|
| No auto-refresh | AdSense TOS | No refresh logic exists | **A** |
| Content exceeds ads | AdSense TOS | Home page has 2 ad slots + content — fine | **A** |
| No encouraging clicks | AdSense TOS | No click incentives | **A** |
| No ads in pop-ups | AdSense TOS | No pop-ups | **A** |
| `data-ad-client` correct | AdSense | `ca-pub-5013419984370459` matches HBS | **A** |
| `data-ad-format="auto"` | AdSense best practice | Present on live AdSense slots | **A** |
| `data-full-width-responsive="true"` | AdSense best practice | Present | **A** |
| Sticky ads policy | AdSense | `sticky` prop exists but no sticky AdSense logic | **A** — AdSense cannot be sticky (HBS `policy.json` `sticky.disallow: ["adsense"]`) |

**AdSense Finding:** The live AdSense markup is correctly structured. The `sticky` prop on `AdSlot.astro` is declared but not wired — this is fine since AdSense ads cannot be sticky per Google policy. When GPT or direct sponsors are added, the sticky prop will become active.

### 4.5 Privacy & Consent

| Requirement | Regulation | Current State | Grade |
|-------------|-----------|--------------|-------|
| Google Consent Mode v2 | GDPR (EEA/UK) | **Not implemented** | **F** — Required before ads go live if serving EEA/UK users |
| CMP (Consent Management Platform) | GDPR/ePrivacy | **Not implemented** | **F** — Required before ads go live |
| CCPA "Do Not Sell" link | CCPA/CPRA (California) | **Not implemented** | **D** — Needed in privacy policy before launch |
| Privacy policy | All | Not in scope of ads feature | **N/A** — Site-level concern |
| Consent fires before ad scripts | Best practice | No ad scripts yet | **N/A** — Must be enforced when bootstrap.ts is built |

**Privacy Finding:** This is the most critical gap. Google requires Consent Mode v2 for all publishers using AdSense/AdX who serve users in the EEA, UK, or Switzerland. Non-compliance risks AdSense account suspension. Since the site likely has international visitors (gaming hardware is global), this must be implemented before `PUBLIC_ADS_ENABLED=true`.

### 4.6 ads.txt

| Requirement | Standard | Current State | Grade |
|-------------|----------|--------------|-------|
| `ads.txt` at domain root | IAB Tech Lab | **Not present** in `public/` | **F** — Required before ads go live |

**ads.txt Finding:** Without `ads.txt`, many SSPs and DSPs will not bid on inventory, and Google shows a dashboard warning. The file is trivial to create.

**Minimum required content for `public/ads.txt`:**
```
google.com, pub-5013419984370459, DIRECT, f08c47fec0942fa0
```

### 4.7 Performance

| Requirement | Best Practice | Current State | Grade |
|-------------|-------------|--------------|-------|
| Zero JS in current build | Best practice | **Yes** — all build-time resolution | **A+** |
| IntersectionObserver lazy loading | Best practice | Planned in bootstrap.ts design | **N/A** |
| Above-fold ads load immediately | Best practice | Not yet wired | **N/A** |
| No synchronous script tags | Google | No scripts loaded yet | **N/A** — Must be enforced |
| Placeholder while loading | UX best practice | Placeholder mode exists and is well-designed | **A** |

### 4.8 Ad Refresh / Sticky

| Requirement | Policy | Current State | Grade |
|-------------|--------|--------------|-------|
| No AdSense auto-refresh | Google TOS | Correct — no refresh logic | **A** |
| Sticky ads ≤30% viewport | Google policy | Not implemented yet | **N/A** — Must be enforced when sticky ads are added |
| Sticky ads have close button | Google policy | Not implemented yet | **N/A** |
| Max 1 vertical + 1 horizontal sticky | Google policy | Not implemented yet | **N/A** |

### 4.9 Header Bidding

| Consideration | Assessment |
|---------------|-----------|
| Current traffic level | Unknown — evaluate at launch |
| Prebid.js consideration | Premature for pre-launch. Revisit after 3 months of live traffic data |
| Ad Manager (GAM) | GPT slots are placeholders with dummy paths (`/1234567/...`). Configure GAM when ready to move beyond AdSense-only |
| Revenue optimization path | AdSense only → AdSense + GAM → GAM + Prebid.js (3-5 SSPs) |

---

## 5. Findings & Recommendations

### CRITICAL (Must fix before ads go live)

#### F1: No `ads.txt` file
- **Risk:** SSPs/DSPs won't bid; Google shows dashboard warning; potential revenue loss
- **Fix:** Create `public/ads.txt` with the AdSense publisher entry
- **Effort:** 5 minutes
- **Phase:** Pre-launch

#### F2: No Google Consent Mode v2
- **Risk:** AdSense account suspension if serving EEA/UK/Swiss users without consent signals
- **Fix:** Implement consent mode defaults in `<head>` before any Google scripts; integrate a Google-certified CMP (Cookiebot, OneTrust, etc.)
- **Effort:** Medium (CMP selection + integration)
- **Phase:** Before `PUBLIC_ADS_ENABLED=true`

#### F3: No `bootstrap.ts` (ad hydration script)
- **Risk:** Live ads cannot actually load without client-side AdSense/GPT script injection
- **Fix:** Build `bootstrap.ts` per reference design Section 5.1 — IntersectionObserver for lazy loading, immediate load for above-fold
- **Effort:** Medium
- **Phase:** Before `PUBLIC_ADS_ENABLED=true`

#### F4: No visible "Advertisement" label on live ads
- **Risk:** Violates Google AdSense policy and IAB labeling standards
- **Fix:** Add a visible `<span>` with "Advertisement" text above each live ad slot
- **Effort:** Small (CSS + HTML change in AdSlot.astro)
- **Phase:** Before `PUBLIC_ADS_ENABLED=true`

### HIGH (Should fix before launch)

#### F5: CLS — `parseFirstSize()` doesn't always reserve the largest size
- **Risk:** Slots like `sidebar-right-top` (sizes: `300x250,300x300`) reserve 300x250 but could serve 300x300, causing a 50px layout shift
- **Fix:** Add a `parseLargestSize()` function and use it for CLS reservation, or reorder size lists so the largest is always first
- **Effort:** Small
- **Phase:** Before launch

#### F6: Accessibility — identical `aria-label` on all ad slots
- **Risk:** Screen readers announce 5+ landmarks all named "Advertisement" — users can't distinguish them
- **Fix:** Include campaign or position info: `aria-label="Advertisement: sidebar right"` or use sequential numbering
- **Effort:** Small (template change in AdSlot.astro)
- **Phase:** Before launch

#### F7: Accessibility — `role="region"` instead of `<aside>` or `role="complementary"`
- **Risk:** `role="region"` is not semantically wrong but `<aside>` or `role="complementary"` is the recommended WAI-ARIA pattern for supplementary content like ads
- **Fix:** Change the `<div>` to `<aside>` (when appropriate — rail-level wrappers) or use `role="complementary"`
- **Effort:** Small
- **Phase:** Before launch

#### F8: No responsive size reservation
- **Risk:** Desktop-sized ad boxes on mobile (e.g., reserving 970x250 on a 375px screen) cause overflow or wasted whitespace
- **Fix:** Use CSS media queries or container queries to adjust `--ad-w`/`--ad-h` per breakpoint. The inline-ad slot (`970x250` first) should reserve `320x100` or `320x50` on mobile.
- **Effort:** Medium
- **Phase:** Before launch

### MEDIUM (Should address during feature build-out)

#### F9: AdSense fill overflow clamp not ported
- **Risk:** AdSense can mutate ad container dimensions after fill. HBS had CSS to clamp `<ins class="adsbygoogle">` and `<div id="aswift_*_host">` overflow. Without this, ads may overflow their containers.
- **Fix:** Port the overflow clamp CSS from HBS `widget_ads.css`
- **Effort:** Small
- **Phase:** When bootstrap.ts is built

#### F10: No ad fill state tracking
- **Risk:** Can't detect unfilled slots for fallback content (house ads, content recommendations)
- **Fix:** Port `observeAdSenseFill()` pattern from HBS — watch for `data-ad-status` attribute on `<ins>` element
- **Effort:** Medium
- **Phase:** When bootstrap.ts is built

#### F11: Direct sponsor campaigns not in registry
- **Risk:** 5 HBS direct-sponsor campaigns won't resolve. No impact now (no direct sponsors active), but schema support is ready.
- **Fix:** Add campaigns when direct sponsors are activated
- **Effort:** Small (config entries only)
- **Phase:** When direct sponsors are needed

#### F12: GPT slot paths are dummy values
- **Risk:** `/1234567/site/inline_gpt` and `/1234567/site/rr_top` are placeholder paths
- **Fix:** Replace with real GAM line item paths when GAM is configured
- **Effort:** Small
- **Phase:** When GAM is configured

### LOW (Nice-to-have / future optimization)

#### F13: No query-param placeholder mode
- HBS supported `?adsPlaceholder=1` for testing. Useful for QA but not critical.
- **Phase:** Phase 11 (QA)

#### F14: No skip-to-content link
- WCAG best practice for pages with multiple ad blocks.
- **Phase:** Phase 4 (global shell)

#### F15: Consider Prebid.js / header bidding
- Not appropriate pre-launch. Revisit when traffic data is available (typically worthwhile at 100k+ monthly pageviews).
- **Phase:** Post-launch optimization

#### F16: Consider Google Ad Manager (GAM) unified auction
- AdSense alone leaves revenue on the table. GAM allows AdSense + AdX + header bidding to compete in a unified auction.
- **Phase:** Post-launch optimization

---

## 6. Priority Matrix

```
                    IMPACT
                    High                    Low
              ┌─────────────────────┬─────────────────────┐
        Low   │ F1 ads.txt          │ F13 query-param     │
              │ F4 ad labels        │   placeholder       │
   EFFORT     │ F5 CLS largest size │ F14 skip link       │
              │ F6 aria-labels      │                     │
              │ F7 aside role       │                     │
              ├─────────────────────┼─────────────────────┤
        High  │ F2 Consent Mode v2  │ F15 Prebid.js       │
              │ F3 bootstrap.ts     │ F16 GAM unified     │
              │ F8 responsive sizes │   auction            │
              │ F9 overflow clamp   │                     │
              │ F10 fill tracking   │                     │
              └─────────────────────┴─────────────────────┘
```

### Recommended Action Order

**Immediate (5-minute wins):**
1. F1 — Create `public/ads.txt`
2. F4 — Add "Advertisement" label to live ad markup
3. F6 — Differentiate aria-labels per slot

**Before ads go live:**
4. F3 — Build `bootstrap.ts` (client-side ad loading)
5. F2 — Implement Consent Mode v2 + CMP
6. F5 — Fix CLS reservation to use largest size
7. F8 — Add responsive size reservations
8. F9 — Port AdSense overflow clamp CSS

**During normal phase work:**
9. F7 — Semantic `<aside>` wrapper (Phase 5, when sidebar is built)
10. F10 — Ad fill detection (with bootstrap.ts)
11. F11 — Direct sponsor campaigns (when needed)
12. F12 — GPT slot paths (when GAM configured)

**Post-launch:**
13. F14 — Skip-to-content link
14. F15 — Evaluate Prebid.js
15. F16 — Evaluate GAM

---

## Appendix A: HBS Deep-Read — Nuances Not Yet Captured in TSX

After reading all 24 HBS ad files line-by-line, these are the behavioral nuances that the TSX implementation will need to account for when building the remaining components.

### A.1 HBS `ads_bootstrap.js` — Key Behaviors to Port

| HBS Behavior | Lines | TSX `bootstrap.ts` Must Replicate |
|-------------|-------|----------------------------------|
| **Size reservation strategy** | `chooseSize()` reads `policy.reserve.strategy` — defaults to `"largest"`, not `"first"` | TSX `AdSlot.astro` uses `parseFirstSize()` (first). HBS kill-switch forces `"largest"`. **Mismatch — TSX should match HBS default of `"largest"`.** |
| **Inline vs rail detection** | `isInlinePlacement()` checks `.closest('.article-inline-ad')` OR campaign prefix `/^inline-/` | TSX needs same dual detection for InlineAd vs RailAd rendering |
| **Inline ads are fluid** | `mountAdSense()` sets `data-ad-format="fluid"` + `data-ad-layout="in-article"` for inline slots | TSX `AdSlot.astro` currently uses `data-ad-format="auto"` for ALL slots — **must differentiate inline vs rail** |
| **Rail ads are fixed-size** | `mountAdSense()` sets `display: inline-block` + explicit `width`/`height` for non-inline | TSX `AdSlot.astro` must split rendering by placement type |
| **AdSense fill observation** | `observeAdSenseFill()` — MutationObserver on `<ins>` watching `data-adsbygoogle-status` and `data-ad-status` | Critical for unfilled ad collapse and anti-flicker |
| **AdSense auto-sizing strip** | `stripAutoSizing()` — removes Google's injected `height:auto !important` / `width:100%` from inline wrappers | Without this, inline ads overflow or distort layout |
| **Kill-switch CSS class** | `eg-ads-killed` on `<html>` when kill-switch active | TSX has `PUBLIC_ADS_ENABLED` but no CSS class on `<html>` |
| **`eg-ads-on` CSS class** | Added to `<html>` on bootstrap — gates ALL ad CSS visibility | TSX placeholder CSS doesn't use this gate |
| **Campaign alias resolution** | `CAMPAIGN_ALIAS` maps `inline-adsense` → `inline-ad` | TSX doesn't need this (no legacy campaigns) but good to note |
| **`whenEligible()` deferred mount** | Uses ResizeObserver + IntersectionObserver + MutationObserver + rAF loop to wait until slot is visible + ≥32px wide | Critical for inline ads that start hidden/collapsed |
| **Sticky policy warning** | Console warns if AdSense + `data-sticky="true"` | TSX should enforce this in component props |
| **Provider routing** | `mountSlot()` → `resolveProviderAndMeta()` → route to `mountGPT/mountAdSense/mountDirect/mountNative` | TSX `bootstrap.ts` needs same 4-way routing |

### A.2 HBS `ads_inline_bootstrap.js` — Inline-Specific Behaviors

| HBS Behavior | TSX Implication |
|-------------|----------------|
| **Device gating via JS** | `isMobile()` checks `matchMedia('(max-width: 1149.98px)')` — TSX replaces with Tailwind responsive classes (designed, correct) |
| **Resize listener** | 150ms debounced resize re-runs `hydrateSSR()` — TSX doesn't need (Tailwind handles responsive) |
| **Illegal nest detection** | Hides inline ads nested inside `.article-note`, `.article-block`, `pre`, `code` | TSX rehype plugin should skip these containers |
| **`window.EG_INLINE_ADS`** | Exposed for manual re-hydration — TSX equivalent not needed (SSG) |

### A.3 HBS `_ad_injection.js` — Auto-Injection Nuances

| HBS Behavior | TSX `rehype-inline-ads.ts` Must Replicate |
|-------------|------------------------------------------|
| **75-word paragraph run** | Counts words across consecutive H1-H5 + P.article-p; triggers anchor at ≥75 words | TSX rehype plugin should count HAST text nodes similarly |
| **Manual + auto coexistence** | Manual `<InlineAd />` consumes cadence slot — auto-injection skips nearby | Reference design Section 4.3 covers this |
| **Word scaling** | `desktopWordsPerAd: 400`, `mobileWordsPerAd: 300`, `minFirstAdWords: 150` — clamps max ads by content length | Reference design `inline-cadence.ts` has these values |
| **Per-section scope** | Only injects inside `div.article-section > div.article-main` | TSX doesn't have this section structure (single content column) — simpler |
| **DOM backend fallback** | linkedom → jsdom → happy-dom | TSX doesn't need (operates on HAST, not HTML string) |

### A.4 HBS `widget_ads.css` — CSS That Must Port to TSX

| CSS Pattern | Purpose | TSX Status |
|-------------|---------|------------|
| `.eg-ads-on` gate | All ad visibility requires this class on `<html>` | **Not ported** — TSX uses `data-placeholder` instead |
| `Ad.` badge behind live ads | Centered circle with "Ad" text behind every live slot | **Not ported** — this is the missing "Advertisement" label (Finding F4) |
| AdSense fill states | `data-fill="pending\|filled\|unfilled"` CSS rules | **Not ported** — needed with bootstrap.ts |
| AdSense anti-flicker | `visibility: hidden; opacity: 0` until `data-fill="filled"` | **Not ported** — prevents white flash before ad renders |
| Inline overflow clamp | `ins.adsbygoogle`, `div[id^="aswift_"][id$="_host"]`, `iframe[id^="aswift_"]` all clamped to `width: 100% !important` | **Not ported** — critical for inline ads (Finding F9) |
| Unfilled ad hide | `ins.adsbygoogle[data-ad-status="unfilled"]` → `display: none !important` | **Not ported** — prevents empty ad slot from showing blank space |
| Inline `aspect-ratio` | `aspect-ratio: 970 / 250` for pending inline ads | **Not ported** — better CLS for inline slots |

### A.5 HBS `direct.json` + `native.json` — Data Structures

**Direct sponsors** use a `creatives[]` array with `weight` (rotation percentage) and `start`/`end` date ranges. TSX `adSlotConfigSchema` has `img`/`href`/`width`/`height` fields but no `creatives[]` array, no `weight`, and no date filtering. When direct sponsors are activated, the schema needs:

```typescript
// Future addition to config.ts
interface DirectCreative {
  img: string;
  href: string;
  width: number;
  height: number;
  weight: number;     // rotation percentage (0-100)
  start: string;      // ISO date
  end: string;        // ISO date
}
```

**Native cards** use a `card-v1` schema with `title`, `blurb`, `img`, `href` — similar to product cards. TSX `NativeCard.astro` can use this directly.

### A.6 Updated Finding: F5 is More Critical Than Initially Stated

HBS `ads_bootstrap.js` defaults `chooseSize()` to `"largest"` strategy (line 370-374). The TSX `AdSlot.astro` uses `parseFirstSize()` which takes the first listed size. For most placements these happen to be the same (the first listed size IS the largest). But HBS explicitly sorts by area (`w*h`) and picks the biggest. **This is the correct approach for CLS prevention** — reserving for the largest possible creative eliminates shift entirely.

**Specific mismatches where first ≠ largest:**
- `sidebar-right-top`: first=`300x250` (75,000px²), largest=`300x300` (90,000px²) — **50px shift possible**
- `footer-right`: first=`300x300`, largest=`300x300` — OK (same)
- `footer-left`: first=`300x300`, largest=`300x300` — OK (same)
- All others: first size IS the largest — no mismatch

Only `sidebar-right-top` has a real risk, but the pattern should still be `parseLargestSize()` for correctness.

---

## Appendix B: AdSense Slot ID Reference (unchanged)

| Slot ID | HBS Note | Used By |
|---------|----------|---------|
| `1051669276` | In-article/fluid | `inline-ad` |
| `6560707323` | Square responsive display | Home rail, hero, sidebar-right-top, sidebar-right-index2, footer-left, moreof-rail, snap-rail-one |
| `3735233435` | Vertical responsive display | sidebar-right-mid, sidebar-right-index3/4, footer-right, site-index-rail, dashboard rails, snap-rail-two |

## Appendix C: HBS → TSX Migration Coverage

| HBS File | Lines | TSX Replacement | Migrated? |
|----------|-------|-----------------|-----------|
| `config/ads/registry.json` | 156 | `config.ts` AD_REGISTRY | YES |
| `config/ads/policy.json` | 17 | `resolve.ts` isAdsEnabled() + env var | YES |
| `config/ads/campaigns.json` | 116 | Eliminated (direct lookup) | YES |
| `config/ads/direct.json` | 125 | Deferred — needs `creatives[]` with weight/dates | NO |
| `config/ads/native.json` | 23 | Deferred — needs `NativeCard.astro` | NO |
| `routes/ads.routes.js` | 168 | Eliminated (static imports, no API endpoints needed) | YES |
| `routes/_ad_injection.js` | 776 | `rehype-inline-ads.ts` (Phase 7) | NO |
| `public/js/ads_bootstrap.js` | 691 | `bootstrap.ts` (pre-launch) — biggest gap | NO |
| `public/js/ads_inline_bootstrap.js` | 169 | Tailwind responsive classes (no JS needed) | DESIGNED |
| `views/partials/ads/adsense.handlebars` | ~20 | `AdSlot.astro` (AdSense path) | YES |
| `views/partials/ads/gpt.handlebars` | ~15 | `AdSlot.astro` (GPT path — not wired yet) | PARTIAL |
| `views/partials/ads/direct.handlebars` | ~20 | `AdSlot.astro` (direct path — not wired yet) | NO |
| `views/partials/ads/native-card.handlebars` | ~30 | `NativeCard.astro` (planned) | NO |
| `views/partials/ads/inline-manual.handlebars` | ~25 | `InlineAd.astro` (Phase 7) | NO |
| `views/partials/ads/slot.handlebars` | ~15 | `AdSlot.astro` | YES |
| `views/partials/ads/rail.handlebars` | ~10 | `RailAd.astro` (Phase 5) | NO |
| `views/partials/ads/rail-right-home.handlebars` | ~15 | `index.astro` (inline AdSlot) | YES |
| `views/partials/ads/rail-right-snap-one.handlebars` | ~15 | `RailAd.astro` (Phase 5) | NO |
| `views/partials/ads/rail-right-snap-two.handlebars` | ~20 | `RailAd.astro` (Phase 5) | NO |
| `views/partials/ads/label.handlebars` | ~5 | Missing — see Finding F4 | NO |
| `public/css/widget_ads.css` | 525 | `AdSlot.astro` `<style>` block | PARTIAL (placeholder only, ~30% of CSS ported) |
| `public/css/partial_ad_bar.css` | ~50 | Not needed (bulletin bar is not an ad) | N/A |

**Overall migration: ~35% complete by file count, ~40% by importance weight.**
- Config layer: DONE (3/5 config files — remaining 2 are direct/native, not active)
- Component layer: 1 of 4 components built (AdSlot only)
- Client-side layer: NOT STARTED (bootstrap.ts is the biggest remaining piece)
- CSS layer: ~30% ported (placeholder styling only; live ad CSS, fill states, overflow clamps missing)

## Appendix D: Industry Standards Quick Reference

| Standard | Body | Key Requirement | TSX Compliance |
|----------|------|----------------|----------------|
| ads.txt | IAB Tech Lab | Declare authorized sellers at domain root | NOT COMPLIANT |
| Consent Mode v2 | Google/GDPR | 4 consent signals before ad scripts | NOT COMPLIANT |
| CLS < 0.1 | Google Core Web Vitals | Reserve ad space with CSS | COMPLIANT |
| Ad labeling | IAB + Google | Visible "Advertisement" text | NOT COMPLIANT (live mode) |
| WCAG 2.2 landmarks | W3C | Semantic roles + unique labels for ad regions | PARTIALLY COMPLIANT |
| Sticky ad limits | Google | ≤30% viewport, close button, max 1 per axis | N/A (not yet implemented) |
| No AdSense refresh | Google TOS | No auto-refresh of AdSense units | COMPLIANT |
| Async ad scripts | Google + best practice | All ad JS loaded async | N/A (no scripts yet) |
| Standard ad sizes | IAB New Ad Portfolio | Use IAB-standard dimensions | COMPLIANT |
