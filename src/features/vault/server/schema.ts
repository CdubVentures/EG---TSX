/** Zod schemas for vault API — validates DynamoDB payloads and REST request/response shapes. */

import { z } from 'zod';

// ─── Product + Entry ───────────────────────────────────────────────────────

export const VaultProductSchema = z.object({
  id: z.string().min(1),
  slug: z.string().min(1),
  brand: z.string().min(1),
  model: z.string().min(1),
  category: z.string().min(1),
  imagePath: z.string(),
  thumbnailStem: z.string().min(1),
});

export const VaultEntrySchema = z.object({
  product: VaultProductSchema,
  addedAt: z.number().int().nonnegative(),
});

// ─── DynamoDB versioned envelope ───────────────────────────────────────────

export const VaultDbPayloadSchema = z.object({
  v: z.literal(1),
  compare: z.array(VaultEntrySchema),
  builds: z.array(z.unknown()).default([]),
});

export type VaultDbPayload = z.infer<typeof VaultDbPayloadSchema>;

// ─── REST: PUT /api/user/vault ─────────────────────────────────────────────
// WHY max 160: 16 per category × 10 categories = 160 ceiling

export const VaultPutRequestSchema = z.object({
  compare: z.array(VaultEntrySchema).max(160),
});

export type VaultPutRequest = z.infer<typeof VaultPutRequestSchema>;

// ─── REST: GET /api/user/vault ─────────────────────────────────────────────

export const VaultGetResponseSchema = z.object({
  compare: z.array(VaultEntrySchema),
  builds: z.array(z.unknown()),
  rev: z.number().int().nonnegative(),
});

export type VaultGetResponse = z.infer<typeof VaultGetResponseSchema>;

// ─── REST: PUT /api/user/vault response ────────────────────────────────────

export const VaultPutResponseSchema = z.object({
  ok: z.literal(true),
  rev: z.number().int().nonnegative(),
});

export type VaultPutResponse = z.infer<typeof VaultPutResponseSchema>;
