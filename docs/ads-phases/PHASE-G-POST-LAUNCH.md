# Phase G: Post-Launch Revenue Optimization

> **Parent plan:** `../../AD-STACK-PLAN.md`
> **Status:** NOT STARTED
> **Prerequisite:** Site launched with ads live (`PUBLIC_ADS_ENABLED=true` in production)
> **Effort:** Ongoing — each sub-item is independent, built when ROI justifies it
> **Scope:** Revenue growth features that require live traffic data to implement and validate

---

## Overview

Phase G is not a single sprint — it's a roadmap of independent revenue optimization features built incrementally over months. Each item is prioritized by:

1. **Revenue impact** — estimated CPM/RPM lift
2. **Effort** — implementation complexity
3. **Risk** — potential for UX degradation or policy violation

**Rule:** No Phase G work begins until Phase F smoke test passes and ads have been live for at least 2 weeks with stable baseline metrics.

---

## G.1 — Google Ad Manager (GAM) Setup

**Timeline:** Month 1-3 post-launch
**Revenue impact:** +15-30% vs AdSense-only
**Effort:** Medium (mostly external configuration, minimal code)

### What

Google Ad Manager (formerly DFP) replaces direct AdSense with a unified auction: AdSense + AdX demand compete for every impression. Higher competition = higher CPMs.

### Why

AdSense alone leaves money on the table. GAM's unified auction includes AdX (Google's premium exchange) which has higher-quality demand. Most sites with > 50k monthly pageviews benefit from GAM.

### How

1. **Create GAM account** at `admanager.google.com`
2. **Link AdSense account** to GAM (enables AdSense backfill + AdX)
3. **Create ad units** matching our 22 placements:
   - Naming: `eg_${campaign}` (e.g., `eg_home-rail-top`, `eg_inline-ad`)
   - Sizes: match `ads-registry.json` sizes per placement
4. **Get real slot paths** — GAM assigns paths like `/12345678/eg_home-rail-top`
5. **Update `ads-registry.json`:**
   - Change GPT placeholder slot paths (`/1234567/...`) to real GAM paths
   - Set `display: true` on GPT placements
   - Consider migrating high-value placements from AdSense to GPT

**Code changes:**
- `config/data/ads-registry.json` — update GPT slot paths, enable GPT placements
- `src/features/ads/bootstrap.ts` — verify `mountGPT()` works with real slot paths
- Possibly update `config.ts` if GPT-specific config fields are needed

**Test:**
- Deploy with one GPT placement enabled alongside AdSense
- Verify GAM dashboard shows impressions
- Verify AdSense still backfills on unfilled GPT slots
- Compare revenue per 1000 pageviews (RPM) before/after

---

## G.2 — Ad Refresh for Long-Read Articles

**Timeline:** Month 3+ post-launch
**Revenue impact:** +10-20% on long articles (3000+ word reviews)
**Effort:** Medium
**Risk:** AdSense PROHIBITS auto-refresh. Only GPT/direct slots.

### What

Sticky sidebar ads refresh with a new creative after the user has been viewing the current ad for 30-60 seconds of continuous visibility. This turns one impression into multiple impressions on long-read content.

### Contract

```typescript
interface RefreshConfig {
  minViewTime: number;     // minimum continuous visibility in ms (default: 30000)
  maxRefreshes: number;    // max refreshes per slot per page (default: 5)
  refreshInterval: number; // time between refreshes in ms (default: 30000)
}

function startRefreshTimer(el: HTMLElement, config: RefreshConfig): void;
```

### Rules

1. **Only GPT and direct slots** — AdSense auto-refresh is a TOS violation
2. **Continuous visibility required** — timer pauses when slot leaves viewport (IO)
3. **Maximum refreshes capped** — prevent infinite refresh loops
4. **User-initiated page stay** — don't refresh on idle/background tabs (`visibilitychange` API)
5. **No refresh during ad interaction** — if user is hovering/clicking, pause timer

### Implementation Sketch

```typescript
// bootstrap.ts — add to mountGPT() and mountDirect() slots
function startRefreshTimer(el: HTMLElement, config: RefreshConfig): void {
  let viewStartTime = 0;
  let refreshCount = 0;
  let isVisible = false;

  const observer = new IntersectionObserver(([entry]) => {
    isVisible = entry.isIntersecting;
    if (isVisible) {
      viewStartTime = Date.now();
    }
  }, { threshold: 0.5 }); // 50% visible

  observer.observe(el);

  const checkRefresh = setInterval(() => {
    if (!isVisible || document.hidden) return;
    if (refreshCount >= config.maxRefreshes) {
      clearInterval(checkRefresh);
      return;
    }

    const elapsed = Date.now() - viewStartTime;
    if (elapsed >= config.minViewTime) {
      refreshSlot(el);
      refreshCount++;
      viewStartTime = Date.now(); // reset timer
    }
  }, 1000);
}
```

### Test
- Long article with sticky GPT sidebar → ad refreshes after 30s of continuous viewing
- Scroll away → timer pauses. Scroll back → timer resumes.
- Switch to another tab → timer pauses (visibilitychange).
- After 5 refreshes → no more refreshes (capped).

---

## G.3 — Prebid.js Header Bidding

**Timeline:** Month 6+ post-launch
**Revenue impact:** +20-40% vs AdSense + AdX alone
**Effort:** Large
**Prerequisite:** G.1 (GAM) must be live — Prebid sends bids TO GAM

### What

Prebid.js is an open-source header bidding wrapper that lets multiple SSPs (Supply-Side Platforms) bid on each ad impression. Their bids compete with AdX in GAM's unified auction. More bidders = higher competition = higher CPMs.

### SSPs to Evaluate

| SSP | Strength | Min Traffic | Notes |
|-----|----------|------------|-------|
| **Index Exchange** | Premium demand | 100k+ pageviews/mo | Good CPMs for tech/gaming |
| **OpenX** | Broad demand | 50k+ | Easy setup |
| **Rubicon Project** | High-quality | 100k+ | Strong for display |
| **AppNexus (Xandr)** | Programmatic | 50k+ | Good for niche sites |
| **Amazon APS/UAM** | Unique demand | Any | Runs parallel to Prebid, not through it |

### Implementation Pattern

```html
<!-- MainLayout.astro — in <head>, before GPT -->
<script is:inline async src="https://cdn.jsdelivr.net/npm/prebid.js@latest/build/dist/prebid.js"></script>
<script is:inline>
  var pbjs = pbjs || {};
  pbjs.que = pbjs.que || [];

  pbjs.que.push(function() {
    pbjs.addAdUnits([
      {
        code: 'eg_home-rail-top',
        mediaTypes: { banner: { sizes: [[300, 400], [300, 250], [300, 300]] } },
        bids: [
          { bidder: 'ix', params: { siteId: '12345', size: [300, 250] } },
          { bidder: 'openx', params: { unit: '67890', delDomain: 'eg-d.openx.net' } },
        ]
      },
      // ... more ad units
    ]);

    pbjs.requestBids({
      timeout: 1000, // Don't wait more than 1s for bids
      bidsBackHandler: function() {
        pbjs.setTargetingForGPTAsync();
        // Now load GPT
        googletag.pubads().refresh();
      }
    });
  });
</script>
```

### Key Decisions
- **Timeout:** 1000ms — don't delay page for slow bidders
- **Ad units:** Start with 3-5 highest-value placements (sidebar top, inline, hero)
- **No npm install:** Prebid is loaded via CDN script tag
- **Monitoring:** Track bid rates and CPMs per SSP in GAM reports

### Test
- Verify Prebid bids appear in GAM reporting
- Compare RPM with Prebid vs without
- Verify page load isn't degraded (Prebid timeout respected)

---

## G.4 — Sticky Sidebar Ads

**Timeline:** Month 1-3 post-launch
**Revenue impact:** +5-15% on article pages (higher viewability = higher CPMs)
**Effort:** Medium

### What

Sidebar ad stays fixed as user scrolls past it, increasing viewability time.

### Rules (Non-Negotiable — Google Policy)

1. **Max height:** ≤ 30% of viewport height
2. **Close button:** Required, clearly visible, min 44x44px tap target
3. **Max count:** 1 sticky ad per scroll axis (vertical)
4. **Provider:** GPT or direct ONLY — AdSense cannot be sticky
5. **No covering content:** Sticky ad must be in sidebar, not overlaying main content

### Implementation

**CSS approach (preferred — zero JS for sticky behavior):**

```css
/* ArticleLayout.astro — sidebar sticky */
.article-sidebar__sticky {
  position: sticky;
  top: calc(var(--navbar-height, 60px) + 16px);
  max-height: 30vh; /* Google policy: max 30% viewport */
}
```

**Close button component:**

```astro
<!-- StickyAdWrapper.astro -->
---
interface Props {
  campaign: string;
}
const { campaign } = Astro.props;
---

<div class="sticky-ad-wrapper" data-sticky-ad>
  <button class="sticky-ad-close" aria-label="Close advertisement" data-close-sticky>
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
      <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" stroke-width="2"/>
    </svg>
  </button>
  <AdSlot campaign={campaign} sticky />
</div>

<style>
  .sticky-ad-wrapper {
    position: sticky;
    top: calc(var(--navbar-height, 60px) + 16px);
  }

  .sticky-ad-close {
    position: absolute;
    top: -8px;
    right: -8px;
    z-index: 10;
    width: 24px;
    height: 24px;
    border-radius: 9999px;
    border: 1px solid var(--section-dusker-background-color, #2a2d2d);
    background: var(--section-background-color, #181a1b);
    color: var(--grey-color-3, #b0b0b0);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
  }
</style>

<script>
  document.querySelectorAll('[data-close-sticky]').forEach(btn => {
    btn.addEventListener('click', () => {
      const wrapper = btn.closest('[data-sticky-ad]');
      if (wrapper) {
        (wrapper as HTMLElement).style.position = 'static';
        btn.remove();
      }
    });
  });
</script>
```

**Test:**
- Scroll article page → sidebar ad sticks at top
- Click close → ad unsticks (becomes static, scrolls away)
- Ad height never exceeds 30vh
- On mobile → sidebar hidden entirely (no sticky behavior)

---

## G.5 — Anchor/Bottom Banner Ad

**Timeline:** Month 1-3 post-launch
**Revenue impact:** +5-10% additional impressions
**Effort:** Small

### What

728x90 (desktop) / 320x50 (mobile) banner fixed to viewport bottom. Must have close button. Common on IGN, Tom's Hardware, PCGamer.

### Implementation

```astro
<!-- AnchorAd.astro -->
---
import AdSlot from './AdSlot.astro';
---

<div class="anchor-ad" id="anchor-ad" data-anchor-ad>
  <button class="anchor-ad__close" aria-label="Close advertisement" data-close-anchor>
    <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
      <path d="M3 3l8 8M11 3l-8 8" stroke="currentColor" stroke-width="2"/>
    </svg>
  </button>
  <AdSlot campaign="anchor-bottom" />
</div>

<style>
  .anchor-ad {
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    z-index: 1000;
    display: flex;
    justify-content: center;
    align-items: center;
    padding: 4px 0;
    background: var(--section-background-color, #181a1b);
    border-top: 1px solid var(--section-dusker-background-color, #2a2d2d);
    /* WHY: max-height 30% is Google's policy for anchor ads */
    max-height: 30vh;
  }

  .anchor-ad__close {
    position: absolute;
    top: -12px;
    right: 16px;
    width: 24px;
    height: 24px;
    border-radius: 9999px;
    border: 1px solid var(--section-dusker-background-color, #2a2d2d);
    background: var(--section-background-color, #181a1b);
    color: var(--grey-color-3, #b0b0b0);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
  }
</style>

<script>
  const closeBtn = document.querySelector('[data-close-anchor]');
  closeBtn?.addEventListener('click', () => {
    const anchor = document.getElementById('anchor-ad');
    if (anchor) {
      anchor.style.display = 'none';
      // WHY: Remember dismissal for session (not persistent — reappears on next visit)
      sessionStorage.setItem('anchor-ad-dismissed', 'true');
    }
  });

  // Check if already dismissed this session
  if (sessionStorage.getItem('anchor-ad-dismissed') === 'true') {
    const anchor = document.getElementById('anchor-ad');
    if (anchor) anchor.style.display = 'none';
  }
</script>
```

**Registry addition:**
```json
{
  "anchor-bottom": {
    "provider": "adsense",
    "adClient": "ca-pub-5013419984370459",
    "adSlot": "NEW_SLOT_ID",
    "sizes": "728x90,320x50",
    "display": true,
    "placementType": "inline"
  }
}
```

**Test:**
- Page loads → anchor banner visible at bottom
- Click close → banner dismissed for session
- Refresh → banner reappears (session storage only)
- Navigate to new page (same session) → banner stays dismissed
- Banner doesn't cover content (content has `padding-bottom` to compensate)

---

## G.6 — Ad Blocker Detection

**Timeline:** Month 1 post-launch
**Revenue impact:** Awareness only (no revenue from blocked users, but polite messaging can drive whitelist)
**Effort:** Small

### What

Detect ad blocker and show a polite "support us" message. **Not** content blocking — that backfires and increases bounce rate.

### Contract

```typescript
function detectAdBlocker(): Promise<boolean> {
  // Method 1: Check if adsbygoogle script loaded
  // Method 2: Create a bait element with ad-like class names
  // Returns true if ads are blocked
}
```

### Implementation

```typescript
// bootstrap.ts — add after init()
async function detectAdBlocker(): Promise<boolean> {
  // Method 1: Check if adsbygoogle was loaded and processed
  if (typeof window.adsbygoogle === 'undefined') return true;

  // Method 2: Bait element (most reliable)
  const bait = document.createElement('div');
  bait.className = 'ad-slot adsbygoogle ad-banner';
  bait.style.cssText = 'position:absolute;left:-9999px;width:1px;height:1px;';
  document.body.appendChild(bait);

  // Wait a tick for blocker to act
  await new Promise(r => setTimeout(r, 100));

  const blocked = bait.offsetHeight === 0 || bait.clientHeight === 0
    || getComputedStyle(bait).display === 'none';

  bait.remove();
  return blocked;
}

// Show polite message if blocked
async function handleAdBlocker(): Promise<void> {
  const blocked = await detectAdBlocker();
  if (!blocked) return;

  const banner = document.createElement('div');
  banner.className = 'ad-blocker-notice';
  banner.innerHTML = `
    <p>
      <strong>Ad blocker detected.</strong>
      We rely on ads to keep this site free.
      Consider whitelisting us — we keep ads minimal and non-intrusive.
    </p>
    <button class="ad-blocker-dismiss" aria-label="Dismiss">Got it</button>
  `;

  document.body.prepend(banner);

  banner.querySelector('.ad-blocker-dismiss')?.addEventListener('click', () => {
    banner.remove();
    sessionStorage.setItem('adblocker-notice-dismissed', 'true');
  });
}
```

**Styling:** Subtle top bar (not modal, not popup):
- Background: `var(--site-color)` at 10% opacity
- Text: muted, small
- Dismiss button on right
- Once dismissed, doesn't reappear for the session

**Test:**
- Enable uBlock Origin → load page → notice appears after 100ms
- Click "Got it" → notice dismissed
- Navigate to another page (same session) → no notice
- Disable uBlock → load page → no notice

---

## G.7 — A/B Testing Ad Placements

**Timeline:** Month 3+ post-launch
**Revenue impact:** Variable — identifies optimal configuration
**Effort:** Medium

### What

Test different ad positions, sizes, and density to find the optimal balance between revenue and user experience. Simple cookie-based split — no third-party A/B tool needed.

### Implementation Pattern

```typescript
// src/features/ads/ab-test.ts

interface ABVariant {
  id: string;
  weight: number;  // relative weight for assignment
  config: Partial<InlineAdsConfig>;  // cadence overrides
}

const AB_TESTS: Record<string, ABVariant[]> = {
  'inline-density-2026q2': [
    { id: 'control', weight: 50, config: {} },  // current settings
    { id: 'dense',   weight: 25, config: { desktop: { every: 4 } } },  // more ads
    { id: 'sparse',  weight: 25, config: { desktop: { every: 8 } } },  // fewer ads
  ],
};

function getVariant(testName: string): ABVariant {
  const cookie = getCookie(`ab_${testName}`);
  if (cookie) {
    return AB_TESTS[testName].find(v => v.id === cookie) ?? AB_TESTS[testName][0];
  }

  // Assign variant (weighted random, cookie for 30 days)
  const variants = AB_TESTS[testName];
  const total = variants.reduce((sum, v) => sum + v.weight, 0);
  const rand = Math.random() * total;
  let cumulative = 0;
  for (const v of variants) {
    cumulative += v.weight;
    if (rand < cumulative) {
      setCookie(`ab_${testName}`, v.id, 30);
      return v;
    }
  }
  return variants[0];
}
```

**Measurement:**
- Log variant to Google Analytics as custom dimension
- Compare RPM (Revenue Per Mille) per variant in AdSense/GAM reports
- Run for minimum 2 weeks with at least 1000 users per variant
- Statistical significance: use a simple z-test or just wait for clear separation

### Test Ideas

| Test Name | Control | Variant A | Variant B | Metric |
|-----------|---------|-----------|-----------|--------|
| Inline density | every: 5 | every: 4 | every: 7 | RPM + bounce rate |
| Sidebar position | top + mid | top only | top + mid + bottom | RPM + scroll depth |
| Ad sizes | current mix | only 300x250 | current + 300x600 | RPM + CLS |
| Anchor banner | no anchor | with anchor | — | RPM + bounce rate |

---

## Priority Order

Recommended order based on effort-to-impact ratio:

| Priority | Item | Impact | Effort | When |
|----------|------|--------|--------|------|
| 1 | G.6 — Ad blocker detection | Low revenue, high awareness | Small | Month 1 |
| 2 | G.5 — Anchor banner | +5-10% impressions | Small | Month 1 |
| 3 | G.4 — Sticky sidebar | +5-15% viewability | Medium | Month 1-3 |
| 4 | G.1 — GAM setup | +15-30% CPMs | Medium | Month 1-3 |
| 5 | G.2 — Ad refresh | +10-20% on long articles | Medium | Month 3+ |
| 6 | G.7 — A/B testing | Variable | Medium | Month 3+ |
| 7 | G.3 — Prebid.js | +20-40% CPMs | Large | Month 6+ |

**Key insight:** G.6, G.5, and G.4 are quick wins. G.1 is the single biggest revenue lever. G.3 is the most impactful long-term but requires GAM first and enough traffic to attract SSPs.

---

## Checklist

- [ ] G.1 — Google Ad Manager (GAM) setup + GPT slot paths
- [ ] G.2 — Ad refresh for sticky/long-read slots (GPT/direct only)
- [ ] G.3 — Prebid.js header bidding (3-5 SSPs)
- [ ] G.4 — Sticky sidebar ads with close button
- [ ] G.5 — Anchor/bottom banner ad with dismiss
- [ ] G.6 — Ad blocker detection with polite message
- [ ] G.7 — A/B testing framework for ad placements
