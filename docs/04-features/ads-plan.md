# Ad Stack Plan

> **Last updated:** 2026-03-06
> **Scope:** Full ad system for EG-TSX — from config to live ad rendering
> **Phase docs:** `docs/ads-phases/PHASE-{A..G}-*.md`

---

## Architecture Summary

### Position Model (3 positions)

The entire ad system is built around **3 standard industry positions**. Every ad slot on every page uses one of these:

| Position | Slot ID | Sizes | Behavior |
|----------|---------|-------|----------|
| `sidebar` | `6560707323` | 300x400, 300x250, 300x300 | Non-sticky rail ad (scrolls away) |
| `sidebar_sticky` | `3735233435` | 300x600, 300x250 | Sticky rail ad (follows scroll) |
| `in_content` | `1051669276` | 970x250, 728x90, 336x280, 300x250, 320x100, 320x50 | Inline content ad |

### Providers (2 active)

| Provider | Purpose | Status |
|----------|---------|--------|
| `adsense` | Google AdSense programmatic ads | Active |
| `direct` | Self-served sponsor image links (highest margin) | Active |

### Key Files

| File | Purpose |
|------|---------|
| `config/data/ads-registry.json` | Position registry (slot IDs, sizes, provider, display toggle) |
| `config/data/inline-ads-config.json` | Per-collection inline ad cadence rules |
| `config/data/direct-sponsors.json` | Direct sponsor creatives with weighted rotation |
| `src/features/ads/config.ts` | `AD_POSITIONS`, `ADSENSE_CLIENT`, Zod schemas |
| `src/features/ads/resolve.ts` | `resolveAd(position)`, size parsing utilities |
| `src/features/ads/bootstrap.ts` | Client-side ad hydration (lazy IO, provider routing, fill observation) |
| `src/features/ads/components/AdSlot.astro` | Universal ad slot component |
| `src/features/ads/components/InlineAd.astro` | Inline content ad wrapper |
| `src/features/ads/inline/` | Cadence engine, word counter, rehype plugin |
| `config/eg-config.pyw` | Consolidated config app; Ads panel is the 5-tab Tkinter dashboard |

### Kill Switch

`PUBLIC_ADS_ENABLED=false` in `.env` renders CLS-safe placeholders with zero ad scripts loaded. Set to `true` only after Phase F verification.

---

## Phase Status

| Phase | Name | Status | Summary |
|-------|------|--------|---------|
| **A** | Quick Wins & Safety Nets | **DONE** | ads.txt, ad labels, offsetParent guard, accessibility |
| **B** | Inline Ad System | **DONE** | Config + word counter + cadence engine + InlineAd component + rehype plugin. Integration test (B.7) deferred until article layouts exist. |
| **C** | GUI Overhaul | **DONE** | 5-tab Tkinter dashboard: Positions, Usage Scanner, Inline Config, Sponsors, Dashboard placeholder. Position-based restructure (22 campaigns → 3 positions). |
| **D** | Consent & Privacy | Not started | Consent Mode v2, CMP integration, consent-aware bootstrap. **Legal blocker** — must complete before ads go live. |
| **E** | Direct Sponsors | Not started | Weighted creative rotation with date scheduling, build-time selection. Schema exists, rotation logic not built. |
| **F** | Live Testing | Not started | Staging verification, CLS audit, mobile testing, policy compliance. Final gate before `PUBLIC_ADS_ENABLED=true`. |
| **G** | Post-Launch Optimization | Not started | Sticky sidebar, anchor banner, ad blocker detection, A/B testing. Requires live traffic data. |

### Dependency Chain

```
A (safety nets) ── DONE
├──► B (inline ads) ── DONE
├──► C (GUI) ── DONE
├──► D (consent) ── BLOCKER for launch
│     └──► F (live testing) ── final gate
└──► E (direct sponsors) ── independent, can ship without
       └──► G (post-launch) ── after F passes
```

---

## Open Findings (from pre-restructure audit)

These findings from `AUDIT-ADS-FEATURE.md` remain relevant:

| ID | Priority | Finding | Phase |
|----|----------|---------|-------|
| F2 | CRITICAL | No Google Consent Mode v2 — required before ads go live | D |
| F8 | HIGH | No responsive size reservation (desktop sizes on mobile) | F |
| F9 | MEDIUM | AdSense fill overflow clamp CSS not ported from HBS | F |

Findings F1 (ads.txt), F3 (bootstrap.ts), F4 (ad labels), F5 (CLS largest size), F6 (aria-labels), F7 (aside role), F10 (fill tracking) have been resolved.

Findings F12 (GPT slots), F11 (native campaigns) are no longer applicable — GPT and native providers were removed.

---

## Test Suites

| Suite | Runner | Count | File |
|-------|--------|-------|------|
| Bootstrap pure logic | `node --test` | 13 | `src/features/ads/tests/bootstrap.test.mjs` |
| Position config & schema | `node --test` | 43 | `src/features/ads/tests/placements.test.mjs` |
| Inline config | `node --test` | 9 | `src/features/ads/inline/tests/config.test.mjs` |
| Word counter | `node --test` | 15 | `src/features/ads/inline/tests/word-counter.test.mjs` |
| Cadence engine | `node --test` | 13 | `src/features/ads/inline/tests/cadence-engine.test.mjs` |
| Rehype plugin | `node --test` | 9 | `src/features/ads/inline/tests/rehype-inline-ads.test.mjs` |
| GUI pure functions | `python -m pytest` | 44 | `config/tests/test_ads_panel.py` |

---

## Restructure History

The ad system was restructured on 2026-03-05/06 from a campaign-based model (22 named placements with sections) to a position-based model (3 flat positions). This touched 14+ files across config, components, bootstrap, GUI, tests, and documentation. See `PHASE-C-GUI-OVERHAUL.md` for details.
