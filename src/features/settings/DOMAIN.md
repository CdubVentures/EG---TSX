# Settings Feature Domain

## Purpose
User hub preferences + device-level theme toggle.
Hub prefs persist to uid-scoped localStorage. Theme persists to device-level `eg-theme` key.
Server sync deferred to Phase 9.

## Public API (`index.ts`)

| Export | Type | Description |
|--------|------|-------------|
| `$settingsDialog` | `Atom<{ open }>` | Dialog open/close state |
| `$userPrefs` | `Atom<UserPreferences>` | Current preferences |
| `$theme` | `Atom<ThemeMode>` | Current theme ('light' or 'dark') |
| `openSettings()` | `() => void` | Open dialog |
| `closeSettings()` | `() => void` | Close dialog |
| `loadPrefs()` | `() => void` | Read uid-scoped localStorage → atom |
| `setPref(key, value)` | `(K, V) => void` | Update atom + localStorage + event |
| `setTheme(mode)` | `(ThemeMode) => void` | Update atom + DOM + localStorage |
| `loadTheme()` | `() => void` | Read `eg-theme` from localStorage → atom |
| `pushPrefs(partial)` | Stub | No-op until Phase 9 |

## Boundary Dependencies

- **Imports from:** `@features/auth/store` ($auth for uid scoping, openSignup/openLogin for guest CTA)
- **Imports from:** `@shared/lib/cn` (className utility)
- **Consumed by:** `MainLayout.astro` (mount + loadTheme), `NavIcons.astro` (trigger)
- **Events emitted:** `hubSettingsChanged` CustomEvent (consumed by Phase 6 hub)
- **Global:** `window.closeSettingsPopup` (account dropdown integration)

## localStorage Contract

**Hub prefs (uid-scoped, HBS-compatible):**
Keys: `{uid}|usePopupSnapshot`, `{uid}|displayHubResults`, `{uid}|defaultHubDisplay`
Values: `"true"/"false"` for booleans, `"grid"/"brandRows"` for modes.

**Theme (device-level):**
Key: `eg-theme`. Values: `"default"` (light) or `"gaming"` (dark).

## Component Hierarchy

```
SettingsDialog.tsx  ← <dialog> shell, always single-column
  └── SettingsPanel.tsx  ← All content
        ├── Close button
        ├── "Settings" heading
        ├── Appearance section (SectionCard)
        │     └── ThemeToggle [Light | Dark] segmented control
        ├── Hub Settings section (SectionCard)
        │     ├── Lock badge (guest only)
        │     ├── ToggleSwitch (usePopupSnapshot) — disabled if guest
        │     ├── RadioGroup (displayHubResults) — disabled if guest
        │     ├── RadioGroup (defaultHubDisplay) — disabled if guest
        │     └── GuestCTA (guest only) — inline sign up / log in
        ├── ToggleSwitch.tsx  (reusable, supports disabled prop)
        └── RadioGroup.tsx    (reusable, supports disabled prop)
```

## CSS

Dialog animations in `global.css` — reuses `dialogSlideOut`/`dialogBackdropOut` keyframes.
Components use Tailwind + CSS variable references.
Dialog is always dark (`bg-[#1d2021]`) regardless of page theme.
