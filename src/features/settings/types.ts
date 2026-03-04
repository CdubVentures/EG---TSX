/** Settings types — SSOT for all settings consumers. */

export type PreferenceKey = 'usePopupSnapshot' | 'displayHubResults' | 'defaultHubDisplay';

export type HubDisplayMode = 'grid' | 'brandRows';

export interface UserPreferences {
  usePopupSnapshot: boolean;
  displayHubResults: HubDisplayMode;
  defaultHubDisplay: HubDisplayMode;
}

export const DEFAULT_PREFS: UserPreferences = {
  usePopupSnapshot: false,
  displayHubResults: 'brandRows',
  defaultHubDisplay: 'brandRows',
};

/** Build namespaced localStorage key matching HBS format: `{uid}|{key}` */
export function prefsStorageKey(uid: string, key: PreferenceKey): string {
  return `${uid}|${key}`;
}
