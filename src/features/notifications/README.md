# src/features/notifications

## Purpose

Owns the cross-feature toast system, currently centered on vault notifications
but structured to accept additional notification kinds later.

## Public API (The Contract)

- `index.ts`
  Exports `$notifications`, `notify()`, `dismiss()`, `dismissAll()`,
  `Notification`, `VaultNotification`, `NotificationBase`,
  `VAULT_TOAST_DURATIONS`, `MAX_VISIBLE`, `EXIT_ANIMATION_MS`,
  `ToastContainer`, and `initVaultBridge()`.
- `store.ts`
  Typed gateway over the pure `store.mjs` implementation.
- `vault-bridge.ts`
  Typed gateway over the vault-notification bridge.
- Components:
  `components/ToastContainer.tsx` and `components/VaultToast.tsx`.

## Dependencies

Allowed imports:

- `@features/vault/*` for the documented bridge path
- `nanostores`, React, and browser timing APIs

Forbidden imports:

- Direct filesystem, database, or route-layer modules

## Mutation Boundaries

- May update in-memory notification state and browser timers.
- May subscribe to vault events/state.
- Must not write project files or remote state.

## Domain Invariants

- Notification state is ephemeral and client-only.
- The `.ts` files are typed gateways over the Node-safe `.mjs` logic.
- Toast lifetimes and exit timing must stay aligned with the UI animation
  contract.

## Local Sub-Boundaries

- [components/README.md](components/README.md)
- [tests/README.md](tests/README.md)
