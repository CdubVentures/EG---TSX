# Notifications

Validated against:

- `src/shared/layouts/MainLayout.astro`
- `src/features/notifications/index.ts`
- `src/features/notifications/store.ts`
- `src/features/notifications/store.mjs`
- `src/features/notifications/types.ts`
- `src/features/notifications/vault-bridge.ts`
- `src/features/notifications/vault-bridge.mjs`
- `src/features/notifications/components/ToastContainer.tsx`
- `src/features/notifications/components/VaultToast.tsx`
- `src/features/notifications/tests/vault-toast-image.test.mjs`
- `src/features/vault/vault-action.ts`
- `src/features/vault/vault-action.mjs`
- `src/features/vault/components/VaultToggleButton.tsx`
- `src/features/vault/store.ts`

## Traceability

| Layer | Artifacts |
|---|---|
| Frontend map | [Notification Surface](../03-architecture/routing-and-gui.md#notification-surface), [Vault Surface](../03-architecture/routing-and-gui.md#vault-surface) |
| Related docs | [Routing and GUI](../03-architecture/routing-and-gui.md), [Vault](./vault.md) |
| Adjacent features | [Vault](./vault.md), [Home](./home.md) |
| Standalone Mermaid | [notifications.mmd](./notifications.mmd) |

## Responsibilities

- Mount the global toast container once from `MainLayout.astro`.
- Subscribe to vault action events and translate them into typed notification payloads.
- Enforce a maximum visible queue, auto-dismiss durations, and exit-animation timing.
- Render vault-specific toast UI with product imagery, action pills, and manual dismiss controls.

## Runtime Surface

| Surface | Role |
|---|---|
| `MainLayout.astro` boot script | Calls `initVaultBridge()` and mounts `ToastContainer` |
| `vault-bridge.mjs` | Single subscription point from `$vaultAction` into `notify()` |
| `store.mjs` | Queue state, timers, max-visible enforcement, and dismiss logic |
| `ToastContainer.tsx` | Fixed-position global renderer for the current queue |
| `VaultToast.tsx` | Product toast variant with image fallback and progress bar |

No server route, durable storage, or database-backed notification history was
verified in this snapshot. Notifications are purely client-side and ephemeral.

## Sequence Diagram

```mermaid
%%{init: {'theme': 'base', 'themeVariables': { 'fontSize': '20px', 'actorWidth': 250, 'actorMargin': 200, 'boxMargin': 20 }}}%%
sequenceDiagram
  autonumber
  actor U as User
  box Vault Producer
    participant CARD as VaultToggleButton
    participant VSTORE as vault/store.ts
    participant ACTION as $vaultAction
  end
  box Notification Layer
    participant BRIDGE as initVaultBridge() and vault-bridge.mjs
    participant QUEUE as notifications/store.mjs
    participant TIMER as setTimeout
  end
  box UI
    participant MOUNT as MainLayout and ToastContainer
    participant TOAST as VaultToast
  end

  U->>CARD: Click compare add or remove
  CARD->>VSTORE: mutate vault state
  VSTORE->>ACTION: emitVaultAction(type, product)
  ACTION-->>BRIDGE: subscribed action event

  alt Action is added, removed, duplicate, or category-full
    BRIDGE->>QUEUE: notify({ kind: 'vault', action, duration, product })
    QUEUE->>QUEUE: append id and createdAt
    alt Queue exceeds MAX_VISIBLE
      QUEUE->>QUEUE: dismiss oldest non-dismissing toast
    end
    QUEUE-->>MOUNT: nanostore update
    MOUNT->>TOAST: render toast row
    TOAST-->>U: show animated toast with product image and status pill
  else Action is cleared-category or cleared-all
    BRIDGE->>BRIDGE: skip toast when clear count is zero
  end

  opt Auto-dismiss duration expires
    TIMER->>QUEUE: dismiss(id)
    QUEUE->>QUEUE: set dismissing=true
    QUEUE-->>TOAST: apply exit class
    TIMER->>QUEUE: remove after EXIT_ANIMATION_MS
  end

  opt Manual dismissal
    U->>TOAST: click close button or press Escape
    TOAST->>QUEUE: dismiss(id)
  end

  Note over BRIDGE,QUEUE: Only vault notifications are live in this snapshot. `Notification` is still a single-variant union, despite comments reserving future auth or generic variants.
```

## State Transitions

- `initVaultBridge()` is idempotent. The `_initialized` guard prevents duplicate
  subscriptions when the boot path runs more than once.
- `notify()` stamps `id` and `createdAt`, then schedules auto-dismiss when
  `duration > 0`.
- `dismiss()` is a two-step transition: first mark `dismissing`, then remove the
  toast after `EXIT_ANIMATION_MS` so the CSS exit animation can complete.
- `MAX_VISIBLE` is enforced by dismissing the oldest non-dismissing toast once
  a fourth toast is queued.

## Error Paths and Boundaries

- `VaultToast.tsx` uses `tryImageFallback()` if the primary thumbnail URL fails.
- Zero-count clear operations intentionally produce no toast.
- Notifications are not replayed after reload because no persistence boundary
  exists beyond the in-memory nanostore queue.
