import { atom } from 'nanostores';
import type { AuthState } from './types';
import { GUEST, LOADING } from './types';
import { AuthMeResponseSchema } from './schemas';

export type { AuthState };
export { GUEST, LOADING };

export const $auth = atom<AuthState>({ ...GUEST });

export function setAuthenticated(uid: string, email?: string | null, username?: string | null): void {
  $auth.set({ status: 'authenticated', uid, email: email ?? null, username: username ?? null });
}

export function setLoading(): void {
  $auth.set({ ...LOADING });
}

export function setGuest(): void {
  $auth.set({ ...GUEST });
}

let _hydratePromise: Promise<void> | null = null;

/** Fetch /api/auth/me server-verified user data and hydrate $auth. */
export function hydrateAuth(): Promise<void> {
  if (_hydratePromise) return _hydratePromise;
  _hydratePromise = _doHydrate().finally(() => { _hydratePromise = null; });
  return _hydratePromise;
}

async function _doHydrate(): Promise<void> {
  setLoading();
  try {
    const res = await fetch('/api/auth/me', { credentials: 'same-origin' });
    if (!res.ok) { setGuest(); return; }
    const json: unknown = await res.json();
    const parsed = AuthMeResponseSchema.safeParse(json);
    if (!parsed.success) { setGuest(); return; }
    if (parsed.data.status === 'authenticated') {
      setAuthenticated(parsed.data.uid, parsed.data.email, parsed.data.username);
    } else {
      setGuest();
    }
  } catch {
    setGuest();
  }
}

/** Navigate to server-side logout endpoint. */
export function logout(): void {
  setGuest();
  window.location.href = '/logout';
}

/* ── Auth Dialog State ─── */
export type AuthDialogView =
  | 'login'
  | 'signup'
  | 'confirm-signup'
  | 'forgot-password';

export const $authDialog = atom<{ open: boolean; view: AuthDialogView }>({
  open: false, view: 'login'
});

export function openLogin(): void  { $authDialog.set({ open: true, view: 'login' }); }
export function openSignup(): void { $authDialog.set({ open: true, view: 'signup' }); }
export function closeAuth(): void  {
  $authDialog.set({ open: false, view: 'login' });
  clearForm();
}
export function switchView(v: AuthDialogView): void {
  $authDialog.set({ open: true, view: v });
  setFormError(null);
  setFormLoading(false);
}

/* ── Auth Form State (email/error/loading for inline forms) ─── */
interface AuthFormState {
  email: string;
  error: string | null;
  successMessage: string | null;
  loading: boolean;
}

export const $authForm = atom<AuthFormState>({
  email: '', error: null, successMessage: null, loading: false,
});

export function setFormEmail(email: string): void {
  $authForm.set({ ...$authForm.get(), email });
}
export function setFormError(error: string | null): void {
  $authForm.set({ ...$authForm.get(), error, successMessage: null });
}
export function setFormLoading(loading: boolean): void {
  $authForm.set({ ...$authForm.get(), loading });
}
export function setFormSuccess(message: string): void {
  $authForm.set({ ...$authForm.get(), successMessage: message, error: null });
}
export function clearForm(): void {
  $authForm.set({ email: '', error: null, successMessage: null, loading: false });
}

/* ── BroadcastChannel cross-tab sync ─── */
const AUTH_CHANNEL = 'eg-auth-sync';

function initBroadcastSync(): void {
  if (typeof BroadcastChannel === 'undefined') return;

  const channel = new BroadcastChannel(AUTH_CHANNEL);

  // Broadcast auth changes to other tabs
  $auth.listen((state) => {
    try { channel.postMessage(state); } catch { /* closed tab */ }
  });

  // Receive from other tabs
  channel.onmessage = (e: MessageEvent<AuthState>) => {
    const current = $auth.get();
    if (current.status !== e.data.status || current.uid !== e.data.uid) {
      $auth.set(e.data);
    }
  };
}

// WHY: guard against SSR (no BroadcastChannel/document on server)
if (typeof window !== 'undefined') {
  initBroadcastSync();

  // Sync html.logged CSS class with $auth state so .logged-hide/.logged-show
  // elements in the nav react without a page reload.
  // WHY skip 'loading': the inline <head> script already set .logged from
  // the eg_hint cookie. Removing it during the fetch would flash guest UI
  // before the server response re-adds it.
  $auth.listen((state) => {
    if (state.status === 'loading') return;
    document.documentElement.classList.toggle('logged', state.status === 'authenticated');
  });
}
