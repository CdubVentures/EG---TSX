import { atom } from 'nanostores';
import { $auth } from '@features/auth';
import {
  $vault,
  switchPersona,
  setVaultState,
  getCurrentScope,
  _flushToStorage,
} from './store.ts';
import type { VaultEntry, VaultSyncState, VaultStorageScope } from './types.ts';
import { vaultRevKey, vaultThumbRefreshKey } from './types.ts';
import { mergeVaults } from './merge.ts';
import {
  VaultGetResponseSchema,
  VaultPutResponseSchema,
  VaultThumbResolveResponseSchema,
} from './server/schema.ts';
import {
  applyThumbResolveResult,
  buildThumbResolveRequest,
  shouldRefreshThumbCache,
} from './thumbs.ts';

export const $vaultSync = atom<VaultSyncState>({
  persona: 'guest',
  rev: 0,
  syncing: false,
  error: null,
});

let _initialized = false;
let _pushTimer: ReturnType<typeof setTimeout> | undefined;
let _unsubAuth: (() => void) | undefined;
let _unsubVault: (() => void) | undefined;
let _channel: BroadcastChannel | null = null;
let _suspended = false;
let _pushing = false;
let _pushDirty = false;
let _fromBroadcast = false;
let _refreshingThumbs = false;

const PUSH_DEBOUNCE_MS = 120;
const PULL_THROTTLE_MS = 5_000;
const BROADCAST_CHANNEL = 'eg-vault-sync';

export function initVaultSync(): void {
  if (_initialized) return;
  if (typeof window === 'undefined') return;
  _initialized = true;

  _unsubAuth = $auth.listen(handleAuthChange);
  _unsubVault = $vault.listen(handleVaultChange);

  if (typeof BroadcastChannel !== 'undefined') {
    _channel = new BroadcastChannel(BROADCAST_CHANNEL);
    _channel.onmessage = handleBroadcastMessage;
  }

  window.addEventListener('storage', handleStorageEvent);
  document.addEventListener('visibilitychange', handleVisibility);

  const authState = $auth.get();
  if (authState.status === 'authenticated') {
    handleAuthChange(authState);
  } else {
    void refreshVaultThumbnails();
  }
}

interface AuthState {
  status: 'guest' | 'loading' | 'authenticated';
  uid: string;
}

let _lastAuthUid: string | null = null;

function handleAuthChange(state: AuthState): void {
  if (state.status === 'loading') return;

  if (state.status === 'authenticated' && state.uid !== _lastAuthUid) {
    _lastAuthUid = state.uid;
    void onAuthenticated(state.uid);
  } else if (state.status === 'guest' && _lastAuthUid !== null) {
    _lastAuthUid = null;
    onLogout();
  }
}

async function onAuthenticated(uid: string): Promise<void> {
  _suspended = false;

  const isFirst = document.cookie.indexOf('eg_first=1') !== -1;
  if (isFirst) {
    await handleFirstLogin(uid);
  } else {
    switchPersona(uid);
    await pullFromServer(uid);
  }

  await refreshVaultThumbnails(true);
}

function onLogout(): void {
  clearTimeout(_pushTimer);
  switchPersona('guest');
  $vaultSync.set({ persona: 'guest', rev: 0, syncing: false, error: null });
  void refreshVaultThumbnails(true);
}

async function handleFirstLogin(uid: string): Promise<void> {
  const guestEntries = [...$vault.get().entries];

  switchPersona(uid);
  const serverData = await fetchServerVault(uid);

  if (serverData) {
    const merged = mergeVaults(guestEntries, serverData.compare);
    setVaultState({ entries: merged });
    _flushToStorage();
    await pushToServer();
  }

  if (typeof globalThis.localStorage !== 'undefined') {
    globalThis.localStorage.removeItem('eg-vault:guest');
  }

  document.cookie = 'eg_first=; Path=/; Max-Age=0';
}

export { mergeVaults } from './merge.ts';

function getThumbRefreshAt(scope: VaultStorageScope): number {
  if (typeof globalThis.localStorage === 'undefined') return 0;
  const raw = globalThis.localStorage.getItem(vaultThumbRefreshKey(scope));
  return raw ? parseInt(raw, 10) || 0 : 0;
}

function setThumbRefreshAt(scope: VaultStorageScope, timestamp: number): void {
  if (typeof globalThis.localStorage === 'undefined') return;
  globalThis.localStorage.setItem(vaultThumbRefreshKey(scope), String(timestamp));
}

async function refreshVaultThumbnails(force = false): Promise<void> {
  if (typeof window === 'undefined') return;
  if (_refreshingThumbs) return;

  const scope = getCurrentScope();
  const now = Date.now();
  const lastRefreshAt = getThumbRefreshAt(scope);
  if (!force && !shouldRefreshThumbCache(lastRefreshAt, now)) return;

  const currentEntries = $vault.get().entries;
  if (currentEntries.length === 0) {
    setThumbRefreshAt(scope, now);
    return;
  }

  const requestBody = buildThumbResolveRequest(currentEntries);
  if (requestBody.items.length === 0) {
    setThumbRefreshAt(scope, now);
    return;
  }

  _refreshingThumbs = true;
  try {
    const res = await fetch('/api/vault/thumbs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify(requestBody),
    });
    if (!res.ok) return;

    const json: unknown = await res.json();
    const parsed = VaultThumbResolveResponseSchema.safeParse(json);
    if (!parsed.success) return;

    const applied = applyThumbResolveResult($vault.get().entries, parsed.data.items);
    if (applied.changed) {
      setVaultState({ entries: applied.entries });
      _flushToStorage();
    }

    setThumbRefreshAt(scope, now);
  } catch {
    // Network or parse error. Keep existing snapshots.
  } finally {
    _refreshingThumbs = false;
  }
}

async function fetchServerVault(uid: string): Promise<{ compare: VaultEntry[]; builds: unknown[]; rev: number } | null> {
  if (_suspended) return null;

  try {
    const rev = getLocalRev(uid);
    const url = rev > 0 ? `/api/user/vault?rev=${rev}` : '/api/user/vault';
    const res = await fetch(url, { credentials: 'same-origin' });

    if (res.status === 304) return null;
    if (res.status === 401) {
      _suspended = true;
      $vaultSync.set({ ...$vaultSync.get(), error: 'unauthorized', syncing: false });
      return null;
    }
    if (!res.ok) return null;

    const json: unknown = await res.json();
    const parsed = VaultGetResponseSchema.safeParse(json);
    if (!parsed.success) return null;

    setLocalRev(uid, parsed.data.rev);
    $vaultSync.set({ ...$vaultSync.get(), rev: parsed.data.rev, syncing: false, error: null });
    return parsed.data;
  } catch {
    return null;
  }
}

export async function pullFromServer(uid: string): Promise<void> {
  $vaultSync.set({ ...$vaultSync.get(), syncing: true });

  const data = await fetchServerVault(uid);
  if (data) {
    setVaultState({ entries: data.compare });
    _flushToStorage();
    $vaultSync.set({ persona: uid, rev: data.rev, syncing: false, error: null });
  } else {
    $vaultSync.set({ ...$vaultSync.get(), persona: uid, syncing: false });
  }

  await refreshVaultThumbnails();
}

export async function pushToServer(): Promise<void> {
  const scope = getCurrentScope();
  if (scope === 'guest' || _suspended || _pushing) return;

  _pushing = true;
  $vaultSync.set({ ...$vaultSync.get(), syncing: true });

  try {
    const entries = $vault.get().entries;
    const res = await fetch('/api/user/vault', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({ compare: entries }),
    });

    if (res.status === 401) {
      _suspended = true;
      $vaultSync.set({ ...$vaultSync.get(), syncing: false, error: 'unauthorized' });
      return;
    }

    if (!res.ok) {
      $vaultSync.set({ ...$vaultSync.get(), syncing: false, error: `push failed: ${res.status}` });
      return;
    }

    const json: unknown = await res.json();
    const parsed = VaultPutResponseSchema.safeParse(json);
    if (parsed.success && parsed.data.rev) {
      setLocalRev(scope, parsed.data.rev);
      $vaultSync.set({ ...$vaultSync.get(), rev: parsed.data.rev, syncing: false, error: null });
    }
  } catch {
    $vaultSync.set({ ...$vaultSync.get(), syncing: false, error: 'network error' });
  } finally {
    _pushing = false;
    if (_pushDirty) {
      _pushDirty = false;
      clearTimeout(_pushTimer);
      _pushTimer = setTimeout(pushToServer, PUSH_DEBOUNCE_MS);
    }
  }
}

function handleVaultChange(): void {
  if (_fromBroadcast) return;

  broadcastChange();

  const scope = getCurrentScope();
  if (scope === 'guest' || _suspended) return;

  if (_pushing) {
    _pushDirty = true;
    return;
  }

  clearTimeout(_pushTimer);
  _pushTimer = setTimeout(() => {
    if (document.visibilityState === 'visible') {
      void pushToServer();
    }
  }, PUSH_DEBOUNCE_MS);
}

interface BroadcastPayload {
  scope: VaultStorageScope;
  entries: VaultEntry[];
}

function broadcastChange(): void {
  if (!_channel) return;
  try {
    const payload: BroadcastPayload = {
      scope: getCurrentScope(),
      entries: $vault.get().entries,
    };
    _channel.postMessage(payload);
  } catch {
    // Channel closed.
  }
}

function handleBroadcastMessage(e: MessageEvent<BroadcastPayload>): void {
  const { scope, entries } = e.data;
  if (scope !== getCurrentScope()) return;
  _fromBroadcast = true;
  setVaultState({ entries });
  _fromBroadcast = false;
}

function handleStorageEvent(e: StorageEvent): void {
  if (!e.key?.startsWith('eg-vault:')) return;
  const scope = getCurrentScope();
  const expectedKey = `eg-vault:${scope}`;
  if (e.key !== expectedKey) return;

  try {
    const parsed = e.newValue ? JSON.parse(e.newValue) : { entries: [] };
    if (parsed && Array.isArray(parsed.entries)) {
      _fromBroadcast = true;
      setVaultState({ entries: parsed.entries });
      _fromBroadcast = false;
    }
  } catch {
    // Invalid JSON.
  }
}

let _lastPullAt = 0;

function handleVisibility(): void {
  if (document.visibilityState !== 'visible') return;

  void refreshVaultThumbnails();

  const scope = getCurrentScope();
  if (scope === 'guest' || _suspended) return;

  const now = Date.now();
  if (now - _lastPullAt < PULL_THROTTLE_MS) return;
  _lastPullAt = now;

  void pullFromServer(scope);
}

function getLocalRev(uid: string): number {
  if (typeof globalThis.localStorage === 'undefined') return 0;
  const raw = globalThis.localStorage.getItem(vaultRevKey(uid));
  return raw ? parseInt(raw, 10) || 0 : 0;
}

function setLocalRev(uid: string, rev: number): void {
  if (typeof globalThis.localStorage === 'undefined') return;
  globalThis.localStorage.setItem(vaultRevKey(uid), String(rev));
}

export function _teardownSync(): void {
  _unsubAuth?.();
  _unsubVault?.();
  _channel?.close();
  _channel = null;
  clearTimeout(_pushTimer);
  _initialized = false;
  _lastAuthUid = null;
  _suspended = false;
  _pushing = false;
  _pushDirty = false;
  _fromBroadcast = false;
  _refreshingThumbs = false;
  _lastPullAt = 0;
  if (typeof window !== 'undefined') {
    window.removeEventListener('storage', handleStorageEvent);
    document.removeEventListener('visibilitychange', handleVisibility);
  }
}
