# Phase B: Inline Ad System (Article Ads)

> **Parent plan:** `../../AD-STACK-PLAN.md`
> **Status:** DONE (code + tests complete; B.7 integration test + B.8 GUI tab are manual — deferred until article layouts exist)
> **Prerequisite:** Phase A complete. Article layouts exist (Phase 7 of main project build).
> **Effort:** Large — the biggest single piece of remaining ad work
> **Scope:** Build the entire inline ad pipeline: config → word counter → cadence engine → component → rehype plugin → integration

---

## Overview

This phase builds the system that injects ads into article content (reviews, guides, news). It's the biggest gap in the HBS→TSX migration — HBS has 776 lines of DOM-based injection logic that we're replacing with a cleaner rehype AST approach.

**Two mechanisms, one component:**
1. **Manual:** Author places `<InlineAd />` in MDX where they want an ad
2. **Automatic:** rehype plugin auto-injects `<InlineAd />` based on cadence rules per collection type

Both produce the same `InlineAd.astro` component in the final HTML.

**Build order matters:** Pure logic first (testable without Astro), then the component, then the plugin, then integration. Each step has its own test suite before the next step begins.

---

## B.1 — Inline Ads Config Schema + Config File

**STATE:** CONTRACT

**Goal:** Define the per-collection cadence configuration and validate it with Zod.

**Contract:**
- Input: JSON file with `defaults` and `collections` sections
- Each collection has: `enabled`, `desktop: { firstAfter, every, max }`, `mobile: { ... }`, `wordScaling: { enabled, desktopWordsPerAd, mobileWordsPerAd, minFirstAdWords }`
- Zod schema validates at module load time (same pattern as `AD_REGISTRY`)

**Config file:** `config/data/inline-ads-config.json`
```json
{
  "defaults": {
    "campaign": "inline-ad",
    "desktop": true,
    "mobile": true
  },
  "collections": {
    "reviews": {
      "enabled": true,
      "desktop": { "firstAfter": 3, "every": 5, "max": 8 },
      "mobile":  { "firstAfter": 3, "every": 4, "max": 10 },
      "wordScaling": {
        "enabled": true,
        "desktopWordsPerAd": 450,
        "mobileWordsPerAd": 350,
        "minFirstAdWords": 150
      }
    },
    "guides": {
      "enabled": true,
      "desktop": { "firstAfter": 2, "every": 4, "max": 10 },
      "mobile":  { "firstAfter": 2, "every": 3, "max": 12 },
      "wordScaling": {
        "enabled": true,
        "desktopWordsPerAd": 400,
        "mobileWordsPerAd": 300,
        "minFirstAdWords": 150
      }
    },
    "news": {
      "enabled": true,
      "desktop": { "firstAfter": 3, "every": 6, "max": 4 },
      "mobile":  { "firstAfter": 3, "every": 5, "max": 5 },
      "wordScaling": {
        "enabled": true,
        "desktopWordsPerAd": 500,
        "mobileWordsPerAd": 400,
        "minFirstAdWords": 200
      }
    },
    "games":  { "enabled": false },
    "brands": { "enabled": false },
    "pages":  { "enabled": false }
  }
}
```

**Tests (RED first):**
- Zod parse succeeds on valid config above
- Rejects missing `firstAfter` field
- Rejects negative `every` value
- Rejects `max` of 0 when `enabled: true`
- Unknown collection name passes through (`.passthrough()` or ignore)
- `enabled: false` collection needs no cadence fields

**Files:**
- `config/data/inline-ads-config.json` (new)
- `src/features/ads/inline/config.ts` (new — Zod schema + loader)
- `src/features/ads/inline/tests/config.test.mjs` (new)

---

## B.2 — Word Counter (HAST Text Node Counting)

**STATE:** CONTRACT → RED → GREEN

**Goal:** Pure function that counts words in a HAST tree. No Astro dependency — runs in `node --test`.

**Contract:**
```typescript
function countWords(tree: HastNode): number
```
- Input: HAST root node (from rehype)
- Output: integer word count
- Counts words in text nodes inside: `p`, `h1`-`h6`, `li`, `td`, `th`, `blockquote`, `figcaption`
- **Skips** content inside: `pre`, `code`, `script`, `style`, `svg`
- Word = whitespace-separated token (same as HBS `_ad_injection.js`)
- Nested inline elements (bold, italic, links) — their text IS counted (they're inside a paragraph)

**Boundary tests (table-driven):**

| Input | Expected | Why |
|-------|----------|-----|
| Empty tree | 0 | No content |
| `<p>hello world</p>` | 2 | Simple paragraph |
| `<h2>Build Quality</h2><p>The mouse is great.</p>` | 6 | Heading + paragraph |
| `<pre><code>const x = 1;</code></pre>` | 0 | Code blocks excluded |
| `<p>The <strong>bold</strong> mouse</p>` | 3 | Nested inline counted |
| `<p>Hello</p><pre>skip</pre><p>world</p>` | 2 | Mixed: only paragraphs |
| `<ul><li>Item one</li><li>Item two</li></ul>` | 4 | List items counted |
| Text node with multiple spaces | Correct count | Don't double-count |

**Files:**
- `src/features/ads/inline/word-counter.ts` (new)
- `src/features/ads/inline/tests/word-counter.test.mjs` (new)

---

## B.3 — Cadence Engine (Pure Logic)

**STATE:** CONTRACT → RED → GREEN

**Goal:** Pure function that calculates WHERE to inject ads. Zero DOM/HAST dependency — pure numbers in, indices out.

**Contract:**
```typescript
interface CadenceInput {
  anchorCount: number;       // total content anchors in the article
  wordCount: number;         // total word count
  firstAfter: number;        // first ad after N anchors
  every: number;             // then every M anchors
  max: number;               // hard cap
  wordsPerAd: number;        // word-scaling divisor (0 = disabled)
  minFirstAdWords: number;   // suppress all ads if below this
  manualAdIndices: number[]; // indices where author placed <InlineAd />
}

function calculateInjectionPoints(input: CadenceInput): number[]
```
- Output: sorted `number[]` of anchor indices where auto-ads should be injected
- **Rules:**
  1. First ad at index `firstAfter` (0-based)
  2. Subsequent ads every `every` anchors after previous injection point
  3. Hard cap at `max` total ads (manual + auto combined)
  4. Word-scaling: `floor(wordCount / wordsPerAd)` overrides `max` when lower
  5. If `wordCount < minFirstAdWords`, return `[]` (suppress all)
  6. Manual ad indices consume cadence slots — auto-injection skips those indices and shifts subsequent positions
  7. Never inject at index 0 (before any content)
  8. Never inject at an index ≥ `anchorCount`

**Boundary tests (table-driven):**

| anchorCount | wordCount | firstAfter | every | max | wordsPerAd | minFirst | manualAt | expected | why |
|---|---|---|---|---|---|---|---|---|---|
| 10 | 2000 | 3 | 5 | 8 | 450 | 150 | [] | [3, 8] | Normal: 2 ads |
| 10 | 2000 | 3 | 5 | 8 | 450 | 150 | [3] | [8] | Manual at 3 consumes slot |
| 3 | 100 | 3 | 5 | 8 | 450 | 150 | [] | [] | Too few words |
| 20 | 500 | 3 | 4 | 10 | 450 | 150 | [] | [3] | Word-scaling caps to 1 |
| 0 | 0 | 3 | 5 | 8 | 450 | 150 | [] | [] | No content |
| 5 | 2000 | 2 | 2 | 10 | 450 | 150 | [] | [2, 4] | Limited by anchor count |
| 15 | 3000 | 3 | 3 | 4 | 0 | 0 | [] | [3, 6, 9, 12] | Word-scaling disabled |
| 10 | 2000 | 3 | 5 | 8 | 450 | 150 | [1, 5] | [8] | Two manuals shift cadence |
| 10 | 150 | 3 | 5 | 8 | 450 | 150 | [] | [3] | Exactly at min threshold: 1 ad |
| 10 | 149 | 3 | 5 | 8 | 450 | 150 | [] | [] | Just below threshold |

**Files:**
- `src/features/ads/inline/cadence-engine.ts` (new)
- `src/features/ads/inline/tests/cadence-engine.test.mjs` (new)

---

## B.4 — `InlineAd.astro` Component

**STATE:** GREEN (wraps existing `AdSlot.astro`)

**Goal:** MDX-usable component for inline ads in article content.

**Props:**
```typescript
interface Props {
  campaign?: string;   // defaults to "inline-ad"
  desktop?: boolean;   // default true
  mobile?: boolean;    // default true
}
```

**Renders:**
```html
<div class="article-inline-ad" data-desktop="true" data-mobile="true">
  <AdSlot campaign="inline-ad" />
</div>
```

**CSS (scoped):**
- `.article-inline-ad` — flex container, centered, margin `2rem 0`
- Device gating via CSS media queries (no JS):
  - `@media (max-width: 767px)`: hide if `data-mobile="false"`
  - `@media (min-width: 768px)`: hide if `data-desktop="false"`

**Test:** Render the component, verify HTML structure matches expected output.

**Files:**
- `src/features/ads/components/InlineAd.astro` (new)

---

## B.5 — rehype Plugin (HAST Traversal)

**STATE:** CONTRACT → RED → GREEN

**Goal:** rehype plugin that auto-injects `InlineAd` nodes into article content at build time.

**Plugin pipeline:**
1. Read collection type from `file.data.astro.frontmatter` or file path
2. Check frontmatter for `inlineAds: false` override → if false, return (no-op)
3. Load cadence config for that collection → if `enabled: false`, return
4. Walk HAST tree top-level children, identify content anchors
5. Call `countWords(tree)` for total word count
6. Find existing manual `InlineAd` nodes (mdxJsxFlowElement with name "InlineAd") → record their indices
7. Call `calculateInjectionPoints()` with anchor count, word count, config, manual indices
8. Insert `InlineAd` HAST nodes at calculated positions (insert in reverse order to preserve indices)

**Skip zones (CRITICAL — prevents hydration mismatches):**
```typescript
const SKIP_TAGS = new Set([
  'pre', 'code', 'table', 'figure', 'picture',
  'details', 'summary', 'blockquote', 'svg',
]);

function isSkipZone(node: HastNode): boolean {
  if (node.type === 'element' && SKIP_TAGS.has(node.tagName)) return true;
  if (node.type === 'mdxJsxFlowElement' || node.type === 'mdxJsxTextElement') return true;
  return false;
}
```

The plugin ONLY operates on top-level block siblings. It walks the root `children[]` array and inserts between blocks. It never descends into or injects inside any node.

**Content anchors (what counts as an "anchor" for cadence):**
- `element` nodes with tagName: `h1`-`h6`, `p`, `ul`, `ol`, `blockquote`, `figure`, `table`
- `mdxJsxFlowElement` nodes (custom components count as 1 anchor each)
- Consecutive short paragraphs may be grouped into "runs" (75-word threshold from HBS) — **simplification for v1: every top-level block = 1 anchor** (skip the run logic, revisit if cadence feels off)

**Tests:**
- Collection disabled → no mutation
- Frontmatter `inlineAds: false` → no mutation
- 15-anchor article with default review config → correct injection indices
- Manual `<InlineAd />` at index 5 → auto-injection shifts
- Skip zones: no ad inside `<pre>` or `<SpecsTable>` component
- Word scaling: 500-word article with `minFirstAdWords: 150` → 1 ad max
- Empty article → no ads
- Article with only headings (no paragraphs) → still gets ads (headings are anchors)

**Files:**
- `src/features/ads/inline/rehype-inline-ads.ts` (new)
- `src/features/ads/inline/tests/rehype-inline-ads.test.mjs` (new)

---

## B.6 — Wire Plugin into Astro Config

**Goal:** Add the rehype plugin to the Astro markdown/rehype pipeline.

**Change:**
```javascript
// astro.config.mjs
import { rehypeInlineAds } from './src/features/ads/inline/rehype-inline-ads';

export default defineConfig({
  markdown: {
    rehypePlugins: [
      // ... existing plugins
      rehypeInlineAds,
    ],
  },
});
```

**Test:** `npm run build` succeeds with no errors. Check build output for a review article — inspect HTML for `article-inline-ad` divs.

**File:** `astro.config.mjs`

---

## B.7 — Integration Test with Real Articles

**Goal:** Verify the full pipeline works with actual content.

**Test articles:**
1. A long review (~3000 words) — should get ~6 desktop ads, ~8 mobile ads
2. A medium guide (~1500 words) — should get ~3 desktop ads
3. A short news article (~500 words) — should get 1 ad or none (word scaling)
4. An article with a manual `<InlineAd />` already in the MDX — auto-injection should skip nearby

**Verification checklist:**
- [ ] Correct number of auto-injected ads per word-scaling
- [ ] Short articles get fewer ads (or none)
- [ ] Manual `<InlineAd />` in MDX still renders alongside auto-injected ones
- [ ] No ads inside code blocks, tables, or custom components
- [ ] No hydration errors in browser console
- [ ] Ads render in correct placeholder mode (dev/production/sample based on config)
- [ ] Desktop-only and mobile-only ads show/hide correctly at breakpoint
- [ ] No visual layout issues around injected ads

**How:** Build + serve. Manual visual inspection on 2-3 articles per collection type.

---

## B.8 — GUI: Inline Ads Config Tab

**Goal:** Add Tab 3 to `ads-manager.pyw` for editing per-collection inline ad cadence.

**Reads/writes:** `config/data/inline-ads-config.json`

**UI layout:**
- Collection selector dropdown (Reviews, Guides, News, Games, Brands, Pages)
- Enabled toggle per collection
- Desktop cadence fields: firstAfter, every, max
- Mobile cadence fields: firstAfter, every, max
- Word scaling section: enabled toggle, desktopWordsPerAd, mobileWordsPerAd, minFirstAdWords
- **Preview calculator:** Given a word count input, shows how many ads desktop/mobile would get
- Collection status bar at bottom: "Reviews ● | Guides ● | News ● | Games ○ | Brands ○ | Pages ○"

**File:** `config/ads-manager.pyw`

---

## Dependency Graph

```
B.1 (config schema)
  │
  ├─► B.2 (word counter) ──────────┐
  │                                  │
  └─► B.3 (cadence engine) ────────┤
                                     │
B.4 (InlineAd component) ──────────┤
                                     │
                                     ▼
                              B.5 (rehype plugin)
                                     │
                                     ▼
                              B.6 (wire into Astro)
                                     │
                                     ▼
                              B.7 (integration test)
                                     │
                                     ▼
                              B.8 (GUI tab)
```

B.1, B.2, B.3, B.4 can all be built in parallel. B.5 depends on all four. B.6-B.8 are sequential.

---

## Checklist

- [x] B.1 — Config schema + JSON file (9 tests)
- [x] B.2 — Word counter with tests (15 tests)
- [x] B.3 — Cadence engine with tests (13 tests)
- [x] B.4 — InlineAd.astro component
- [x] B.5 — rehype plugin with tests (9 tests)
- [x] B.6 — Wired into Astro config
- [ ] B.7 — Integration test with real articles (deferred: needs article layouts from Phase 7)
- [ ] B.8 — GUI inline ads config tab (deferred: manual addition to ads-manager.pyw)
