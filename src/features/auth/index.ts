// ─── Auth Feature — Public API ──────────────────────────────────────────────
// Client-side exports only. Server modules (cognito, jwt, cookies, etc.)
// are imported directly from @features/auth/server/* by pages/middleware.

// Types
export type { AuthState, AuthStatus } from './types';
export { GUEST, LOADING } from './types';

// Store atoms + actions
export type { AuthDialogView } from './store';
export {
  $auth,
  setAuthenticated,
  setLoading,
  setGuest,
  hydrateAuth,
  hydrateAuthFromCookieHint,
  logout,
  $authDialog,
  openLogin,
  openSignup,
  closeAuth,
  switchView,
  $authForm,
  setFormEmail,
  setFormError,
  setFormLoading,
  setFormSuccess,
  clearForm,
} from './store';

// Schemas
export { AuthMeResponseSchema } from './schemas';
export type { AuthMeResponse } from './schemas';

// Components
export { default as AuthDialog } from './components/AuthDialog';
