/**
 * Settings store — Nano Store atoms for settings dialog + user preferences.
 *
 * localStorage keys use HBS-compatible format: `{uid}|{key}`.
 * Values are stored as strings ("true"/"false" for booleans).
 */

import { atom } from 'nanostores';
import { $auth } from '../auth/store.ts';
import { DEFAULT_PREFS, prefsStorageKey } from './types.ts';
import type { PreferenceKey, HubDisplayMode, UserPreferences, ThemeMode } from './types.ts';

export type { PreferenceKey, HubDisplayMode, UserPreferences, ThemeMode };
export { DEFAULT_PREFS };

/* ── Settings Dialog State ─── */

export const $settingsDialog = atom<{ open: boolean }>({ open: false });

export function openSettings(): void {
  $settingsDialog.set({ open: true });
}

export function closeSettings(): void {
  $settingsDialog.set({ open: false });
}

/* ── User Preferences State ─── */

export const $userPrefs = atom<UserPreferences>({ ...DEFAULT_PREFS });

/** Get the current uid from the auth store. */
function currentUid(): string {
  return $auth.get().uid;
}

/** Parse a boolean value from localStorage string. Only "true" → true, everything else → false. */
function parseBool(raw: string | null): boolean {
  return raw === 'true';
}

/** Parse a display mode from localStorage string. Only "grid" → grid, everything else → "brandRows". */
function parseDisplayMode(raw: string | null): HubDisplayMode {
  return raw === 'grid' ? 'grid' : 'brandRows';
}

/** Read localStorage → atom (uses current $auth.uid). */
export function loadPrefs(): void {
  if (typeof localStorage === 'undefined') return;

  const uid = currentUid();
  $userPrefs.set({
    usePopupSnapshot: parseBool(localStorage.getItem(prefsStorageKey(uid, 'usePopupSnapshot'))),
    displayHubResults: parseDisplayMode(localStorage.getItem(prefsStorageKey(uid, 'displayHubResults'))),
    defaultHubDisplay: parseDisplayMode(localStorage.getItem(prefsStorageKey(uid, 'defaultHubDisplay'))),
  });
}

/** Update a single preference: atom + localStorage + dispatch hubSettingsChanged. */
export function setPref<K extends PreferenceKey>(
  key: K,
  value: UserPreferences[K],
): void {
  if (typeof localStorage === 'undefined') return;

  const uid = currentUid();
  const stringValue = String(value);

  // Update localStorage
  localStorage.setItem(prefsStorageKey(uid, key), stringValue);

  // Update atom
  $userPrefs.set({ ...$userPrefs.get(), [key]: value });

  // Dispatch event for hub pages (Phase 6)
  if (typeof dispatchEvent !== 'undefined') {
    dispatchEvent(new CustomEvent('hubSettingsChanged', {
      detail: { key, value: stringValue },
      bubbles: true,
      composed: true,
    }));
  }
}

/** Stub — no-op until Phase 9 server sync. */
export async function pushPrefs(_partial: Partial<UserPreferences>): Promise<void> {
  // Phase 9: PUT /api/user/prefs
}

/* ── Theme State ─── */
// WHY: Theme is device-level (not uid-scoped). Maps 'light'→'default', 'dark'→'gaming'
// to match existing data-theme values and flash-prevention script in MainLayout.astro.

const THEME_KEY = 'eg-theme';
const THEME_TO_DATA: Record<ThemeMode, string> = { light: 'default', dark: 'gaming' };
const DATA_TO_THEME: Record<string, ThemeMode> = { default: 'light', gaming: 'dark' };
const THEME_COLORS: Record<ThemeMode, string> = { light: '#ffffff', dark: '#141617' };

export const $theme = atom<ThemeMode>('dark');

/** Set theme: updates atom + DOM + localStorage. */
export function setTheme(mode: ThemeMode): void {
  $theme.set(mode);

  if (typeof localStorage === 'undefined') return;
  localStorage.setItem(THEME_KEY, THEME_TO_DATA[mode]);

  if (typeof document !== 'undefined') {
    document.documentElement.setAttribute('data-theme', THEME_TO_DATA[mode]);
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', THEME_COLORS[mode]);
  }
}

/** Read saved theme from localStorage into atom. */
export function loadTheme(): void {
  if (typeof localStorage === 'undefined') return;
  const saved = localStorage.getItem(THEME_KEY);
  const mapped = saved ? DATA_TO_THEME[saved] : undefined;
  $theme.set(mapped ?? 'dark');
}

/* ── Global integration ─── */

// WHY: guard against SSR (no window/localStorage on server)
if (typeof window !== 'undefined') {
  // Expose for account dropdown integration (NavIcons.astro:427)
  (window as unknown as Record<string, unknown>).closeSettingsPopup = closeSettings;
}
