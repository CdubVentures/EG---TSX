// ─── Settings Store Tests ────────────────────────────────────────────────────
// Contract: Nano Store atoms for settings dialog + user preferences with
// uid-scoped localStorage. HBS-compatible key format: `{uid}|{key}`.
// Runner: node --import tsx --test

import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
// ─── Mock browser globals ───────────────────────────────────────────────────

class MockStorage {
  constructor() { this.store = new Map(); }
  getItem(key) { return this.store.get(key) ?? null; }
  setItem(key, value) { this.store.set(key, String(value)); }
  removeItem(key) { this.store.delete(key); }
  clear() { this.store.clear(); }
  get length() { return this.store.size; }
  key(index) { return [...this.store.keys()][index] ?? null; }
}

// WHY: Node has no globalThis.addEventListener — provide a minimal EventTarget.
const _eventTarget = new EventTarget();
globalThis.addEventListener = globalThis.addEventListener ?? _eventTarget.addEventListener.bind(_eventTarget);
globalThis.removeEventListener = globalThis.removeEventListener ?? _eventTarget.removeEventListener.bind(_eventTarget);
globalThis.dispatchEvent = globalThis.dispatchEvent ?? _eventTarget.dispatchEvent.bind(_eventTarget);

// WHY: store.ts guards with `typeof window !== 'undefined'` for SSR safety.
// In Node tests we need this to be truthy so window.closeSettingsPopup is set.
globalThis.window = globalThis.window ?? globalThis;

// WHY: auth store's $auth.listen() toggles document.documentElement.classList.
// setTheme() uses setAttribute on documentElement and querySelector for meta[name="theme-color"].
globalThis.document = globalThis.document ?? {
  documentElement: {
    classList: { toggle() {}, contains() { return false; } },
    setAttribute(name, value) { this[`_${name}`] = value; },
    getAttribute(name) { return this[`_${name}`] ?? null; },
  },
  readyState: 'complete',
  addEventListener() {},
  cookie: '',
  querySelector(sel) {
    // WHY: setTheme() updates <meta name="theme-color">. Return a mock element.
    if (sel === 'meta[name="theme-color"]') return globalThis._mockThemeMeta;
    return null;
  },
};

// ─── Dynamic import (fresh module per test) ─────────────────────────────────
// WHY: nanostores atoms are module-level singletons. Cache-bust to get fresh state.

let importCounter = 0;

async function freshStore() {
  importCounter++;
  const mod = await import(`../store.ts?test=${importCounter}`);
  return mod;
}

// ─── Event capture helper ────────────────────────────────────────────────────

function captureEvents(eventName) {
  const events = [];
  const handler = (e) => events.push(e.detail);
  globalThis.addEventListener(eventName, handler);
  return { events, cleanup: () => globalThis.removeEventListener(eventName, handler) };
}

// ─── Tests ──────────────────────────────────────────────────────────────────

const DEFAULT_PREFS = {
  usePopupSnapshot: false,
  displayHubResults: 'brandRows',
  defaultHubDisplay: 'brandRows',
};

describe('$settingsDialog atom', () => {
  beforeEach(() => {
    globalThis.localStorage = new MockStorage();
  });

  it('initial state is { open: false }', async () => {
    const { $settingsDialog } = await freshStore();
    assert.deepStrictEqual($settingsDialog.get(), { open: false });
  });

  it('openSettings() sets open: true', async () => {
    const { $settingsDialog, openSettings } = await freshStore();
    openSettings();
    assert.deepStrictEqual($settingsDialog.get(), { open: true });
  });

  it('closeSettings() sets open: false', async () => {
    const { $settingsDialog, openSettings, closeSettings } = await freshStore();
    openSettings();
    closeSettings();
    assert.deepStrictEqual($settingsDialog.get(), { open: false });
  });

  it('double openSettings() is idempotent', async () => {
    const { $settingsDialog, openSettings } = await freshStore();
    openSettings();
    openSettings();
    assert.deepStrictEqual($settingsDialog.get(), { open: true });
  });

  it('closeSettings() when already closed is idempotent', async () => {
    const { $settingsDialog, closeSettings } = await freshStore();
    closeSettings();
    assert.deepStrictEqual($settingsDialog.get(), { open: false });
  });
});

describe('$userPrefs atom', () => {
  beforeEach(() => {
    globalThis.localStorage = new MockStorage();
  });

  it('initial state is DEFAULT_PREFS', async () => {
    const { $userPrefs } = await freshStore();
    assert.deepStrictEqual($userPrefs.get(), DEFAULT_PREFS);
  });
});

describe('loadPrefs()', () => {
  beforeEach(() => {
    globalThis.localStorage = new MockStorage();
  });

  it('reads prefs from localStorage for guest uid', async () => {
    globalThis.localStorage.setItem('guest|usePopupSnapshot', 'true');
    globalThis.localStorage.setItem('guest|displayHubResults', 'grid');
    globalThis.localStorage.setItem('guest|defaultHubDisplay', 'grid');

    const { $userPrefs, loadPrefs } = await freshStore();
    loadPrefs();
    assert.deepStrictEqual($userPrefs.get(), {
      usePopupSnapshot: true,
      displayHubResults: 'grid',
      defaultHubDisplay: 'grid',
    });
  });

  it('returns defaults for empty localStorage', async () => {
    const { $userPrefs, loadPrefs } = await freshStore();
    loadPrefs();
    assert.deepStrictEqual($userPrefs.get(), DEFAULT_PREFS);
  });

  it('fills in defaults for partial localStorage', async () => {
    globalThis.localStorage.setItem('guest|usePopupSnapshot', 'true');
    // other keys missing

    const { $userPrefs, loadPrefs } = await freshStore();
    loadPrefs();
    assert.deepStrictEqual($userPrefs.get(), {
      usePopupSnapshot: true,
      displayHubResults: 'brandRows',
      defaultHubDisplay: 'brandRows',
    });
  });

  it('treats corrupted boolean ("garbage") as default false', async () => {
    globalThis.localStorage.setItem('guest|usePopupSnapshot', 'garbage');

    const { $userPrefs, loadPrefs } = await freshStore();
    loadPrefs();
    assert.strictEqual($userPrefs.get().usePopupSnapshot, false);
  });

  it('treats corrupted display mode as default brandRows', async () => {
    globalThis.localStorage.setItem('guest|displayHubResults', 'invalid');

    const { $userPrefs, loadPrefs } = await freshStore();
    loadPrefs();
    assert.strictEqual($userPrefs.get().displayHubResults, 'brandRows');
  });

  it('boolean string "false" reads as false', async () => {
    globalThis.localStorage.setItem('guest|usePopupSnapshot', 'false');

    const { $userPrefs, loadPrefs } = await freshStore();
    loadPrefs();
    assert.strictEqual($userPrefs.get().usePopupSnapshot, false);
  });

  it('boolean string "true" reads as true', async () => {
    globalThis.localStorage.setItem('guest|usePopupSnapshot', 'true');

    const { $userPrefs, loadPrefs } = await freshStore();
    loadPrefs();
    assert.strictEqual($userPrefs.get().usePopupSnapshot, true);
  });
});

describe('setPref()', () => {
  /** @type {ReturnType<typeof captureEvents>} */
  let capture;

  beforeEach(() => {
    globalThis.localStorage = new MockStorage();
    capture = captureEvents('hubSettingsChanged');
  });

  afterEach(() => {
    capture.cleanup();
  });

  it('updates atom for boolean pref', async () => {
    const { $userPrefs, setPref } = await freshStore();
    setPref('usePopupSnapshot', true);
    assert.strictEqual($userPrefs.get().usePopupSnapshot, true);
  });

  it('updates atom for display mode pref', async () => {
    const { $userPrefs, setPref } = await freshStore();
    setPref('displayHubResults', 'grid');
    assert.strictEqual($userPrefs.get().displayHubResults, 'grid');
  });

  it('writes to localStorage with uid-scoped key', async () => {
    const { setPref } = await freshStore();
    setPref('usePopupSnapshot', true);
    assert.strictEqual(globalThis.localStorage.getItem('guest|usePopupSnapshot'), 'true');
  });

  it('writes boolean as string "true"/"false" for HBS compat', async () => {
    const { setPref } = await freshStore();
    setPref('usePopupSnapshot', false);
    assert.strictEqual(globalThis.localStorage.getItem('guest|usePopupSnapshot'), 'false');
  });

  it('dispatches hubSettingsChanged event', async () => {
    const { setPref } = await freshStore();
    setPref('usePopupSnapshot', true);

    assert.strictEqual(capture.events.length, 1);
    assert.deepStrictEqual(capture.events[0], {
      key: 'usePopupSnapshot',
      value: 'true',
    });
  });

  it('dispatches hubSettingsChanged with string value for display mode', async () => {
    const { setPref } = await freshStore();
    setPref('displayHubResults', 'grid');

    assert.strictEqual(capture.events.length, 1);
    assert.deepStrictEqual(capture.events[0], {
      key: 'displayHubResults',
      value: 'grid',
    });
  });

  it('multiple setPref calls accumulate correctly', async () => {
    const { $userPrefs, setPref } = await freshStore();
    setPref('usePopupSnapshot', true);
    setPref('displayHubResults', 'grid');
    setPref('defaultHubDisplay', 'grid');

    assert.deepStrictEqual($userPrefs.get(), {
      usePopupSnapshot: true,
      displayHubResults: 'grid',
      defaultHubDisplay: 'grid',
    });
  });
});

describe('auth namespace isolation', () => {
  beforeEach(() => {
    globalThis.localStorage = new MockStorage();
  });

  it('guest prefs use "guest|" prefix', async () => {
    const { setPref } = await freshStore();
    setPref('usePopupSnapshot', true);
    assert.strictEqual(globalThis.localStorage.getItem('guest|usePopupSnapshot'), 'true');
  });

  it('authenticated user prefs use "{uid}|" prefix', async () => {
    // WHY: import auth WITHOUT cache-bust — settings store shares this singleton
    const authMod = await import('../../auth/store.ts');
    authMod.setAuthenticated('user-42', 'test@test.com', 'tester');

    const { setPref, loadPrefs } = await freshStore();
    loadPrefs(); // pick up the new uid
    setPref('usePopupSnapshot', true);

    assert.strictEqual(globalThis.localStorage.getItem('user-42|usePopupSnapshot'), 'true');
    assert.strictEqual(globalThis.localStorage.getItem('guest|usePopupSnapshot'), null);

    // cleanup
    authMod.setGuest();
  });

  it('switching from guest to authenticated loads user-scoped prefs', async () => {
    // WHY: import auth WITHOUT cache-bust — settings store shares this singleton
    const authMod = await import('../../auth/store.ts');
    authMod.setGuest(); // ensure guest state first

    // Seed guest prefs
    globalThis.localStorage.setItem('guest|usePopupSnapshot', 'true');
    // Seed user prefs (different values)
    globalThis.localStorage.setItem('user-42|usePopupSnapshot', 'false');
    globalThis.localStorage.setItem('user-42|displayHubResults', 'grid');

    const { $userPrefs, loadPrefs } = await freshStore();
    loadPrefs(); // loads guest
    assert.strictEqual($userPrefs.get().usePopupSnapshot, true);

    // Now simulate auth change — store should read user-42 namespace
    authMod.setAuthenticated('user-42', 'test@test.com', 'tester');

    // loadPrefs must be called after auth change
    loadPrefs();
    assert.strictEqual($userPrefs.get().usePopupSnapshot, false);
    assert.strictEqual($userPrefs.get().displayHubResults, 'grid');

    // cleanup
    authMod.setGuest();
  });
});

describe('pushPrefs() stub', () => {
  beforeEach(() => {
    globalThis.localStorage = new MockStorage();
  });

  it('is a no-op that returns a resolved promise', async () => {
    const { pushPrefs } = await freshStore();
    const result = await pushPrefs({ usePopupSnapshot: true });
    assert.strictEqual(result, undefined);
  });
});

describe('window.closeSettingsPopup', () => {
  beforeEach(() => {
    globalThis.localStorage = new MockStorage();
  });

  it('is exposed as a global function', async () => {
    await freshStore();
    assert.strictEqual(typeof globalThis.closeSettingsPopup, 'function');
  });

  it('closes the dialog when called', async () => {
    const { $settingsDialog, openSettings } = await freshStore();
    openSettings();
    assert.strictEqual($settingsDialog.get().open, true);
    globalThis.closeSettingsPopup();
    assert.strictEqual($settingsDialog.get().open, false);
  });
});

// ─── Theme Tests ────────────────────────────────────────────────────────────
// Contract: $theme atom + setTheme()/loadTheme() for device-level theme.
// Theme is NOT uid-scoped — stored as 'eg-theme' in localStorage.
// Mapping: 'light' → data-theme='default', 'dark' → data-theme='gaming'.

describe('$theme atom', () => {
  beforeEach(() => {
    globalThis.localStorage = new MockStorage();
  });

  it('initial state is "dark"', async () => {
    const { $theme } = await freshStore();
    assert.strictEqual($theme.get(), 'dark');
  });
});

describe('setTheme()', () => {
  /** @type {{ setAttribute(n: string, v: string): void, getAttribute(n: string): string | null }} */
  let docEl;

  beforeEach(() => {
    globalThis.localStorage = new MockStorage();
    // WHY: reset documentElement attrs before each test
    docEl = globalThis.document.documentElement;
    delete docEl['_data-theme'];
    // Mock meta[name="theme-color"]
    globalThis._mockThemeMeta = { setAttribute(_, v) { this._content = v; }, _content: null };
  });

  afterEach(() => {
    globalThis._mockThemeMeta = undefined;
  });

  it('setTheme("light") updates atom to "light"', async () => {
    const { $theme, setTheme } = await freshStore();
    setTheme('light');
    assert.strictEqual($theme.get(), 'light');
  });

  it('setTheme("dark") updates atom to "dark"', async () => {
    const { $theme, setTheme } = await freshStore();
    setTheme('light');
    setTheme('dark');
    assert.strictEqual($theme.get(), 'dark');
  });

  it('setTheme("light") writes eg-theme="default" to localStorage', async () => {
    const { setTheme } = await freshStore();
    setTheme('light');
    assert.strictEqual(globalThis.localStorage.getItem('eg-theme'), 'default');
  });

  it('setTheme("dark") writes eg-theme="gaming" to localStorage', async () => {
    const { setTheme } = await freshStore();
    setTheme('dark');
    assert.strictEqual(globalThis.localStorage.getItem('eg-theme'), 'gaming');
  });

  it('setTheme() sets data-theme attribute on documentElement', async () => {
    const { setTheme } = await freshStore();
    setTheme('light');
    assert.strictEqual(docEl.getAttribute('data-theme'), 'default');
    setTheme('dark');
    assert.strictEqual(docEl.getAttribute('data-theme'), 'gaming');
  });

  it('setTheme() updates meta[name="theme-color"] content', async () => {
    const { setTheme } = await freshStore();
    setTheme('light');
    assert.ok(globalThis._mockThemeMeta._content, 'meta theme-color should be set');
    const lightColor = globalThis._mockThemeMeta._content;

    setTheme('dark');
    const darkColor = globalThis._mockThemeMeta._content;

    // Light and dark should produce different theme-color values
    assert.notStrictEqual(lightColor, darkColor);
  });
});

describe('loadTheme()', () => {
  beforeEach(() => {
    globalThis.localStorage = new MockStorage();
  });

  it('reads "default" from localStorage and sets atom to "light"', async () => {
    globalThis.localStorage.setItem('eg-theme', 'default');
    const { $theme, loadTheme } = await freshStore();
    loadTheme();
    assert.strictEqual($theme.get(), 'light');
  });

  it('reads "gaming" from localStorage and sets atom to "dark"', async () => {
    globalThis.localStorage.setItem('eg-theme', 'gaming');
    const { $theme, loadTheme } = await freshStore();
    loadTheme();
    assert.strictEqual($theme.get(), 'dark');
  });

  it('defaults to "dark" when no saved value', async () => {
    // localStorage has no 'eg-theme' key
    const { $theme, loadTheme } = await freshStore();
    loadTheme();
    assert.strictEqual($theme.get(), 'dark');
  });

  it('defaults to "dark" for unknown saved value', async () => {
    globalThis.localStorage.setItem('eg-theme', 'garbage');
    const { $theme, loadTheme } = await freshStore();
    loadTheme();
    assert.strictEqual($theme.get(), 'dark');
  });
});
