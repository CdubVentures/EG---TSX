# Vault

Validated against:

- `src/shared/layouts/MainLayout.astro`
- `src/shared/layouts/NavLinks.astro`
- `src/shared/layouts/NavIcons.astro`
- `src/features/vault/components/VaultToggleButton.tsx`
- `src/features/vault/components/VaultDropdown.tsx`
- `src/features/vault/components/VaultCount.tsx`
- `src/features/vault/store.ts`
- `src/features/vault/sync.ts`
- `src/features/vault/merge.ts`
- `src/features/vault/thumbs.ts`
- `src/features/vault/vault-action.ts`
- `src/features/notifications/vault-bridge.mjs`
- `src/features/notifications/components/ToastContainer.tsx`
- `src/features/notifications/components/VaultToast.tsx`
- `src/pages/api/user/vault.ts`
- `src/pages/api/vault/thumbs.ts`
- `src/features/vault/server/db.ts`
- `src/features/vault/server/schema.ts`

## Traceability

| Layer | Artifacts |
|---|---|
| Frontend map | [Vault Surface](../03-architecture/routing-and-gui.md#vault-surface), [Catalog Surface](../03-architecture/routing-and-gui.md#catalog-surface) |
| Related runtime docs | [System Map](../03-architecture/system-map.md), [Database Schema](../03-architecture/data-model.md#dynamodb-vault-store), [Environment and Config](../02-dependencies/environment-and-config.md) |
| Adjacent features | [Auth](./auth.md), [Catalog](./catalog.md), [Notifications](./notifications.md) |
| Standalone Mermaid | [vault.mmd](./vault.mmd) |

## Responsibilities

- Hold compare entries in a local Nano Store for guest and signed-in personas.
- Persist guest and signed-in snapshots to scoped `localStorage`.
- Merge guest state into the authenticated persona on first login.
- Sync authenticated compare state to DynamoDB through `/api/user/vault`.
- Repair stale thumbnail metadata through `/api/vault/thumbs`.
- Convert vault mutations into toast notifications through the notifications bridge.

## Runtime Surface

| Surface | Role |
|---|---|
| `VaultToggleButton.tsx` | User-facing add and remove entry point mounted on product cards |
| `VaultDropdown.tsx` | Global shell compare surface rendered inside the vault mega menu |
| `VaultCount.tsx` | Live count badge in the nav shell |
| `/api/user/vault` | Authenticated read and write API for compare persistence and revision checks |
| `/api/vault/thumbs` | Thumbnail normalization API backed by the product registry, not DynamoDB |

## Sequence Diagram

```mermaid
%%{init: {'theme': 'base', 'themeVariables': { 'fontSize': '20px', 'actorWidth': 250, 'actorMargin': 200, 'boxMargin': 20 }}}%%
sequenceDiagram
  autonumber
  actor U as User
  box Client
    participant CARD as VaultToggleButton
    participant STORE as vault/store.ts
    participant ACTION as vault-action.ts
    participant TOAST as vault-bridge + ToastContainer
    participant LS as localStorage
    participant SYNC as vault/sync.ts
    participant BUS as BroadcastChannel or storage event
  end
  box Server
    participant PUT as /api/user/vault
    participant THUMBS as /api/vault/thumbs
    participant JWT as verifyIdToken()
    participant DDB as DynamoDB vault table
  end

  U->>CARD: Click COMPARE
  CARD->>STORE: addToVault(product) or removeFromVault(productId)

  alt Duplicate product
    STORE->>ACTION: emit duplicate action
    ACTION->>TOAST: notify already-in-vault
  else Category limit reached
    STORE->>ACTION: emit category-full action
    ACTION->>TOAST: notify category-full
  else Entry accepted or removed
    STORE->>STORE: mutate entries and queue debounced storage flush
    STORE->>ACTION: emit added or removed action
    ACTION->>TOAST: notify vault toast
    STORE->>LS: write scoped snapshot after debounce
    STORE->>SYNC: vault listener fires
    SYNC->>BUS: broadcast updated entries to same-scope tabs
    BUS-->>SYNC: sibling tabs apply setVaultState(entries)
  end

  alt Guest persona
    SYNC->>SYNC: keep changes local only
  else Authenticated persona
    SYNC->>PUT: PUT compare entries
    PUT->>JWT: verify session cookie
    JWT-->>PUT: uid
    PUT->>DDB: read existing row and rev
    DDB-->>PUT: current compare and builds
    PUT->>DDB: write updated compare and increment rev
    DDB-->>PUT: new rev
    PUT-->>SYNC: ok and rev
    SYNC->>LS: update stored rev

    opt First authenticated session after guest usage
      SYNC->>PUT: GET current server vault
      PUT->>DDB: read compare payload
      DDB-->>PUT: current server compare
      PUT-->>SYNC: compare payload
      SYNC->>SYNC: mergeVaults(guest, server)
      SYNC->>PUT: push merged compare back to server
    end

    opt Thumbnail repair window opens
      SYNC->>THUMBS: POST requestId and category pairs
      THUMBS-->>SYNC: resolved imagePath and thumbnailStem data
      SYNC->>STORE: patch entries with repaired thumbnail metadata
      STORE->>LS: flush repaired snapshot
    end

    opt Visibility regain or auth hydration
      SYNC->>PUT: GET with current rev
      alt Rev unchanged
        PUT-->>SYNC: 304 not modified
      else Rev changed
        PUT->>DDB: read latest compare and builds
        DDB-->>PUT: latest payload
        PUT-->>SYNC: updated payload
        SYNC->>STORE: replace local state from server
      end
    end
  end

  Note over STORE,TOAST: `cleared-category` and `cleared-all` mutate state but intentionally skip toast creation when the clear count is zero.
```

## State Transitions

- Persona starts as `guest` until auth changes to an authenticated `uid`.
- `switchPersona()` swaps the storage namespace before the store is rehydrated.
- First-login detection uses the `eg_first=1` cookie set during auth flow, then
  merges guest and server compare lists before the first authenticated push.
- `rev` is stored per `uid` and used to short-circuit server pulls with `304`.
- Thumbnail refresh timestamps are stored per scope so guest and authenticated
  vault snapshots can age independently.

## Error Paths and Side Effects

- Duplicate adds and category-limit violations emit actions and toasts without
  mutating the stored entries.
- Unauthorized responses suspend server sync but keep the local vault snapshot.
- Network or schema failures during `/api/vault/thumbs` leave the existing
  snapshot intact.
- `VaultToast` still has a client-side `tryImageFallback()` path if the repaired
  image URL fails at render time.
- Toasts currently exist only for add, remove, duplicate, and category-full.
  Empty clear operations intentionally produce no toast. The queue and dismiss
  lifecycle are documented separately in [notifications.md](./notifications.md).
