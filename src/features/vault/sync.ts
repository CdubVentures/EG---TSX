// ─── Vault Sync Engine ──────────────────────────────────────────────────────
// Glue between vault store, auth store, and server. The vault store stays pure
// — it knows nothing about auth. This module orchestrates persona transitions,
// server sync, cross-tab broadcast, and first-login merge.

import { atom } from 'nanostores';
import { $auth } from '@features/auth/store';
import {
  $vault,
  switchPersona,
  setVaultState,
  getCurrentScope,
  _flushToStorage,
} from './store.ts';
import type { VaultEntry, VaultSyncState, VaultStorageScope } from './types.ts';
import { vaultRevKey } from './types.ts';
import { mergeVaults } from './merge.ts';
import { VaultGetResponseSchema, VaultPutResponseSchema } from './server/schema.ts';

// ─── Observable sync state ──────────────────────────────────────────────────

export const $vaultSync = atom<VaultSyncState>({
  persona: 'guest',
  rev: 0,
  syncing: false,
  error: null,
});

// ─── Internal state ─────────────────────────────────────────────────────────

let _initialized = false;
let _pushTimer: ReturnType<typeof setTimeout> | undefined;
let _unsubAuth: (() => void) | undefined;
let _unsubVault: (() => void) | undefined;
let _channel: BroadcastChannel | null = null;
let _suspended = false; // WHY: stops all server calls after a 401 until next auth transition
let _pushing = false;   // WHY: prevents concurrent push calls
let _pushDirty = false; // WHY: vault changed while push in-flight → schedule follow-up
let _fromBroadcast = false; // WHY: prevents broadcast → vault change → re-broadcast loop

const PUSH_DEBOUNCE_MS = 120;
const PULL_THROTTLE_MS = 5_000;
const BROADCAST_CHANNEL = 'eg-vault-sync';

// ─── Init ───────────────────────────────────────────────────────────────────

/** Idempotent — safe to call multiple times. Subscribes to $auth transitions. */
export function initVaultSync(): void {
  if (_initialized) return;
  if (typeof window === 'undefined') return; // SSR guard
  _initialized = true;

  // Subscribe to auth state changes
  _unsubAuth = $auth.listen(handleAuthChange);

  // Subscribe to vault changes for push + broadcast
  _unsubVault = $vault.listen(handleVaultChange);

  // BroadcastChannel for cross-tab sync
  if (typeof BroadcastChannel !== 'undefined') {
    _channel = new BroadcastChannel(BROADCAST_CHANNEL);
    _channel.onmessage = handleBroadcastMessage;
  }

  // Fallback: storage event for cross-tab (when BroadcastChannel unavailable)
  window.addEventListener('storage', handleStorageEvent);

  // Pull on visibility change (tab regains focus)
  document.addEventListener('visibilitychange', handleVisibility);

  // Process current auth state immediately
  const authState = $auth.get();
  if (authState.status === 'authenticated') {
    handleAuthChange(authState);
  }
}

// ─── Auth transition handler ────────────────────────────────────────────────

interface AuthState {
  status: 'guest' | 'loading' | 'authenticated';
  uid: string;
}

let _lastAuthUid: string | null = null;

function handleAuthChange(state: AuthState): void {
  if (state.status === 'loading') return;

  if (state.status === 'authenticated' && state.uid !== _lastAuthUid) {
    _lastAuthUid = state.uid;
    onAuthenticated(state.uid);
  } else if (state.status === 'guest' && _lastAuthUid !== null) {
    _lastAuthUid = null;
    onLogout();
  }
}

async function onAuthenticated(uid: string): Promise<void> {
  _suspended = false; // Fresh auth → allow server calls again

  // Check for first-login cookie (set by auth callback)
  const isFirst = document.cookie.indexOf('eg_first=1') !== -1;

  if (isFirst) {
    await handleFirstLogin(uid);
  } else {
    switchPersona(uid);
    await pullFromServer(uid);
  }
}

function onLogout(): void {
  clearTimeout(_pushTimer);
  switchPersona('guest');
  $vaultSync.set({ persona: 'guest', rev: 0, syncing: false, error: null });
}

// ─── First login merge ──────────────────────────────────────────────────────

async function handleFirstLogin(uid: string): Promise<void> {
  // Capture guest vault before switching
  const guestEntries = [...$vault.get().entries];

  // Switch to user persona + pull server data
  switchPersona(uid);
  const serverData = await fetchServerVault(uid);

  if (serverData) {
    // Merge: union by product ID, guest wins on conflict, respect max 16/category
    const merged = mergeVaults(guestEntries, serverData.compare);
    setVaultState({ entries: merged });
    _flushToStorage();
    await pushToServer();
  }

  // Clear guest vault after successful merge
  if (typeof globalThis.localStorage !== 'undefined') {
    globalThis.localStorage.removeItem('eg-vault:guest');
  }

  // Clear the first-login cookie (expire it)
  document.cookie = 'eg_first=; Path=/; Max-Age=0';
}

// Re-export for public API
export { mergeVaults } from './merge.ts';

// ─── Server communication ───────────────────────────────────────────────────

async function fetchServerVault(uid: string): Promise<{ compare: VaultEntry[]; builds: unknown[]; rev: number } | null> {
  if (_suspended) return null;

  try {
    const rev = getLocalRev(uid);
    const url = rev > 0 ? `/api/user/vault?rev=${rev}` : '/api/user/vault';
    const res = await fetch(url, { credentials: 'same-origin' });

    if (res.status === 304) return null; // No changes
    if (res.status === 401) {
      // WHY: stop all server calls until next successful auth transition
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
    // WHY: if vault changed while push was in-flight, schedule follow-up
    if (_pushDirty) {
      _pushDirty = false;
      clearTimeout(_pushTimer);
      _pushTimer = setTimeout(pushToServer, PUSH_DEBOUNCE_MS);
    }
  }
}

// ─── Vault change handler (debounced push + broadcast) ──────────────────────

function handleVaultChange(): void {
  // WHY _fromBroadcast: if the change came from another tab (broadcast or storage event),
  // don't re-broadcast or push — the originating tab already pushed.
  if (_fromBroadcast) return;

  // Broadcast to other tabs
  broadcastChange();

  // Debounced push if authenticated and not suspended
  const scope = getCurrentScope();
  if (scope === 'guest' || _suspended) return;

  // WHY: if push is in-flight, mark dirty so a follow-up fires after completion
  if (_pushing) {
    _pushDirty = true;
    return;
  }

  clearTimeout(_pushTimer);
  _pushTimer = setTimeout(() => {
    // Only push when tab is visible
    if (document.visibilityState === 'visible') {
      pushToServer();
    }
  }, PUSH_DEBOUNCE_MS);
}

// ─── BroadcastChannel ───────────────────────────────────────────────────────

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
    // Channel closed — ignore
  }
}

function handleBroadcastMessage(e: MessageEvent<BroadcastPayload>): void {
  const { scope, entries } = e.data;
  // Only accept messages for same persona
  if (scope !== getCurrentScope()) return;
  _fromBroadcast = true;
  setVaultState({ entries });
  _fromBroadcast = false;
}

// ─── Storage event fallback ─────────────────────────────────────────────────

function handleStorageEvent(e: StorageEvent): void {
  if (!e.key?.startsWith('eg-vault:')) return;
  // Check if the change is for our current scope
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
    // Invalid JSON — ignore
  }
}

// ─── Visibility change (throttled) ─────────────────────────────────────────

let _lastPullAt = 0;

function handleVisibility(): void {
  if (document.visibilityState !== 'visible') return;
  const scope = getCurrentScope();
  if (scope === 'guest' || _suspended) return;

  const now = Date.now();
  if (now - _lastPullAt < PULL_THROTTLE_MS) return;
  _lastPullAt = now;

  pullFromServer(scope);
}

// ─── Rev tracking in localStorage ───────────────────────────────────────────

function getLocalRev(uid: string): number {
  if (typeof globalThis.localStorage === 'undefined') return 0;
  const raw = globalThis.localStorage.getItem(vaultRevKey(uid));
  return raw ? parseInt(raw, 10) || 0 : 0;
}

function setLocalRev(uid: string, rev: number): void {
  if (typeof globalThis.localStorage === 'undefined') return;
  globalThis.localStorage.setItem(vaultRevKey(uid), String(rev));
}

// ─── Teardown (for tests) ───────────────────────────────────────────────────

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
  _lastPullAt = 0;
  if (typeof window !== 'undefined') {
    window.removeEventListener('storage', handleStorageEvent);
    document.removeEventListener('visibilitychange', handleVisibility);
  }
}
