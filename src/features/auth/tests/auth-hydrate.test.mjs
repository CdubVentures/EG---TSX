import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';

/**
 * hydrateAuth() — client hydration tests
 *
 * Contract:
 *   1. Sets $auth to loading before fetch
 *   2. On successful /api/auth/me → sets authenticated
 *   3. On failed fetch → sets guest
 *   4. On invalid response → sets guest
 */

describe('hydrateAuth()', () => {
  /** @type {import('../store.ts')} */
  let mod;
  let originalFetch;

  beforeEach(async () => {
    originalFetch = globalThis.fetch;
    const ts = Date.now() + Math.random();
    mod = await import(`../store.ts?t=${ts}`);
    mod.setGuest();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('sets loading then authenticated on success', async () => {
    let capturedStatus;
    const unsub = mod.$auth.listen((state) => {
      if (state.status === 'loading') capturedStatus = 'loading';
    });

    globalThis.fetch = async () =>
      new Response(
        JSON.stringify({
          status: 'authenticated',
          uid: 'u-123',
          email: 'a@b.com',
          username: 'alice',
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );

    await mod.hydrateAuth();
    unsub();

    assert.equal(capturedStatus, 'loading');
    assert.equal(mod.$auth.get().status, 'authenticated');
    assert.equal(mod.$auth.get().uid, 'u-123');
    assert.equal(mod.$auth.get().email, 'a@b.com');
    assert.equal(mod.$auth.get().username, 'alice');
  });

  it('sets loading then guest on HTTP error', async () => {
    globalThis.fetch = async () => new Response('Unauthorized', { status: 401 });

    await mod.hydrateAuth();
    assert.equal(mod.$auth.get().status, 'guest');
  });

  it('sets loading then guest on network failure', async () => {
    globalThis.fetch = async () => {
      throw new Error('Network error');
    };

    await mod.hydrateAuth();
    assert.equal(mod.$auth.get().status, 'guest');
  });

  it('sets loading then guest on invalid response shape', async () => {
    globalThis.fetch = async () =>
      new Response(JSON.stringify({ invalid: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });

    await mod.hydrateAuth();
    assert.equal(mod.$auth.get().status, 'guest');
  });

  it('sets guest on guest response', async () => {
    globalThis.fetch = async () =>
      new Response(JSON.stringify({ status: 'guest' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });

    await mod.hydrateAuth();
    assert.equal(mod.$auth.get().status, 'guest');
  });

  it('skips the startup fetch when the auth hint cookie is missing', async () => {
    let fetchCount = 0;
    globalThis.fetch = async () => {
      fetchCount++;
      throw new Error('fetch should not run without the auth hint cookie');
    };

    await mod.hydrateAuthFromCookieHint('theme=gaming');

    assert.equal(fetchCount, 0);
    assert.equal(mod.$auth.get().status, 'guest');
  });

  it('hydrates when the auth hint cookie is present', async () => {
    let fetchCount = 0;
    globalThis.fetch = async () => {
      fetchCount++;
      return new Response(
        JSON.stringify({
          status: 'authenticated',
          uid: 'u-123',
          email: 'a@b.com',
          username: 'alice',
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    };

    await mod.hydrateAuthFromCookieHint('foo=bar; eg_hint=1; theme=gaming');

    assert.equal(fetchCount, 1);
    assert.equal(mod.$auth.get().status, 'authenticated');
  });

  it('deduplicates concurrent calls (fetch called once)', async () => {
    let fetchCount = 0;
    globalThis.fetch = async () => {
      fetchCount++;
      // Simulate latency
      await new Promise(r => setTimeout(r, 50));
      return new Response(
        JSON.stringify({ status: 'authenticated', uid: 'u-1', email: 'a@b.com', username: 'al' }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    };

    const p1 = mod.hydrateAuth();
    const p2 = mod.hydrateAuth();
    await Promise.all([p1, p2]);

    assert.equal(fetchCount, 1, 'concurrent hydrateAuth should fire only one fetch');
    assert.equal(mod.$auth.get().status, 'authenticated');
  });

  it('allows a new fetch after previous call resolves', async () => {
    let fetchCount = 0;
    globalThis.fetch = async () => {
      fetchCount++;
      return new Response(
        JSON.stringify({ status: 'authenticated', uid: 'u-1', email: 'a@b.com', username: 'al' }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    };

    await mod.hydrateAuth();
    assert.equal(fetchCount, 1);

    await mod.hydrateAuth();
    assert.equal(fetchCount, 2, 'after first resolves, second call should trigger a new fetch');
  });
});
