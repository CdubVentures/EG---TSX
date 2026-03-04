import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

/**
 * AuthMeResponseSchema — Zod validation tests
 *
 * Contract:
 *   Accepts: { status: 'authenticated', uid, email, username }
 *                or { status: 'guest' }
 *   Rejects: missing fields, wrong types, unknown status
 */

describe('AuthMeResponseSchema', () => {
  /** @type {import('../schemas.ts')} */
  let mod;

  it('validates authenticated response', async () => {
    mod = await import('../schemas.ts');
    const result = mod.AuthMeResponseSchema.safeParse({
      status: 'authenticated',
      uid: 'abc-123',
      email: 'a@b.com',
      username: 'alice',
    });
    assert.equal(result.success, true);
  });

  it('validates authenticated response with null email and username', async () => {
    mod = await import('../schemas.ts');
    const result = mod.AuthMeResponseSchema.safeParse({
      status: 'authenticated',
      uid: 'abc-123',
      email: null,
      username: null,
    });
    assert.equal(result.success, true);
  });

  it('validates guest response', async () => {
    mod = await import('../schemas.ts');
    const result = mod.AuthMeResponseSchema.safeParse({ status: 'guest' });
    assert.equal(result.success, true);
  });

  it('rejects empty uid', async () => {
    mod = await import('../schemas.ts');
    const result = mod.AuthMeResponseSchema.safeParse({
      status: 'authenticated',
      uid: '',
      email: 'a@b.com',
      username: 'alice',
    });
    assert.equal(result.success, false);
  });

  it('rejects missing uid on authenticated', async () => {
    mod = await import('../schemas.ts');
    const result = mod.AuthMeResponseSchema.safeParse({
      status: 'authenticated',
      email: 'a@b.com',
      username: 'alice',
    });
    assert.equal(result.success, false);
  });

  it('rejects unknown status', async () => {
    mod = await import('../schemas.ts');
    const result = mod.AuthMeResponseSchema.safeParse({ status: 'unknown' });
    assert.equal(result.success, false);
  });

  it('rejects invalid email format', async () => {
    mod = await import('../schemas.ts');
    const result = mod.AuthMeResponseSchema.safeParse({
      status: 'authenticated',
      uid: 'abc-123',
      email: 'not-an-email',
      username: 'alice',
    });
    assert.equal(result.success, false);
  });
});
