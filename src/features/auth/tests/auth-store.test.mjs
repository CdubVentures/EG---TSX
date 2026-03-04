import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

/**
 * $auth Nano Store — tri-state unit tests
 *
 * Contract:
 *   State:    { status: 'guest' | 'loading' | 'authenticated', uid, email, username }
 *   Default:  { status: 'guest', uid: 'guest', email: null, username: null }
 *   Actions:  setAuthenticated() / setGuest() / setLoading()
 *   Invariant: setGuest() resets to GUEST constant
 */

describe('$auth store (tri-state)', () => {
  /** @type {import('../store.ts')} */
  let mod;

  beforeEach(async () => {
    const ts = Date.now() + Math.random();
    mod = await import(`../store.ts?t=${ts}`);
    mod.setGuest();
  });

  it('initial state is guest', () => {
    const state = mod.$auth.get();
    assert.equal(state.status, 'guest');
    assert.equal(state.uid, 'guest');
    assert.equal(state.email, null);
    assert.equal(state.username, null);
  });

  it('setLoading() transitions to loading', () => {
    mod.setLoading();
    const state = mod.$auth.get();
    assert.equal(state.status, 'loading');
    assert.equal(state.uid, 'guest');
  });

  it('setAuthenticated() transitions to authenticated', () => {
    mod.setAuthenticated('u123', 'a@b.com', 'alice');
    const state = mod.$auth.get();
    assert.equal(state.status, 'authenticated');
    assert.equal(state.uid, 'u123');
    assert.equal(state.email, 'a@b.com');
    assert.equal(state.username, 'alice');
  });

  it('setAuthenticated() defaults email and username to null', () => {
    mod.setAuthenticated('u456');
    const state = mod.$auth.get();
    assert.equal(state.status, 'authenticated');
    assert.equal(state.uid, 'u456');
    assert.equal(state.email, null);
    assert.equal(state.username, null);
  });

  it('setGuest() resets from authenticated to guest', () => {
    mod.setAuthenticated('u123', 'a@b.com', 'alice');
    mod.setGuest();
    const state = mod.$auth.get();
    assert.equal(state.status, 'guest');
    assert.equal(state.uid, 'guest');
  });

  it('guest → loading → authenticated → guest full cycle', () => {
    assert.equal(mod.$auth.get().status, 'guest');
    mod.setLoading();
    assert.equal(mod.$auth.get().status, 'loading');
    mod.setAuthenticated('u789', 'c@d.com', 'bob');
    assert.equal(mod.$auth.get().status, 'authenticated');
    mod.setGuest();
    assert.equal(mod.$auth.get().status, 'guest');
  });

  it('setLoading() from authenticated transitions to loading', () => {
    mod.setAuthenticated('u123', 'a@b.com', 'alice');
    mod.setLoading();
    assert.equal(mod.$auth.get().status, 'loading');
  });

  it('$authDialog store still works (no regression)', () => {
    mod.openLogin();
    assert.deepStrictEqual(mod.$authDialog.get(), { open: true, view: 'login' });
    mod.closeAuth();
    assert.deepStrictEqual(mod.$authDialog.get(), { open: false, view: 'login' });
  });
});
