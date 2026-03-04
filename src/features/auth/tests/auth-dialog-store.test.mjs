import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

/**
 * $authDialog Nano Store — unit tests
 *
 * Contract:
 *   State:    { open: boolean, view: 'login' | 'signup' }
 *   Default:  { open: false, view: 'login' }
 *   Actions:  openLogin() / openSignup() / closeAuth() / switchView(v)
 *   Invariant: closeAuth() always resets view to 'login'
 */

const DEFAULT_STATE = { open: false, view: 'login' };

describe('$authDialog store', () => {
  /** @type {import('../store.ts')} */
  let mod;

  beforeEach(async () => {
    const ts = Date.now() + Math.random();
    mod = await import(`../store.ts?t=${ts}`);
    mod.closeAuth();
  });

  it('initial state is closed with login view', () => {
    const state = mod.$authDialog.get();
    assert.deepStrictEqual(state, DEFAULT_STATE);
  });

  it('openLogin() sets open: true, view: login', () => {
    mod.openLogin();
    assert.deepStrictEqual(mod.$authDialog.get(), { open: true, view: 'login' });
  });

  it('openSignup() sets open: true, view: signup', () => {
    mod.openSignup();
    assert.deepStrictEqual(mod.$authDialog.get(), { open: true, view: 'signup' });
  });

  it('closeAuth() sets open: false and resets view to login', () => {
    mod.openSignup();
    mod.closeAuth();
    assert.deepStrictEqual(mod.$authDialog.get(), DEFAULT_STATE);
  });

  it('switchView(signup) while open keeps open and changes view', () => {
    mod.openLogin();
    mod.switchView('signup');
    assert.deepStrictEqual(mod.$authDialog.get(), { open: true, view: 'signup' });
  });

  it('switchView(login) while open keeps open and changes view', () => {
    mod.openSignup();
    mod.switchView('login');
    assert.deepStrictEqual(mod.$authDialog.get(), { open: true, view: 'login' });
  });

  it('closeAuth() after switchView resets view to login', () => {
    mod.openLogin();
    mod.switchView('signup');
    mod.closeAuth();
    assert.deepStrictEqual(mod.$authDialog.get(), DEFAULT_STATE);
  });

  it('openLogin() after openSignup() switches view without closing', () => {
    mod.openSignup();
    mod.openLogin();
    assert.deepStrictEqual(mod.$authDialog.get(), { open: true, view: 'login' });
  });

  it('openSignup() after openLogin() switches view without closing', () => {
    mod.openLogin();
    mod.openSignup();
    assert.deepStrictEqual(mod.$authDialog.get(), { open: true, view: 'signup' });
  });

  it('existing $auth store still works (no regression)', () => {
    mod.setAuthenticated('u1', 'a@b.com', 'alpha');
    assert.strictEqual(mod.$auth.get().status, 'authenticated');
    mod.setGuest();
    assert.strictEqual(mod.$auth.get().status, 'guest');
  });
});
