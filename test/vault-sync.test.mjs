import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

/**
 * Vault sync — response validation, dirty flag, visibility throttle.
 *
 * Tests Zod validation of server responses (GET + PUT) to prevent
 * silent crashes from CDN error pages or corrupt JSON.
 */

// ─── Vault GET Response Validation ─────────────────────────────────────────

describe('vault GET response validation', () => {
  /** @type {import('../src/features/vault/server/schema.ts')} */
  let schema;

  it('valid GET response → parses successfully', async () => {
    const ts = Date.now() + Math.random();
    schema = await import(`../src/features/vault/server/schema.ts?t=${ts}`);

    const valid = {
      compare: [
        {
          product: { id: 'mouse/razer/viper-v3-pro', slug: 'viper-v3-pro', brand: 'Razer', model: 'Viper V3 Pro', category: 'mouse', imagePath: '/images/mouse/razer/viper-v3-pro' },
          addedAt: 1700000000000,
        },
      ],
      builds: [],
      rev: 5,
    };

    const result = schema.VaultGetResponseSchema.safeParse(valid);
    assert.ok(result.success);
    assert.equal(result.data.rev, 5);
    assert.equal(result.data.compare.length, 1);
  });

  it('GET response missing rev → fails validation', async () => {
    const ts = Date.now() + Math.random();
    schema = await import(`../src/features/vault/server/schema.ts?t=${ts}`);

    const noRev = { compare: [], builds: [] };
    const result = schema.VaultGetResponseSchema.safeParse(noRev);
    assert.equal(result.success, false);
  });

  it('GET response with non-array compare → fails validation', async () => {
    const ts = Date.now() + Math.random();
    schema = await import(`../src/features/vault/server/schema.ts?t=${ts}`);

    const badCompare = { compare: 'not-an-array', builds: [], rev: 1 };
    const result = schema.VaultGetResponseSchema.safeParse(badCompare);
    assert.equal(result.success, false);
  });
});

// ─── Vault PUT Response Validation ─────────────────────────────────────────

describe('vault PUT response validation', () => {
  /** @type {import('../src/features/vault/server/schema.ts')} */
  let schema;

  it('valid PUT response → parses successfully', async () => {
    const ts = Date.now() + Math.random();
    schema = await import(`../src/features/vault/server/schema.ts?t=${ts}`);

    const valid = { ok: true, rev: 10 };
    const result = schema.VaultPutResponseSchema.safeParse(valid);
    assert.ok(result.success);
    assert.equal(result.data.rev, 10);
  });

  it('PUT response missing ok → fails validation', async () => {
    const ts = Date.now() + Math.random();
    schema = await import(`../src/features/vault/server/schema.ts?t=${ts}`);

    const noOk = { rev: 10 };
    const result = schema.VaultPutResponseSchema.safeParse(noOk);
    assert.equal(result.success, false);
  });

  it('HTML error page body → fails validation', async () => {
    const ts = Date.now() + Math.random();
    schema = await import(`../src/features/vault/server/schema.ts?t=${ts}`);

    // CDN returns HTML error page; JSON.parse throws, so we simulate
    // passing the raw string through safeParse (which would also fail)
    const htmlString = '<!DOCTYPE html><html><body>502 Bad Gateway</body></html>';
    const result = schema.VaultGetResponseSchema.safeParse(htmlString);
    assert.equal(result.success, false);
  });
});

// ─── Push Dirty Flag (unit logic) ──────────────────────────────────────────

describe('push dirty flag logic', () => {
  it('marks dirty when change arrives during push', () => {
    // Simulates the dirty flag state machine
    let pushing = false;
    let dirty = false;
    let pushCount = 0;

    function startPush() {
      if (pushing) { dirty = true; return; }
      pushing = true;
      pushCount++;
    }

    function endPush() {
      pushing = false;
      if (dirty) {
        dirty = false;
        startPush(); // follow-up
      }
    }

    // First push starts
    startPush();
    assert.equal(pushCount, 1);

    // Change arrives mid-push → sets dirty
    startPush();
    assert.equal(dirty, true);
    assert.equal(pushCount, 1, 'should not start second push while first in-flight');

    // First push completes → triggers follow-up
    endPush();
    assert.equal(pushCount, 2, 'follow-up push should fire after dirty flag');
    assert.equal(dirty, false);
  });

  it('no follow-up when no change during push', () => {
    let pushing = false;
    let dirty = false;
    let pushCount = 0;

    function startPush() {
      if (pushing) { dirty = true; return; }
      pushing = true;
      pushCount++;
    }

    function endPush() {
      pushing = false;
      if (dirty) {
        dirty = false;
        startPush();
      }
    }

    startPush();
    assert.equal(pushCount, 1);

    // No change during push
    endPush();
    assert.equal(pushCount, 1, 'no follow-up when clean');
  });
});

// ─── Visibility Pull Throttle (unit logic) ─────────────────────────────────

describe('visibility pull throttle', () => {
  const PULL_THROTTLE_MS = 5_000;

  it('two visibility events within throttle window → only one pull', () => {
    let pullCount = 0;
    let lastPullAt = 0;
    // WHY: use large timestamps like Date.now() so first call passes (now - 0 > 5000)
    const baseTime = 1_700_000_000_000;

    function handleVisibility(now) {
      if (now - lastPullAt < PULL_THROTTLE_MS) return;
      lastPullAt = now;
      pullCount++;
    }

    handleVisibility(baseTime);
    assert.equal(pullCount, 1);

    // 2 seconds later — within throttle window
    handleVisibility(baseTime + 2_000);
    assert.equal(pullCount, 1, 'should throttle second pull within 5s window');
  });

  it('visibility event after throttle window → new pull fires', () => {
    let pullCount = 0;
    let lastPullAt = 0;
    const baseTime = 1_700_000_000_000;

    function handleVisibility(now) {
      if (now - lastPullAt < PULL_THROTTLE_MS) return;
      lastPullAt = now;
      pullCount++;
    }

    handleVisibility(baseTime);
    assert.equal(pullCount, 1);

    // 6 seconds later — past throttle window
    handleVisibility(baseTime + 6_000);
    assert.equal(pullCount, 2, 'should allow new pull after throttle expires');
  });
});
