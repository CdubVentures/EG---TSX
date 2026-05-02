# src/features/notifications/components

## Purpose

`src/features/notifications/components/` owns toast UI rendered by the
notifications feature.

## Public API (The Contract)

- `ToastContainer.tsx`
- `VaultToast.tsx`

## Dependencies

Allowed imports:

- Public notification and vault feature contracts
- `@shared/*`
- React and browser APIs

## Mutation Boundaries

- May subscribe to feature stores and manage ephemeral toast UI state.

## Domain Invariants

- Notification components render transient UI only; canonical state lives in the
  owning feature stores.
