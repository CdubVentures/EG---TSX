# Canonical Examples

> **Purpose:** One correct, copy-paste-ready example for each common task — so an LLM generates code that matches project conventions.
> **Prerequisites:** [Conventions](../01-project-overview/conventions.md), [Folder Map](../01-project-overview/folder-map.md)
> **Last validated:** 2026-03-15

## Adding a New Astro Page (static)

Based on `src/pages/reviews/[...slug].astro`:

```astro
---
// src/pages/reviews/[...slug].astro
import MainLayout from '@shared/layouts/MainLayout.astro';
import { getArticles } from '@core/content';

export async function getStaticPaths() {
  const articles = await getArticles('reviews');
  return articles.map(entry => ({
    params: { slug: entry.slug },
    props: { entry },
  }));
}

const { entry } = Astro.props;
const { Content } = await entry.render();
---

<MainLayout title={entry.data.title}>
  <article>
    <Content />
  </article>
</MainLayout>
```

Key rules:
- Import layouts from `@shared/layouts/`
- Use gateways (`getArticles`) from `@core/` — never `getCollection()` directly
- Use `MainLayout` for all pages (handles theme, meta, auth bootstrap)

## Adding a New API Route (SSR)

Based on `src/pages/api/search.ts`:

```typescript
// src/pages/api/search.ts
import type { APIRoute } from 'astro';

export const prerender = false; // Required for SSR routes

export const GET: APIRoute = async ({ request, url }) => {
  const query = url.searchParams.get('q') ?? '';

  // Business logic here
  const results = await searchProducts(query);

  return new Response(JSON.stringify(results), {
    headers: { 'Content-Type': 'application/json' },
  });
};
```

Key rules:
- `export const prerender = false` is mandatory for SSR
- Return `Response` objects, not plain values
- Add cache headers per `config/data/cache-cdn.json` contract

## Adding a New React Island

Based on `src/features/search/components/SearchDialog.tsx`:

```tsx
// src/features/search/components/SearchDialog.tsx
import { useStore } from '@nanostores/react';
import { searchStore } from '../store';

interface SearchDialogProps {
  placeholder?: string;
}

export function SearchDialog({ placeholder = 'Search...' }: SearchDialogProps) {
  const state = useStore(searchStore);
  // Component logic
  return <div>{/* ... */}</div>;
}
```

Usage in Astro (hydration directive required):
```astro
<SearchDialog client:visible placeholder="Search products..." />
```

Key rules:
- Props interface defined before component
- Use Nano Stores for cross-island state
- `client:visible` or `client:load` directive mandatory in Astro files

## Adding a New Feature Module

```text
src/features/my-feature/
├── index.ts            # Public API exports only
├── store.ts            # Nano Store (if stateful)
├── types.ts            # TypeScript interfaces
├── README.md           # Boundary contract
├── components/
│   └── MyComponent.tsx # React component
└── tests/
    └── my-feature.test.mjs
```

`index.ts` example:
```typescript
export { myFeatureStore } from './store';
export type { MyFeatureState } from './types';
```

Key rules:
- Only export through `index.ts`
- README.md is required (purpose, public API, dependencies, invariants)
- Tests colocated in `tests/` directory

## Adding a New Test

Based on `test/dashboard.test.mjs`:

```javascript
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

describe('buildDashboard', () => {
  it('fills 15 slots from eligible articles', () => {
    const result = buildDashboard(articles, config);
    assert.equal(result.length, 15);
  });

  // Table-driven test pattern (preferred)
  const cases = [
    { input: [], expected: 0, label: 'empty input' },
    { input: [article1], expected: 1, label: 'single article' },
  ];

  for (const { input, expected, label } of cases) {
    it(`handles ${label}`, () => {
      assert.equal(buildDashboard(input, config).length, expected);
    });
  }
});
```

Key rules:
- `node:test` and `node:assert/strict` — no Jest/Vitest
- Table-driven tests preferred
- Factories over `let`/`beforeEach` mutation
- Test behavior through public APIs, not internals

## Related Documents

- [Conventions](../01-project-overview/conventions.md) — full style rules
- [Data Gateway Contract](../06-references/data-gateway-contract.md) — how to access data correctly
