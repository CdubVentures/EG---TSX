# Phase A: Quick Wins & Safety Nets

> **Parent plan:** `../../AD-STACK-PLAN.md`
> **Status:** DONE
> **Prerequisite:** None — can start immediately
> **Effort:** 1-2 hours total
> **Scope:** Low-risk fixes that improve compliance and prevent wasted impressions. No new features.

---

## Overview

Phase A is a batch of small, independent fixes that can each be done in minutes. They address compliance gaps (ads.txt, ad labeling), accessibility verification, and a one-line safety net for wasted impressions. Nothing here changes ad behavior — it hardens what already exists.

---

## A.1 — Verify `ads.txt`

**Goal:** Confirm the IAB ads.txt file is correct and will be served at the domain root.

**Current state:** `public/ads.txt` exists with 2 lines.

**What to verify:**
1. File contains: `google.com, pub-5013419984370459, DIRECT, f08c47fec0942fa0`
2. Astro serves it at `/ads.txt` (not `/public/ads.txt`)
3. No trailing whitespace or BOM that could trip up parsers

**Test:**
```bash
# After build, check the output
cat dist/ads.txt
# Should contain the exact AdSense DIRECT line
```

**File:** `public/ads.txt`

**Done when:** ads.txt content verified, serves correctly in dev server at `http://localhost:4321/ads.txt`.

---

## A.2 — Ad Label Visibility on Live Slots

**Goal:** Confirm the "Ad" label badge is visible on live ad slots before the ad creative fills.

**Current state:** `<span class="ad-label">Ad</span>` exists in all live render paths of `AdSlot.astro`. CSS positions it as a centered 36px circle. Once `data-fill="filled"`, the label is hidden (`.ad-slot[data-fill="filled"] .ad-label { display: none; }`).

**What to verify:**
1. In `pending` state (before ad loads), the "Ad" circle is visible
2. The label meets Google's requirement that ads are identifiable
3. Once AdSense fills the slot, Google's own "AdChoices" badge replaces our label

**Test:**
1. Temporarily set `PUBLIC_ADS_ENABLED=true` in `.env`
2. Start dev server
3. Screenshot an ad slot in its loading state — "Ad" circle should be visible
4. Revert `PUBLIC_ADS_ENABLED` back to `false`

**File:** `src/features/ads/components/AdSlot.astro` (lines 271-293, `.ad-label` CSS)

**Done when:** Visual confirmation that the label is visible during ad load.

---

## A.3 — Hidden Slot Guard (`offsetParent`)

**Goal:** Prevent wasted ad impressions on CSS-hidden elements.

**Problem:** If a sidebar is hidden via `display: none` on mobile, `IntersectionObserver` won't fire for those slots — but edge cases exist where a slot could still be mounted (e.g., slot was visible on desktop, user resizes to mobile). More critically, `visibility: hidden` or `opacity: 0` elements still have layout, so IO *would* fire.

**Solution:** One-line guard at the top of `mountSlot()`:

```typescript
// bootstrap.ts — mountSlot()
function mountSlot(el: HTMLElement): void {
  // WHY: prevents wasted impressions on slots hidden by CSS (e.g., sidebar on mobile).
  // A hidden slot has no offsetParent. Requesting an ad that's never seen tanks CTR
  // and viewability scores, hurting domain reputation with ad networks.
  if (el.offsetParent === null) return;

  const provider = el.dataset.provider ?? '';
  // ... rest of existing logic
}
```

**Contract:**
- `mountSlot()` must not call any provider mount function if `el.offsetParent === null`
- Elements with `display: none` (or inside a `display: none` ancestor) have `offsetParent === null`
- Elements with `visibility: hidden` still have `offsetParent` — this guard does NOT catch those (acceptable: IO handles that case)

**Test (add to `bootstrap.test.mjs`):**
```javascript
test('mountSlot skips elements with no offsetParent', () => {
  // Create mock element with offsetParent = null
  const el = { offsetParent: null, dataset: { provider: 'adsense', campaign: 'test' } };
  // Call mountSlot — should return without calling any provider function
  // Assert: no adsbygoogle push, no GPT defineSlot
});
```

**Files:**
- `src/features/ads/bootstrap.ts` — add guard to `mountSlot()` (line 133)
- `src/features/ads/tests/bootstrap.test.mjs` — add test

**Done when:** Guard added, test passes, existing tests still pass.

---

## A.4 — Verify Accessibility Attributes

**Goal:** Confirm that `role="complementary"` and unique `aria-label` are on all render paths.

**Current state:** All 6 render paths in `AdSlot.astro` have:
- `role="complementary"`
- `aria-label="Advertisement: {campaign}"` (unique per slot)

**What to verify:**
1. Read every conditional render block in `AdSlot.astro`
2. Confirm both attributes are present on the outermost `<div>` of each block
3. Count: there should be 6 blocks (sample, production placeholder, dev placeholder, live adsense rail, live adsense inline, live gpt/direct/native)

**Test:** Manual code review — no runtime test needed.

**File:** `src/features/ads/components/AdSlot.astro`

**Done when:** All 6 render paths confirmed to have both attributes.

---

## Checklist

- [x] A.1 — ads.txt verified
- [x] A.2 — Ad label visibility confirmed (code review: label visible in `pending`, hidden after `filled`)
- [x] A.3 — offsetParent guard added + tested (21/21 bootstrap tests pass, 63/63 full suite)
- [x] A.4 — Accessibility attributes verified on all 6 render paths
