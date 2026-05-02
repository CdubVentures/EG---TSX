# Catalog

Validated against:

- `src/pages/index.astro`
- `src/pages/reviews/[...slug].astro`
- `src/pages/guides/[...slug].astro`
- `src/pages/news/[...slug].astro`
- `src/pages/brands/[...slug].astro`
- `src/features/home/components/**`
- `src/features/home/slideshow-carousel.ts`
- `src/features/site-index/components/**`
- `src/features/vault/components/VaultToggleButton.tsx`
- `src/features/vault/store.ts`
- `src/features/vault/sync.ts`
- `src/pages/api/user/vault.ts`
- `src/pages/api/vault/thumbs.ts`

## Traceability

| Layer | Artifacts |
|---|---|
| Frontend map | [Catalog Surface](../03-architecture/routing-and-gui.md#catalog-surface), [Home View Hierarchy](../03-architecture/routing-and-gui.md#home-view-hierarchy) |
| Home browse UI | [`HomeHero.astro`](../../src/features/home/components/HomeHero.astro), [`TopProducts.astro`](../../src/features/home/components/TopProducts.astro), [`CategoryDropdown.tsx`](../../src/features/home/components/CategoryDropdown.tsx), [`HomeSlideshow.astro`](../../src/features/home/components/HomeSlideshow.astro), [`slideshow-carousel.ts`](../../src/features/home/slideshow-carousel.ts) |
| Index browse UI | [`SiteIndexPage.astro`](../../src/features/site-index/components/SiteIndexPage.astro), [`IndexBleed.astro`](../../src/features/site-index/components/IndexBleed.astro), [`IndexBody.astro`](../../src/features/site-index/components/IndexBody.astro), [`BrandBody.astro`](../../src/features/site-index/components/BrandBody.astro), [`CategorySidebar.astro`](../../src/features/site-index/components/CategorySidebar.astro), [`FeedVertical.astro`](../../src/features/site-index/components/FeedVertical.astro) |
| Compare UI and state | [`VaultToggleButton.tsx`](../../src/features/vault/components/VaultToggleButton.tsx), [`store.ts`](../../src/features/vault/store.ts), [`sync.ts`](../../src/features/vault/sync.ts) |
| Runtime routes | [`/api/user/vault`](../../src/pages/api/user/vault.ts), [`/api/vault/thumbs`](../../src/pages/api/vault/thumbs.ts) |
| Data schemas | [`products`](../03-architecture/data-model.md#products), [`articles`](../03-architecture/data-model.md#articles), [`DynamoDB vault store`](../03-architecture/data-model.md#dynamodb-vault-store) |
| Adjacent features | [Home](./home.md), [Search](./search.md), [Vault](./vault.md) |
| Standalone Mermaid | [catalog.mmd](./catalog.mmd) |

## Runtime surface

| Surface | Role |
|---|---|
| `/` | Static home landing page with client-side top-products filtering and compare controls |
| `/reviews/*`, `/guides/*`, `/news/*`, `/brands/*` | Static browse families backed by the site-index view model |
| `/api/user/vault` | Authenticated compare persistence into DynamoDB |
| `/api/vault/thumbs` | Thumbnail repair and normalization for vault entries |

## Sequence Diagram

```mermaid
sequenceDiagram
  autonumber
  actor U as User
  participant UI as HomeSlideshow or site-index card UI
  participant DROP as CategoryDropdown and slideshow-carousel
  participant TOGGLE as VaultToggleButton
  participant VSTORE as vault store
  participant NOTICE as vault action bridge
  participant LOCAL as localStorage
  participant SYNC as vault sync
  participant BUS as BroadcastChannel and storage listeners
  participant PUT as /api/user/vault
  participant THUMBS as /api/vault/thumbs
  participant JWT as verifyIdToken()
  participant DDB as DynamoDB eg_profiles

  opt Browse-only client refresh
    U->>DROP: Change top products category
    DROP->>DROP: update selected category state and data attribute
    DROP->>UI: dispatch slideshow refresh event
    UI->>UI: rebuild Embla slides and rehydrate compare mounts
  end

  U->>TOGGLE: Click COMPARE on a product card
  TOGGLE->>TOGGLE: restart pulse animation and prevent default checkbox toggle
  alt Item already in vault
    TOGGLE->>VSTORE: removeFromVault(productId)
  else New item requested
    TOGGLE->>VSTORE: addToVault(product)
    VSTORE->>VSTORE: normalize image path and thumbnail stem
    alt Duplicate product
      VSTORE-->>TOGGLE: reject duplicate
    else Category at limit
      VSTORE-->>TOGGLE: reject category-full
    else Accepted
      VSTORE->>VSTORE: append entry with addedAt timestamp
    end
  end

  VSTORE->>NOTICE: emit vault action event
  NOTICE-->>U: update notifications and counts
  VSTORE->>LOCAL: debounce flush current scope snapshot

  par Same-tab reactivity
    VSTORE-->>UI: all mounted compare toggles re-render from the store
  and Cross-tab propagation
    SYNC->>BUS: broadcast scope and entries
    BUS-->>SYNC: sibling tabs apply the same entries
  end

  alt Guest scope
    SYNC->>SYNC: stop before network sync
    SYNC-->>U: vault persists locally only
  else Authenticated scope
    SYNC->>SYNC: schedule pushToServer after debounce
    SYNC->>PUT: PUT /api/user/vault with compare entries
    PUT->>JWT: verify session cookie
    JWT-->>PUT: authenticated uid
    PUT->>DDB: read current compare, builds, and rev
    DDB-->>PUT: existing vault payload
    PUT->>DDB: writeVault with new compare and preserved builds
    DDB-->>PUT: incremented rev
    PUT-->>SYNC: ok and new rev
    SYNC->>LOCAL: store rev for current uid

    opt Thumbnail normalization pass
      SYNC->>THUMBS: POST /api/vault/thumbs
      THUMBS-->>SYNC: resolved thumbnail metadata from product registry
      SYNC->>VSTORE: patch entries with repaired thumbnail data
      VSTORE->>LOCAL: flush repaired snapshot
    end

    opt Revalidation on visibility or login hydration
      SYNC->>PUT: GET /api/user/vault with current rev
      alt Server rev unchanged
        PUT-->>SYNC: 304 not modified
      else Server rev changed
        PUT->>JWT: verify session cookie
        JWT-->>PUT: authenticated uid
        PUT->>DDB: readVault(uid)
        DDB-->>PUT: compare, builds, and rev
        PUT-->>SYNC: latest vault payload
        SYNC->>VSTORE: replace local entries from server
      end
    end
  end

  Note over PUT,DDB: Browse pages are static S3 and CloudFront documents. DynamoDB is entered only when catalog UI persists or refreshes authenticated vault state.
```

## Flow Notes

- Catalog is split across static browse delivery and dynamic compare persistence.
  The browse pages themselves do not require a live database query once built.
- The home landing-page composition that feeds the slideshow, dashboard, games,
  and featured rails is documented separately in [home.md](./home.md).
- `CategoryDropdown.tsx` and `slideshow-carousel.ts` form a client-only browse
  control loop. They refresh the slideshow presentation without touching the DB.
- `VaultToggleButton.tsx`, `vault/store.ts`, and `vault/sync.ts` are the runtime
  boundary where a catalog click can become a DynamoDB write.
- Thumbnail repair is deliberately separated into `/api/vault/thumbs`. It uses
  the product registry to normalize image metadata without hitting DynamoDB.
- The full compare-state lifecycle, toast bridge, first-login merge, and
  revision-based sync loop are expanded in [vault.md](./vault.md).
- Search-backed discovery into product and article URLs is documented separately
  in [search.md](./search.md). Auth-driven first-login merge behavior is
  documented separately in [auth.md](./auth.md).
