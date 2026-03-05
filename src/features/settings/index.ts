/** Settings feature — public API */

export { $settingsDialog, $userPrefs, $theme, openSettings, closeSettings, loadPrefs, setPref, pushPrefs, setTheme, loadTheme } from './store';
export type { PreferenceKey, HubDisplayMode, UserPreferences, ThemeMode } from './types';
export { DEFAULT_PREFS, prefsStorageKey } from './types';
