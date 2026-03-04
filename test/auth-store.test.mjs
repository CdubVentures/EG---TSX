import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

/**
 * $auth Nano Store — unit tests
 *
 * Contract:
 *   Input:  setLoggedIn(uid, email?, username?) / setGuest()
 *   Output: { loggedIn, uid, email, username }
 *   Default: { loggedIn: false, uid: 'guest', email: null, username: null }
 *   Invariant: store is the single source of truth for auth state
 */

const GUEST_STATE = { loggedIn: false, uid: 'guest', email: null, username: null };

describe('$auth store', () => {
  /** @type {import('../src/features/auth/store.ts')} */
  let mod;

  beforeEach(async () => {
    /* Re-import to get fresh module state each test.
       Node caches modules, so we bust the cache with a query param. */
    const ts = Date.now() + Math.random();
    mod = await import(`../src/features/auth/store.ts?t=${ts}`);
    /* Reset to guest in case the module starts non-guest */
    mod.setGuest();
  });

  it('initial state is guest', () => {
    const state = mod.$auth.get();
    assert.deepStrictEqual(state, GUEST_STATE);
  });

  it('setLoggedIn(uid, email) sets logged-in state', () => {
    mod.setLoggedIn('abc123', 'user@test.com');
    const state = mod.$auth.get();
    assert.deepStrictEqual(state, {
      loggedIn: true,
      uid: 'abc123',
      email: 'user@test.com',
      username: null,
    });
  });

  it('setLoggedIn(uid, email, username) includes username', () => {
    mod.setLoggedIn('abc123', 'user@test.com', 'gamer42');
    const state = mod.$auth.get();
    assert.deepStrictEqual(state, {
      loggedIn: true,
      uid: 'abc123',
      email: 'user@test.com',
      username: 'gamer42',
    });
  });

  it('setLoggedIn with uid only defaults email and username to null', () => {
    mod.setLoggedIn('xyz789');
    const state = mod.$auth.get();
    assert.deepStrictEqual(state, {
      loggedIn: true,
      uid: 'xyz789',
      email: null,
      username: null,
    });
  });

  it('setGuest() resets to initial guest state', () => {
    mod.setLoggedIn('abc123', 'user@test.com', 'gamer42');
    mod.setGuest();
    const state = mod.$auth.get();
    assert.deepStrictEqual(state, GUEST_STATE);
  });

  it('multiple setLoggedIn calls — last wins, no accumulation', () => {
    mod.setLoggedIn('user1', 'a@b.com', 'alpha');
    mod.setLoggedIn('user2', 'c@d.com', 'bravo');
    const state = mod.$auth.get();
    assert.deepStrictEqual(state, {
      loggedIn: true,
      uid: 'user2',
      email: 'c@d.com',
      username: 'bravo',
    });
  });

  it('setGuest after setLoggedIn after setGuest — double cycle', () => {
    mod.setLoggedIn('u1', 'e@f.com');
    mod.setGuest();
    mod.setLoggedIn('u2', 'g@h.com', 'charlie');
    mod.setGuest();
    const state = mod.$auth.get();
    assert.deepStrictEqual(state, GUEST_STATE);
  });
});
