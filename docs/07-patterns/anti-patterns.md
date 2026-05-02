# Anti-Patterns

> **Purpose:** Explicitly banned patterns — what NOT to do, with examples of the wrong way.
> **Prerequisites:** [Conventions](../01-project-overview/conventions.md)
> **Last validated:** 2026-03-18

## 1. Calling `getCollection()` Directly

**WRONG:**
```typescript
// In a component or page
import { getCollection } from 'astro:content';
const products = await getCollection('dataProducts');
```

**RIGHT:**
```typescript
import { getProducts } from '@core/products';
const products = await getProducts();
```

**Why:** Gateways filter by active categories, apply sorting, and validate data. Direct collection access bypasses all safety checks. See [Data Gateway Contract](../06-references/data-gateway-contract.md).

## 2. Hardcoded CSS Values in Features

**WRONG:**
```css
.my-card { background: #1d2021; border-radius: 8px; color: #fff; }
```

**RIGHT:**
```html
<div class="bg-brand-surface rounded-custom text-color-primary">
```

**Why:** Hardcoded values bypass the theme system and break light theme. Use CSS variables from `global.css` via Tailwind classes.

**Exception:** HBS-ported components may use hardcoded values matching frozen HBS source with `/* always-dark */` comment.

## 3. Cross-Feature Imports

**WRONG:**
```typescript
// In src/features/vault/store.ts
import { searchStore } from '@features/search/store';
```

**RIGHT:**
```typescript
// In src/features/vault/store.ts
import { authStore } from '@features/auth/store'; // OK — shared kernel exception
```

**Why:** Feature boundaries exist for a reason. Only `auth` is a shared kernel.

## 4. Using `useState` for Tooltips/Modals

**WRONG:**
```tsx
const [showTooltip, setShowTooltip] = useState(false);
```

**RIGHT:**
```html
<button popovertarget="my-tooltip">?</button>
<div id="my-tooltip" popover>Tooltip content</div>
```

**Why:** Native Popover API = zero JavaScript for simple overlays. React state banned for tooltips and static dropdowns.

## 5. Inline Styles

**WRONG:**
```tsx
<div style={{ backgroundColor: '#333', padding: '1rem' }}>
```

**RIGHT:** Use Tailwind classes. `style=` only allowed for data-driven values:
```tsx
<div style={{ '--cat-color': product.categoryColor } as React.CSSProperties}>
```

## 6. Creating `.css` Files for Components

**WRONG:**
```
src/features/home/components/Dashboard.css
```

**RIGHT:** Use Astro scoped `<style>` blocks or Tailwind classes. Zero separate CSS files.

## 7. Magic Numbers

**WRONG:**
```typescript
if (retries > 3) throw new Error('Too many retries');
const pageSize = 20;
```

**RIGHT:**
```typescript
import { CONFIG } from '@core/config';
if (retries > CONFIG.maxRetries) throw new Error('Too many retries');
```

**Why:** Centralize knobs in `src/core/config.ts` or `.env`. No magic numbers for behavior.

## 8. Raw `px` for `font-size`

**WRONG:**
```css
font-size: 14px;
font-size: 1.27rem;
```

**RIGHT:**
```css
font-size: var(--font-size-14px);
font-size: var(--ft-14-18);
```

**Why:** The 11px base font system auto-scales across breakpoints. Raw values don't scale. See [CSS Conventions](../08-design-system/css-conventions.md).

## 9. Modifying Gaming (Dark) Theme Colors

**WRONG:**
```css
[data-theme="gaming"] { --color-surface: #222; /* "improved" dark */ }
```

**RIGHT:** Never. Gaming theme values are frozen to EG-HBS exact hex values. Only modify light themes.

## 10. `@ts-ignore` or `as any`

**WRONG:**
```typescript
// @ts-ignore
const data = response.json() as any;
```

**RIGHT:**
```typescript
const data = (await response.json()) as Record<string, unknown>;
// Or declare ambient types in src/types/vendor.d.ts
```

**Why:** `@ts-ignore` and `@ts-nocheck` are absolutely forbidden. `as any` only for third-party globals with `// WHY` comment.

## Related Documents

- [Conventions](../01-project-overview/conventions.md) — the positive rules
- [CSS Conventions](../08-design-system/css-conventions.md) — sizing system details
- [Repo AGENTS.md](../../../AGENTS.md) — full agent rules and project philosophy
