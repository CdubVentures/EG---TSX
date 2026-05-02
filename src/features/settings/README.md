# src/features/settings

## Purpose

Owns the site settings dialog, theme selection, and local user preferences for
hub behavior.

## Public API (The Contract)

- `index.ts`
  Exports `$settingsDialog`, `$userPrefs`, `$theme`, `openSettings()`,
  `closeSettings()`, `loadPrefs()`, `setPref()`, `pushPrefs()`, `setTheme()`,
  `loadTheme()`, `PreferenceKey`, `HubDisplayMode`, `UserPreferences`,
  `ThemeMode`, `DEFAULT_PREFS`, and `prefsStorageKey()`.
- `components/SettingsDialog.tsx`
- `components/SettingsPanel.tsx`
- `components/ToggleSwitch.tsx`
- `components/RadioGroup.tsx`

## Dependencies

Allowed imports:

- `@features/auth/store`
- `@shared/lib/cn`
- Browser APIs, `nanostores`, and React

Forbidden imports:

- Server-only modules
- Unrelated feature internals

## Mutation Boundaries

- May read/write localStorage for theme and user preference keys.
- May dispatch the documented `hubSettingsChanged` browser event.
- Must not write project files or server data.

## Domain Invariants

- Theme state is device-level and stored under `eg-theme`.
- Hub preferences are UID-scoped when the user is authenticated.
- The dialog owns ephemeral UI state only; canonical site state stays elsewhere.

## Local Sub-Boundaries

- [components/README.md](components/README.md)
- [tests/README.md](tests/README.md)
