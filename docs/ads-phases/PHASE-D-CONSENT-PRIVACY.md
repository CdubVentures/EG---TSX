# Phase D: Consent & Privacy

> **Parent plan:** `../../AD-STACK-PLAN.md`
> **Status:** NOT STARTED
> **Prerequisite:** Phase A complete. Can run in parallel with Phases B and C.
> **Effort:** Medium
> **Scope:** Legal compliance for international users — Consent Mode v2, CMP integration, consent-aware ad bootstrap

---

## Overview

**This phase is a legal blocker.** Ads cannot go live (`PUBLIC_ADS_ENABLED=true`) until Consent Mode v2 is implemented. Without it:

- EEA/UK users cannot be served personalized ads (GDPR violation)
- Google will restrict ad serving and may suspend the account
- No consent signal = Google treats all traffic as non-consented = lower CPMs globally

**What we're building:**
1. Consent Mode v2 defaults (deny-all until user consents)
2. CMP (Consent Management Platform) integration — script-based, no npm deps
3. Consent-aware ad bootstrap (don't load ad scripts until consent granted)
4. Consent change listener (user updates preferences mid-session)
5. Verification with EU IP testing

**Key constraint:** No new npm dependencies. CMP is loaded via `<script>` tag. All consent logic runs client-side.

---

## D.1 — Add Consent Mode v2 Defaults

**STATE:** CONTRACT

**Goal:** Add Google's Consent Mode v2 default snippet to `<head>`, BEFORE any Google scripts.

**Contract:**
- The consent defaults MUST execute before `adsbygoogle.js`, `gtag.js`, or any Google Analytics script
- Default state: ALL consent types denied
- `wait_for_update: 500` — gives CMP 500ms to load before Google scripts proceed with denied defaults

**Implementation:**

```html
<!-- MainLayout.astro — in <head>, BEFORE any Google scripts -->
<script is:inline>
  // WHY: Google Consent Mode v2 — required for GDPR/ePrivacy compliance.
  // Must execute before any Google tag. Defaults to deny-all.
  // CMP will call gtag('consent', 'update', {...}) when user consents.
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}

  gtag('consent', 'default', {
    'ad_storage': 'denied',
    'ad_user_data': 'denied',
    'ad_personalization': 'denied',
    'analytics_storage': 'denied',
    'functionality_storage': 'denied',
    'personalization_storage': 'denied',
    'security_storage': 'granted',
    'wait_for_update': 500,
  });

  // WHY: US visitors get granted defaults (no GDPR/ePrivacy obligation).
  // The CMP will override this for EU visitors.
  gtag('consent', 'default', {
    'ad_storage': 'granted',
    'ad_user_data': 'granted',
    'ad_personalization': 'granted',
    'analytics_storage': 'granted',
    'region': ['US'],
  });
</script>
```

**Placement in MainLayout.astro:**
```
<head>
  <meta charset="utf-8" />
  <meta name="viewport" ... />
  <!-- 1. Consent Mode defaults (THIS) -->
  <!-- 2. CMP script (D.2) -->
  <!-- 3. Google Analytics / AdSense scripts (existing) -->
</head>
```

**Tests:**
- View page source → consent defaults appear before `adsbygoogle.js`
- Chrome DevTools → Console → type `dataLayer` → first entry is consent default
- No JavaScript errors in console

**File:** `src/shared/layouts/MainLayout.astro`

---

## D.2 — Select and Integrate CMP

**STATE:** CONTRACT

**Goal:** Choose a Google-certified CMP and integrate it.

### CMP Options (all script-based, no npm deps)

| CMP | Cost | Setup | Google-Certified | Notes |
|-----|------|-------|------------------|-------|
| **Google's built-in consent UI** | Free | Minimal | Yes | Basic, no customization |
| **Quantcast Choice** | Free | Medium | Yes | Good for publishers, customizable |
| **Cookiebot** | Free < 50 pages, then paid | Medium | Yes | Mature, WCAG accessible |
| **CookieYes** | Free < 100 pages | Easy | Yes | Simple setup |

**Recommendation:** Quantcast Choice or Google's built-in. Both are free, Google-certified, and work with Consent Mode v2.

### Integration Pattern (generic — works with any CMP)

```html
<!-- MainLayout.astro — in <head>, after consent defaults, before ad scripts -->

<!-- CMP script — loads consent UI, fires consent update events -->
<script is:inline async src="https://cmp.quantcast.com/choice/abc123/choice.js"></script>
```

**The CMP handles:**
1. Detecting if user is in EEA/UK (geo-based)
2. Showing consent banner if no prior consent stored
3. Storing consent in cookies/localStorage
4. Calling `gtag('consent', 'update', { ad_storage: 'granted', ... })` on consent
5. Providing a "manage preferences" button for users to change consent

**What we DON'T build:**
- No custom consent UI (CMP provides it)
- No geo-detection logic (CMP handles it)
- No consent storage (CMP handles it)

### CMP Styling

The CMP banner must match EG's dark theme:
- Most CMPs support custom CSS or theme colors
- Set background to match `--section-background-color` values
- Set text to match `--white-color-1`
- Set accent/button color to match `--site-color`

**Tests:**
- Clear all cookies → load page → consent banner appears (if testing from EEA IP)
- Click "Accept All" → banner dismissed, consent stored
- Refresh page → no banner (consent remembered)
- Click "Manage Preferences" (footer link) → preferences UI opens
- Check `dataLayer` → contains consent update event with granted values

**Files:**
- `src/shared/layouts/MainLayout.astro` (add CMP script tag)
- CMP dashboard (external — configure via CMP's web interface)

---

## D.3 — Make bootstrap.ts Consent-Aware

**STATE:** CONTRACT → RED → GREEN

**Goal:** Modify `init()` in `bootstrap.ts` to check consent state before loading ad scripts.

**Contract:**

```typescript
interface ConsentState {
  ad_storage: 'granted' | 'denied';
  ad_user_data: 'granted' | 'denied';
  ad_personalization: 'granted' | 'denied';
}

function getConsentState(): ConsentState {
  // Read from CMP's consent storage (cookie or localStorage)
  // Fallback: check dataLayer for most recent consent update
  // Default: denied
}
```

**Boot sequence change:**

```typescript
// bootstrap.ts — updated init()
export function init(): void {
  if (!isEnabled()) {
    document.documentElement.classList.add('eg-ads-killed');
    return;
  }

  const consent = getConsentState();

  if (consent.ad_storage === 'denied') {
    // WHY: No ad consent — show production placeholders, don't load ad scripts.
    // This prevents Google policy violations and wasted network requests.
    document.documentElement.classList.add('eg-ads-consent-denied');
    return;
  }

  // Consent granted — proceed with normal ad loading
  mountAll();
}
```

**CSS class behavior:**
- `.eg-ads-killed` — existing: ads completely disabled (env var)
- `.eg-ads-consent-denied` — new: ads enabled but consent denied → show production placeholders, no ad scripts loaded

**Key rules:**
1. If `PUBLIC_ADS_ENABLED=false` → no ads at all (existing behavior, unchanged)
2. If `PUBLIC_ADS_ENABLED=true` AND `ad_storage=denied` → production placeholders, no ad scripts
3. If `PUBLIC_ADS_ENABLED=true` AND `ad_storage=granted` → full ad loading

**Tests (add to `bootstrap.test.mjs`):**

| Test | Consent State | Expected |
|------|---------------|----------|
| Consent denied → no ad scripts | `ad_storage: 'denied'` | `eg-ads-consent-denied` class added, no `adsbygoogle.push()` calls |
| Consent granted → normal flow | `ad_storage: 'granted'` | `mountAll()` runs, `adsbygoogle.push()` called for visible slots |
| Consent unknown (default) → denied | no consent data | Same as denied |
| Env disabled → kills override consent | `PUBLIC_ADS_ENABLED=false` | `eg-ads-killed` class, regardless of consent |

**File:** `src/features/ads/bootstrap.ts`

---

## D.4 — Consent Change Listener

**STATE:** CONTRACT → RED → GREEN

**Goal:** Listen for consent changes during the user's session. If consent goes from denied → granted, initialize ads. If granted → revoked, don't tear down existing ads (they stay until page reload).

**Contract:**

```typescript
function listenForConsentChanges(): void {
  // Listen for CMP consent update events
  // On denied → granted: call init() to load ads
  // On granted → denied: no action (ads stay until page reload)
}
```

**Implementation approach:**

Most CMPs fire a callback or event when consent changes:

```typescript
// Generic pattern — adapt to chosen CMP's API
window.addEventListener('consentUpdate', (e: CustomEvent) => {
  const consent = getConsentState();
  if (consent.ad_storage === 'granted') {
    // Remove denied class if present
    document.documentElement.classList.remove('eg-ads-consent-denied');
    // Initialize ads (idempotent — mountAll skips already-mounted slots)
    mountAll();
  }
});
```

**Quantcast-specific:**
```typescript
// Quantcast Choice fires __tcfapi callback
window.__tcfapi?.('addEventListener', 2, (tcData, success) => {
  if (success && (tcData.eventStatus === 'useractioncomplete' || tcData.eventStatus === 'tcloaded')) {
    // Re-check consent and init if granted
    const consent = getConsentState();
    if (consent.ad_storage === 'granted') {
      mountAll();
    }
  }
});
```

**Tests:**

| Test | Scenario | Expected |
|------|----------|----------|
| Denied → Granted | User accepts consent mid-session | `mountAll()` called, ads load |
| Granted → Denied | User revokes consent mid-session | No action (existing ads stay) |
| Already mounted | Consent granted, `mountAll()` called again | Idempotent — already-mounted slots skipped |

**File:** `src/features/ads/bootstrap.ts`

---

## D.5 — EEA Verification

**Goal:** End-to-end test from an EU IP address to verify the full consent flow.

**Method:** Use a VPN set to an EEA country (e.g., Germany, France, Netherlands).

**Test checklist:**

- [ ] Load site from EU IP → consent banner appears
- [ ] Banner text is readable, buttons are clickable
- [ ] "Reject All" → banner dismissed, no ad scripts in Network tab
- [ ] Refresh → no banner (rejection remembered), still no ad scripts
- [ ] Clear cookies → banner reappears
- [ ] "Accept All" → banner dismissed, ad scripts load, ads render
- [ ] Refresh → no banner (acceptance remembered), ads load immediately
- [ ] "Manage Preferences" link in footer → preferences panel opens
- [ ] Change preference from accepted to rejected → page needs reload for ads to disappear
- [ ] Chrome DevTools → Application → check consent cookies are being set

**US IP verification:**
- [ ] Load site from US IP → no consent banner (US has granted defaults)
- [ ] Ad scripts load immediately
- [ ] No consent UI unless user explicitly opens preferences

**Google Consent Mode debugging:**
- [ ] Open Chrome DevTools → Console → type `dataLayer`
- [ ] Verify consent default event appears first
- [ ] Verify consent update event appears after CMP action
- [ ] Install "Google Tag Assistant" extension → verify consent signals are detected

**Files:** No code changes — this is a test-only step.

---

## CSS: Consent-Denied State

When consent is denied, production placeholder CSS applies. Add one new class:

```css
/* global.css or MainLayout.astro <style> */

/* Consent denied: show production placeholders on all ad slots */
.eg-ads-consent-denied .ad-slot[data-fill="pending"] {
  /* Render as production placeholder (top/bottom border + "Ad" circle) */
  border-top: 1px solid var(--section-dusker-background-color, #2a2d2d);
  border-bottom: 1px solid var(--section-dusker-background-color, #2a2d2d);
}

.eg-ads-consent-denied .ad-slot[data-fill="pending"] .ad-label {
  display: inline-flex;
}
```

This ensures users who deny consent still see properly styled empty slots instead of broken layout.

---

## Dependency Graph

```
D.1 (consent defaults)
  |
  +---> D.2 (CMP integration)
          |
          +---> D.3 (consent-aware bootstrap)
                  |
                  +---> D.4 (consent change listener)
                          |
                          +---> D.5 (EEA verification)
```

Strictly sequential. Each step depends on the previous.

---

## Checklist

- [ ] D.1 — Consent Mode v2 defaults in `<head>`
- [ ] D.2 — CMP selected and script tag added
- [ ] D.3 — bootstrap.ts consent gating + tests
- [ ] D.4 — Consent change listener + tests
- [ ] D.5 — EEA verification (VPN test)
