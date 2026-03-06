# Phase F: Live Testing & Launch Readiness

> **Parent plan:** `../../AD-STACK-PLAN.md`
> **Status:** NOT STARTED
> **Prerequisite:** Phases A, B, D complete. Phase E nice-to-have but not blocking.
> **Effort:** Medium — mostly testing and bug fixing, minimal new code
> **Scope:** End-to-end verification with real ad networks, CLS audit, mobile testing, policy compliance

---

## Overview

This phase is the final gate before flipping `PUBLIC_ADS_ENABLED=true` in production. Every test here is designed to catch issues that would cause:

- **Revenue loss** — wasted impressions, unfilled slots, policy violations
- **UX degradation** — layout shifts, slow loads, broken mobile, hydration errors
- **Policy suspension** — Google AdSense account suspension for non-compliance
- **Legal exposure** — serving personalized ads without consent (GDPR)

**No new features are built in this phase.** It's pure verification, bug fixing, and hardening.

---

## F.1 — Staging Environment Test

**Goal:** Full ad stack verification in a staging/preview deployment.

**Setup:**
1. Deploy to staging (Netlify preview, Vercel preview, or local `astro build && astro preview`)
2. Set `PUBLIC_ADS_ENABLED=true` in staging `.env`
3. Keep production at `PUBLIC_ADS_ENABLED=false` until all F-phase tests pass

**Test matrix — every page type:**

| Page Type | Test URL | Expected Placements |
|-----------|----------|---------------------|
| Home | `/` | hero-right, hero-left, home-rail-top, home-rail-body-1/2/3, footer-left/right |
| Hub (Mouse) | `/mouse/` | type-dashboard-rail, type-dashboard-rail-1row, footer-left/right |
| Snapshot | `/mouse/razer-viper-v3-pro/` | moreof-rail, snap-rail-one, snap-rail-two, footer-left/right |
| Review | `/reviews/razer-viper-v3-pro-review/` | sidebar-right-top, sidebar-right-mid, inline-ad (auto), footer-left/right |
| Guide | `/guides/best-gaming-mouse-2026/` | sidebar-right-top, sidebar-right-mid, inline-ad (auto), footer-left/right |
| News | `/news/example-news/` | sidebar-right-top, inline-ad (auto or none if short), footer-left/right |
| Index | `/reviews/` | site-index-rail, sidebar-right-index2/3/4, footer-left/right |

**Per-page verification checklist:**

- [ ] AdSense script loaded (Network tab → `adsbygoogle.js` present)
- [ ] Slots render ads OR production placeholders (no dev dashed outlines)
- [ ] `data-fill` attribute changes from `pending` to `filled` or `unfilled`
- [ ] Filled slots show ad creative, `ad-label` hidden
- [ ] Unfilled rail slots collapse (`display: none`)
- [ ] Unfilled inline slots zero-height collapse
- [ ] No JavaScript errors in Console
- [ ] No hydration mismatch errors (check for React warnings)
- [ ] Anti-flicker: no visible flash of placeholder → ad transition
- [ ] `watchAutoSizing()` strips any Google-injected `height:auto!important`

**File:** No code changes — test-only.

---

## F.2 — CLS Verification

**Goal:** Cumulative Layout Shift score < 0.1 on all page types with ads enabled.

**Tools:**
- Chrome DevTools → Lighthouse → Performance
- Chrome DevTools → Performance → Layout Shift Regions (enable)
- `web-vitals` library (if installed) or Web Vitals Chrome extension
- Google PageSpeed Insights (external URL if staging is publicly accessible)

**Test matrix:**

| Page Type | Target CLS | Measurement |
|-----------|-----------|-------------|
| Home | < 0.1 | Lighthouse mobile + desktop |
| Hub | < 0.1 | Lighthouse mobile + desktop |
| Snapshot | < 0.1 | Lighthouse mobile + desktop |
| Review (long) | < 0.1 | Lighthouse mobile + desktop |
| Index | < 0.1 | Lighthouse mobile + desktop |

**CLS debugging — what to check:**

1. **Rail ads:** Do they reserve space before fill? Check that `min-height: var(--ad-h)` is applied.
2. **Inline ads:** Do they reserve space? Check `--ad-w` and `--ad-h` CSS vars are set.
3. **Font loading:** Does the identity font cause FOUT that shifts ad-adjacent content?
4. **Image loading:** Do product images above ads cause shifts as they load?
5. **Ad fill:** Does a filled ad match the reserved size? If AdSense serves a smaller creative, does the slot shrink (shift)?

**CLS fix patterns:**
- If rail ad causes shift → verify `parseLargestSize()` is setting correct `--ad-w/--ad-h`
- If inline ad causes shift → verify `--ad-w-sm/--ad-h-sm` responsive vars are set
- If AdSense serves smaller creative → verify `.ad-slot[data-fill="filled"]` CSS doesn't override `min-height`
- If shift happens on unfilled collapse → verify `.ad-slot[data-fill="unfilled"]` transitions are instant (no animation)

**File:** No code changes — test-only. Fixes tracked as bugs.

---

## F.3 — Mobile Device Testing

**Goal:** Verify ad behavior on real mobile devices and responsive viewports.

**Devices to test:**
- iPhone (Safari) — at least one modern iPhone
- Android (Chrome) — at least one mid-range Android
- Chrome DevTools → Device Toolbar → iPhone 12 Pro, Galaxy S21, iPad

**Test checklist:**

### Layout
- [ ] Sidebar ads NOT visible on mobile (sidebar collapses)
- [ ] Sidebar ad scripts NOT loaded on mobile (offsetParent guard from A.3)
- [ ] Inline ads render at responsive sizes (`--ad-w-sm/--ad-h-sm`)
- [ ] No horizontal overflow from ad creatives (check `max-width: 100%`)
- [ ] No ad extends beyond viewport width
- [ ] Footer ads stack vertically on narrow screens (if applicable)

### Consent
- [ ] Consent banner renders correctly on mobile (not cut off, buttons tappable)
- [ ] Banner doesn't cover navigation
- [ ] "Accept" / "Reject" buttons are large enough to tap (min 44x44px)

### Inline Ads (Article Pages)
- [ ] Auto-injected inline ads appear at correct cadence (mobile cadence, not desktop)
- [ ] Inline ads are centered in the content column
- [ ] No inline ad appears before the first heading
- [ ] No inline ad appears inside a code block, table, or MDX component

### Performance
- [ ] Page loads within 3 seconds on 4G throttling
- [ ] Ad scripts don't block first paint (loaded async)
- [ ] No janky scrolling caused by ad lazy loading

### Edge Cases
- [ ] Rotate device landscape → ads reflow correctly
- [ ] Rotate back portrait → ads return to mobile sizes
- [ ] Scroll very fast → lazy-loaded ads mount correctly (no missed slots)
- [ ] Pull-to-refresh (mobile Safari) → ads reinitialize

**File:** No code changes — test-only. Fixes tracked as bugs.

---

## F.4 — Ad Policy Compliance Check

**Goal:** Manual review against Google AdSense program policies.

**Critical policies (account suspension risk if violated):**

### Content-to-Ad Ratio
- [ ] Every page has MORE content than ads
- [ ] No page is "mostly ads" — content must be the primary purpose
- [ ] Article pages: inline ad count is proportional to article length (word-scaling handles this)

### Ad Labeling
- [ ] "Ad" label visible on all slots during load (before fill)
- [ ] No misleading labels (don't label non-ad content as "Ad")
- [ ] After fill, Google's own "AdChoices" badge is visible

### Ad Placement
- [ ] No more than 1 ad above the fold that pushes content below the fold
- [ ] No ads in pop-ups, modals, or interstitials
- [ ] No ads that overlay content
- [ ] No ads adjacent to interactive elements where accidental clicks are likely
- [ ] No ads inside navigation menus

### Sticky Ads
- [ ] No sticky AdSense ads (only GPT/direct allowed)
- [ ] If sticky ads exist: ≤ 30% viewport height, have close button, max 1 per axis

### Programmatic Behavior
- [ ] No auto-refresh on AdSense slots (GPT-only for refresh)
- [ ] No encouraging clicks — no "click here" text near ads
- [ ] No pop-unders or redirects triggered by ad interaction
- [ ] No artificially inflated impressions (no auto-scrolling through ads)

### Mobile Specific
- [ ] On mobile, no more than 1 ad visible per screen (without scrolling)
- [ ] No full-screen ad overlay that blocks content
- [ ] No ad-heavy interstitials before content loads

**Reference:** [Google AdSense Program Policies](https://support.google.com/adsense/answer/48182)

**File:** No code changes — audit-only. Policy violations fixed as critical bugs.

---

## F.5 — Performance Audit

**Goal:** Verify ad scripts don't degrade page load metrics.

**Metrics to measure (with ads ON vs OFF):**

| Metric | Target | Method |
|--------|--------|--------|
| First Contentful Paint (FCP) | < 1.5s | Lighthouse |
| Largest Contentful Paint (LCP) | < 2.5s | Lighthouse |
| Total Blocking Time (TBT) | < 200ms | Lighthouse |
| Cumulative Layout Shift (CLS) | < 0.1 | Lighthouse |
| Time to Interactive (TTI) | < 3.5s | Lighthouse |
| Ad script load time | < 500ms | Network waterfall |

**Comparison test:**
1. Run Lighthouse on the Home page with `PUBLIC_ADS_ENABLED=false` — record scores
2. Run Lighthouse on the Home page with `PUBLIC_ADS_ENABLED=true` — record scores
3. Compare: ads should NOT degrade FCP or LCP (they load async)
4. TBT may increase slightly (acceptable: < 50ms increase)
5. CLS must stay < 0.1

**Network waterfall check:**
- [ ] `adsbygoogle.js` loads with `async` attribute (not render-blocking)
- [ ] Ad scripts do NOT block DOM parsing
- [ ] Below-fold ad slots are NOT requested until scrolled near (lazy loading via IO)
- [ ] No synchronous `document.write()` in ad scripts
- [ ] Total ad-related JavaScript < 200KB (compressed)

**Resource budget:**
- AdSense script: ~80KB compressed (Google-hosted, cached)
- bootstrap.ts: ~5KB compressed (our code)
- Total ad overhead per page: < 300KB (scripts + first ad creative)
- Each additional ad creative: varies (typically 20-100KB)

**File:** No code changes — test-only. Performance regressions fixed as bugs.

---

## F.6 — Smoke Test Checklist (Final Gate)

**The "go/no-go" checklist before setting `PUBLIC_ADS_ENABLED=true` in production.**

### Must Pass (blockers)
- [ ] All F.1 page-type tests pass
- [ ] CLS < 0.1 on all page types (F.2)
- [ ] No mobile layout issues (F.3)
- [ ] No policy violations (F.4)
- [ ] Performance within budget (F.5)
- [ ] Consent Mode v2 working (D.5 — EEA test passed)
- [ ] ads.txt serves correctly (A.1)
- [ ] No console errors on any page type

### Should Pass (warnings — fix soon after launch)
- [ ] All ad slots fill (some unfilled is normal — AdSense fill rate varies)
- [ ] Anti-flicker transitions smooth (no jarring flash)
- [ ] Inline ad cadence feels right (not too dense, not too sparse)
- [ ] Direct sponsor creatives render correctly (if Phase E complete)

### Nice to Have (defer)
- [ ] Sticky sidebar ads working (Phase G)
- [ ] Ad blocker detection (Phase G)
- [ ] Dashboard analytics (Phase G)

---

## Bug Tracking

Issues found during this phase should be tracked with clear labels:

| Priority | Label | Example |
|----------|-------|---------|
| P0 — Blocker | `ads-blocker` | CLS > 0.25 on home page |
| P1 — Critical | `ads-critical` | Inline ads inject inside code blocks |
| P2 — High | `ads-high` | Anti-flicker flash visible for 200ms |
| P3 — Medium | `ads-medium` | Unfilled inline slot doesn't collapse on mobile |
| P4 — Low | `ads-low` | Ad label color doesn't match in workstation theme |

**All P0/P1 issues must be fixed before launch. P2 issues should be fixed. P3/P4 can ship.**

---

## Checklist

- [ ] F.1 — Staging environment test (all page types)
- [ ] F.2 — CLS verification (< 0.1 on all pages)
- [ ] F.3 — Mobile device testing (layout, consent, inline ads, performance)
- [ ] F.4 — Ad policy compliance check (Google AdSense policies)
- [ ] F.5 — Performance audit (FCP, LCP, TBT, CLS, TTI comparison)
- [ ] F.6 — Smoke test checklist (final go/no-go)
