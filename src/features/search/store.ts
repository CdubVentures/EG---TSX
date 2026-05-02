// ─── Search Store — Nano Store atom for search dialog state ──────────────────
// Same pattern as settings/store.ts and auth/store.ts.

import { atom } from 'nanostores';

export const $searchOpen = atom(false);

export function openSearch(): void {
  // WHY: close other popups before opening search (same as account dropdown pattern)
  if (typeof window !== 'undefined') {
    const w = window as unknown as Record<string, unknown>;
    if (typeof w.closeAccountDropdown === 'function') {
      (w.closeAccountDropdown as () => void)();
    }
    if (typeof w.closeSettingsPopup === 'function') {
      (w.closeSettingsPopup as () => void)();
    }
  }
  $searchOpen.set(true);
}

export function closeSearch(): void {
  $searchOpen.set(false);
}

// WHY: other nav popups call closeSearchPopup() to dismiss search
if (typeof window !== 'undefined') {
  (window as unknown as Record<string, unknown>).closeSearchPopup = closeSearch;
}
