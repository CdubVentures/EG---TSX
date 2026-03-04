/** Auth state types — SSOT for all auth consumers. */

export type AuthStatus = 'guest' | 'loading' | 'authenticated';

export interface AuthState {
  status: AuthStatus;
  uid: string;
  email: string | null;
  username: string | null;
}

export const GUEST: AuthState = { status: 'guest', uid: 'guest', email: null, username: null };
export const LOADING: AuthState = { status: 'loading', uid: 'guest', email: null, username: null };
