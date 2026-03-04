# Vault Domain — Architectural Contract

> Comparison vault: save products, compare across categories, sync to DynamoDB when authenticated.

---

## Boundary

**Owner:** `src/features/vault/`
**Imports from:** `@core/config` (Category type), `@features/auth/store` (sync.ts only), `nanostores`
**Imported by:** `src/shared/layouts/` (init + nav components), `src/pages/` (API endpoints), any feature needing vault state

---

## Public API (`index.ts`)

### State atoms
| Export | Type | Purpose |
|--------|------|---------|
| `$vault` | `atom<VaultState>` | Current vault entries (reactive) |
| `$vaultSync` | `atom<VaultSyncState>` | Sync status: persona, rev, syncing, error |

### Actions
| Export | Signature | Purpose |
|--------|-----------|---------|
| `addToVault` | `(product: VaultProduct) => AddResult` | Add product; returns `'added'`, `'duplicate'`, or `'category-full'` |
| `removeFromVault` | `(id: string) => void` | Remove by product ID |
| `clearCategory` | `(category: string) => void` | Clear all entries in a category |
| `clearAll` | `() => void` | Clear entire vault |
| `moveItem` | `(id: string, newIndex: number) => void` | Reorder entries |

### Sync
| Export | Signature | Purpose |
|--------|-----------|---------|
| `initVaultSync` | `() => void` | Idempotent init; subscribes to `$auth`, BroadcastChannel, visibility |
| `pullFromServer` | `(uid: string) => Promise<void>` | Conditional GET from `/api/user/vault` |
| `pushToServer` | `() => Promise<void>` | Debounced PUT to `/api/user/vault` |
| `mergeVaults` | `(guest, server) => VaultEntry[]` | Union by product ID, guest wins, max 16/category |

### Readers
| Export | Signature |
|--------|-----------|
| `isInVault` | `(id: string) => boolean` |
| `vaultCount` | `() => number` |
| `vaultCountByCategory` | `() => Record<string, number>` |
| `vaultItemsByCategory` | `(category: string) => VaultEntry[]` |

---

## Key Invariants

- **Max 16 items per category** (`VAULT_MAX_PER_CATEGORY`)
- **Guest = localStorage only.** No server calls when `scope === 'guest'`.
- **Authenticated = DynamoDB is source of truth.** localStorage is a cache.
- **First login merges:** guest vault + server vault, guest wins on conflict.
- **401 suspends all server calls** until next successful auth transition (`_suspended` flag).
- **Cross-tab sync:** BroadcastChannel primary, `storage` event fallback. `_fromBroadcast` flag prevents feedback loops.

---

## Server Modules (SSR-only, never imported by client)

- `server/db.ts` — DynamoDB `readVault`, `writeVault`, `readVaultRev` (table: `eg_profiles`)
- `server/schema.ts` — Zod schemas for API validation

## DynamoDB Schema

Table `eg_profiles`, PK: `userId` (Cognito sub)

| Column | Type | Purpose |
|--------|------|---------|
| `vault` | S (JSON) | Versioned envelope: `{ v: 1, compare: VaultEntry[], builds: [] }` |
| `rev` | N | Monotonic counter, atomically incremented on every write |

`builds` array is reserved for future named-build feature. No migration needed when builds ship.

---

## REST API

| Method | Route | Auth | Purpose |
|--------|-------|------|---------|
| GET | `/api/user/vault` | Required | Returns `{ compare, builds, rev }`. Supports `?rev=N` → 304. |
| PUT | `/api/user/vault` | Required | Body: `{ compare: VaultEntry[] }`. Preserves `builds`. Returns `{ ok, rev }`. |

---

## Dependencies

- `nanostores` — client state atoms
- `@aws-sdk/client-dynamodb` + `@aws-sdk/lib-dynamodb` — server-only DynamoDB access
- `zod` — server-only API validation
