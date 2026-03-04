// ─── Vault Schema Tests ────────────────────────────────────────────────────
// Contract: Zod schemas validate DynamoDB payloads and REST shapes.
// Runner: node --test --experimental-strip-types

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

// ─── Dynamic import (fresh per suite) ──────────────────────────────────────

let schemaCounter = 0;

async function freshSchemas() {
  schemaCounter++;
  return import(`../server/schema.ts?test=${schemaCounter}`);
}

// ─── Fixtures ──────────────────────────────────────────────────────────────

function validProduct() {
  return {
    id: 'mouse/razer/viper-v3-pro',
    slug: 'viper-v3-pro',
    brand: 'Razer',
    model: 'Viper V3 Pro',
    category: 'mouse',
    imagePath: '/images/data-products/mouse/razer/viper-v3-pro',
  };
}

function validEntry() {
  return { product: validProduct(), addedAt: 1700000000000 };
}

// ─── VaultProductSchema ────────────────────────────────────────────────────

describe('VaultProductSchema', () => {
  it('accepts a valid product', async () => {
    const { VaultProductSchema } = await freshSchemas();
    const result = VaultProductSchema.safeParse(validProduct());
    assert.equal(result.success, true);
  });

  it('rejects product with empty id', async () => {
    const { VaultProductSchema } = await freshSchemas();
    const result = VaultProductSchema.safeParse({ ...validProduct(), id: '' });
    assert.equal(result.success, false);
  });

  it('rejects product with missing fields', async () => {
    const { VaultProductSchema } = await freshSchemas();
    const result = VaultProductSchema.safeParse({ id: 'x' });
    assert.equal(result.success, false);
  });
});

// ─── VaultEntrySchema ──────────────────────────────────────────────────────

describe('VaultEntrySchema', () => {
  it('accepts a valid entry', async () => {
    const { VaultEntrySchema } = await freshSchemas();
    const result = VaultEntrySchema.safeParse(validEntry());
    assert.equal(result.success, true);
  });

  it('rejects entry with negative timestamp', async () => {
    const { VaultEntrySchema } = await freshSchemas();
    const result = VaultEntrySchema.safeParse({ product: validProduct(), addedAt: -1 });
    assert.equal(result.success, false);
  });

  it('rejects entry with float timestamp', async () => {
    const { VaultEntrySchema } = await freshSchemas();
    const result = VaultEntrySchema.safeParse({ product: validProduct(), addedAt: 1.5 });
    assert.equal(result.success, false);
  });
});

// ─── VaultDbPayloadSchema ──────────────────────────────────────────────────

describe('VaultDbPayloadSchema', () => {
  it('accepts valid versioned payload', async () => {
    const { VaultDbPayloadSchema } = await freshSchemas();
    const result = VaultDbPayloadSchema.safeParse({
      v: 1,
      compare: [validEntry()],
      builds: [],
    });
    assert.equal(result.success, true);
  });

  it('defaults builds to empty array when missing', async () => {
    const { VaultDbPayloadSchema } = await freshSchemas();
    const result = VaultDbPayloadSchema.safeParse({
      v: 1,
      compare: [],
    });
    assert.equal(result.success, true);
    assert.deepStrictEqual(result.data.builds, []);
  });

  it('rejects wrong version number', async () => {
    const { VaultDbPayloadSchema } = await freshSchemas();
    const result = VaultDbPayloadSchema.safeParse({
      v: 2,
      compare: [],
      builds: [],
    });
    assert.equal(result.success, false);
  });
});

// ─── VaultPutRequestSchema ─────────────────────────────────────────────────

describe('VaultPutRequestSchema', () => {
  it('accepts valid put request', async () => {
    const { VaultPutRequestSchema } = await freshSchemas();
    const result = VaultPutRequestSchema.safeParse({
      compare: [validEntry(), validEntry()],
    });
    // Two entries with same product ID still valid at schema level
    assert.equal(result.success, true);
  });

  it('rejects when compare exceeds 160 entries', async () => {
    const { VaultPutRequestSchema } = await freshSchemas();
    const entries = Array.from({ length: 161 }, (_, i) => ({
      product: { ...validProduct(), id: `mouse/brand/m-${i}` },
      addedAt: 1700000000000 + i,
    }));
    const result = VaultPutRequestSchema.safeParse({ compare: entries });
    assert.equal(result.success, false);
  });

  it('accepts exactly 160 entries', async () => {
    const { VaultPutRequestSchema } = await freshSchemas();
    const entries = Array.from({ length: 160 }, (_, i) => ({
      product: { ...validProduct(), id: `mouse/brand/m-${i}` },
      addedAt: 1700000000000 + i,
    }));
    const result = VaultPutRequestSchema.safeParse({ compare: entries });
    assert.equal(result.success, true);
  });
});

// ─── Response schemas ──────────────────────────────────────────────────────

describe('VaultGetResponseSchema', () => {
  it('accepts valid get response', async () => {
    const { VaultGetResponseSchema } = await freshSchemas();
    const result = VaultGetResponseSchema.safeParse({
      compare: [validEntry()],
      builds: [],
      rev: 5,
    });
    assert.equal(result.success, true);
  });

  it('rejects response with missing rev', async () => {
    const { VaultGetResponseSchema } = await freshSchemas();
    const result = VaultGetResponseSchema.safeParse({
      compare: [],
      builds: [],
    });
    assert.equal(result.success, false);
  });
});

describe('VaultPutResponseSchema', () => {
  it('accepts valid put response', async () => {
    const { VaultPutResponseSchema } = await freshSchemas();
    const result = VaultPutResponseSchema.safeParse({ ok: true, rev: 3 });
    assert.equal(result.success, true);
  });

  it('rejects response with ok: false', async () => {
    const { VaultPutResponseSchema } = await freshSchemas();
    const result = VaultPutResponseSchema.safeParse({ ok: false, rev: 3 });
    assert.equal(result.success, false);
  });
});
