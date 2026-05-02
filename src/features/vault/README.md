# src/features/vault

## Purpose

Owns the comparison vault: client state, server sync, thumbnail refresh, merge
rules, and DynamoDB-backed persistence for signed-in users.

## Public API (The Contract)

- `index.ts`
  Exports `VaultProduct`, `VaultEntry`, `VaultState`, `VaultSyncState`,
  `VaultStorageScope`, `AddResult`, `VAULT_MAX_PER_CATEGORY`, `vaultStorageKey`,
  `vaultRevKey`, `$vault`, `addToVault()`, `removeFromVault()`,
  `clearCategory()`, `clearAll()`, `moveItem()`, `isInVault()`, `vaultCount()`,
  `vaultCountByCategory()`, `vaultItemsByCategory()`, `switchPersona()`,
  `setVaultState()`, `getCurrentScope()`, `$vaultSync`, `initVaultSync()`,
  `pullFromServer()`, `pushToServer()`, and `mergeVaults()`.
- Components used by layouts and cards:
  `components/VaultToggleButton.tsx`, `VaultDropdown.tsx`, and `VaultCount.tsx`.
- Server modules:
  `server/db.ts` and `server/schema.ts`.
- Supporting modules:
  `thumbs.ts`, `merge.ts`, `sync.ts`, `vault-action.ts`.

## Dependencies

Allowed imports:

- `@core/*`
- `@features/auth/*` for the documented auth-to-vault sync path
- `nanostores`
- AWS DynamoDB SDKs and `zod` in server modules only

Forbidden imports:

- Unrelated feature internals

## Mutation Boundaries

- May write localStorage for guest vault state.
- May call `/api/user/vault` and `/api/vault/thumbs`.
- Server modules may read/write DynamoDB table `eg_profiles`.

## Domain Invariants

- Maximum 16 items per category.
- Guest vault lives locally; authenticated vault source of truth is DynamoDB.
- First-login merge keeps guest entries on conflict.
- Cross-tab sync must not create feedback loops.
- Thumbnail refresh is derived from canonical product media, not ad hoc UI data.

## Local Sub-Boundaries

- [components/README.md](components/README.md)
- [server/README.md](server/README.md)
- [tests/README.md](tests/README.md)
