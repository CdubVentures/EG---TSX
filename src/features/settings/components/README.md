# src/features/settings/components

## Purpose

`src/features/settings/components/` owns the settings dialog and its form
controls.

## Public API (The Contract)

- `SettingsDialog.tsx`
- `SettingsPanel.tsx`
- `RadioGroup.tsx`
- `ToggleSwitch.tsx`

## Dependencies

Allowed imports:

- Public settings feature modules
- `@shared/*`
- React and browser APIs

## Mutation Boundaries

- May update local UI state and documented settings stores only.

## Domain Invariants

- Settings UI remains client-side; persisted settings contracts stay in the
  feature store/config path.
