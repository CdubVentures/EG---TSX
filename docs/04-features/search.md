# Search

Validated against:

- `src/shared/layouts/NavIcons.astro`
- `src/features/search/store.ts`
- `src/features/search/components/SearchDialog.tsx`
- `src/pages/api/search.ts`
- `src/core/article-helpers.ts`
- `src/core/seo/url-contract.ts`

## Traceability

| Layer | Artifacts |
|---|---|
| Frontend map | [Search Surface](../03-architecture/routing-and-gui.md#search-surface) |
| GUI entry files | [`NavIcons.astro`](../../src/shared/layouts/NavIcons.astro), [`store.ts`](../../src/features/search/store.ts), [`SearchDialog.tsx`](../../src/features/search/components/SearchDialog.tsx) |
| Runtime route | [`/api/search`](../../src/pages/api/search.ts) |
| Data schemas | [`products`](../03-architecture/data-model.md#products), [`articles`](../03-architecture/data-model.md#articles) |
| URL builders | [`article-helpers.ts`](../../src/core/article-helpers.ts), [`url-contract.ts`](../../src/core/seo/url-contract.ts) |
| Standalone Mermaid | [search.mmd](./search.mmd) |

## Runtime surface

| Route | Role |
|---|---|
| `/api/search` | Full-text search over `products` and `articles` with thumbnail and URL derivation |

## Sequence Diagram

```mermaid
sequenceDiagram
  autonumber
  actor U as User
  participant NAV as NavIcons keydown handler
  participant STORE as search store
  participant DIALOG as SearchDialog
  participant ABORT as AbortController
  participant API as /api/search
  participant PG as PostgreSQL
  participant HELP as image and URL helpers

  U->>NAV: Click search icon or press Ctrl or Cmd plus K
  NAV->>STORE: openSearch()
  STORE->>STORE: close account and settings popups
  STORE->>DIALOG: mark dialog open
  DIALOG-->>U: render overlay and focus input

  loop Each query change
    U->>DIALOG: Type in search input
    DIALOG->>DIALOG: update query and clear debounce timer
    alt Query empty after trim
      DIALOG->>ABORT: abort in-flight request
      DIALOG->>DIALOG: clear results and loading state
    else Query non-empty
      DIALOG->>DIALOG: set loading true
      DIALOG->>DIALOG: wait 300ms debounce
      DIALOG->>ABORT: abort previous request if present
      DIALOG->>API: GET /api/search with q and limit
      API->>API: clamp limit and inspect optional type
      alt Product search enabled
        API->>PG: SELECT from products by tsvector and ILIKE
        PG-->>API: product rows
        loop Each product row
          API->>HELP: resolveProductImage()
          HELP-->>API: thumbnail url and object fit
          API->>HELP: productUrlFromImagePath()
          HELP-->>API: hubs detail url
        end
      end
      alt Article search enabled and slots remain
        API->>PG: SELECT from articles by tsvector and ILIKE
        PG-->>API: article rows
        loop Each article row
          API->>HELP: resolveHero() and articleUrl()
          HELP-->>API: hero thumbnail and article url
        end
      end
      API-->>DIALOG: SearchResult JSON array
      DIALOG->>DIALOG: set results, reset active index, stop loading
      DIALOG-->>U: paint ranked result list
    end
  end

  alt Keyboard navigation
    U->>DIALOG: ArrowUp, ArrowDown, Home, or End
    DIALOG->>DIALOG: move active index
    DIALOG->>DIALOG: scroll active option into view
    U->>DIALOG: Press Enter
    DIALOG->>STORE: closeSearch()
    DIALOG->>U: window.location = selected result url
  else Mouse navigation
    U->>DIALOG: Hover or click a result
    DIALOG->>DIALOG: set active index from hover
    DIALOG->>STORE: closeSearch()
    DIALOG->>U: follow anchor href
  else Backend failure
    API-->>DIALOG: 503 Search temporarily unavailable
    DIALOG->>DIALOG: clear results and stop loading
    DIALOG-->>U: empty state remains visible
  end

  Note over API,PG: Products and articles are mirrored PostgreSQL tables documented in database-schema.md.
```

## Flow Notes

- Search is a nav-level overlay, so the user interaction always starts in the
  global shell rather than inside a page-specific component.
- `openSearch()` explicitly closes account and settings popups before the dialog
  opens, preventing overlapping nav overlays.
- `/api/search` is dual-source. It can query only `products`, only `articles`,
  or both, depending on the request type filter and remaining result slots.
- Result URLs are helper-generated contracts, not route-file-derived links.
  Product results map to `/hubs/...`; article results map to `/{collection}/{id}`.
