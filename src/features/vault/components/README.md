# src/features/vault/components

## Purpose

`src/features/vault/components/` contains the client vault controls rendered in
cards, nav, and overlays.

## Public API (The Contract)

- `VaultToggleButton.tsx`
- `VaultDropdown.tsx`
- `VaultCount.tsx`

## Dependencies

Allowed imports:

- Public vault feature stores/actions
- `@shared/*`
- React and browser APIs

## Mutation Boundaries

- May update local UI state and dispatch public vault actions.

## Domain Invariants

- Vault components render and trigger vault behavior but do not own merge or
  persistence rules.
