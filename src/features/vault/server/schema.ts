import { z } from 'zod';

const NonEmptyString = z.string().trim().min(1);
const OptionalNonEmptyString = z.preprocess((value) => {
  if (typeof value === 'string' && value.trim().length === 0) return undefined;
  return value;
}, NonEmptyString.optional());

const ThumbnailStemSchema = z.preprocess((value) => {
  if (value === undefined || value === null) return 'top';
  if (typeof value === 'string') {
    const stem = value.trim();
    if (stem.length === 0) return 'top';
    const normalized = stem.toLowerCase();
    if (normalized === 'undefined' || normalized === 'null' || normalized === 'nan') return 'top';
    return stem;
  }
  return value;
}, NonEmptyString);

export const VaultProductSchema = z.object({
  id: NonEmptyString,
  slug: NonEmptyString,
  brand: NonEmptyString,
  model: NonEmptyString,
  category: NonEmptyString,
  imagePath: z.string(),
  thumbnailStem: ThumbnailStemSchema,
});

const VaultEntryBaseSchema = z.object({
  productId: OptionalNonEmptyString,
  category: OptionalNonEmptyString,
  product: VaultProductSchema,
  addedAt: z.number().int().nonnegative(),
});

export const VaultEntrySchema = VaultEntryBaseSchema.transform((entry) => {
  const productId = entry.productId ?? entry.product.id;
  const category = entry.category ?? entry.product.category;
  return {
    productId,
    category,
    product: {
      ...entry.product,
      id: productId,
      category,
    },
    addedAt: entry.addedAt,
  };
});

export const VaultDbPayloadSchema = z.object({
  v: z.literal(1),
  compare: z.array(VaultEntrySchema),
  builds: z.array(z.unknown()).default([]),
});

export type VaultDbPayload = z.infer<typeof VaultDbPayloadSchema>;

export const VaultPutRequestSchema = z.object({
  compare: z.array(VaultEntrySchema).max(160),
});

export type VaultPutRequest = z.infer<typeof VaultPutRequestSchema>;

export const VaultGetResponseSchema = z.object({
  compare: z.array(VaultEntrySchema),
  builds: z.array(z.unknown()),
  rev: z.number().int().nonnegative(),
});

export type VaultGetResponse = z.infer<typeof VaultGetResponseSchema>;

export const VaultPutResponseSchema = z.object({
  ok: z.literal(true),
  rev: z.number().int().nonnegative(),
});

export type VaultPutResponse = z.infer<typeof VaultPutResponseSchema>;

const VaultThumbResolveRequestItemSchema = z.object({
  requestId: NonEmptyString,
  category: NonEmptyString,
});

export const VaultThumbResolveRequestSchema = z.object({
  items: z.array(VaultThumbResolveRequestItemSchema).max(160),
});

export type VaultThumbResolveRequest = z.infer<typeof VaultThumbResolveRequestSchema>;

const VaultThumbResolveResponseItemSchema = z.object({
  requestId: NonEmptyString,
  productId: NonEmptyString,
  category: NonEmptyString,
  slug: NonEmptyString,
  brand: NonEmptyString,
  model: NonEmptyString,
  imagePath: z.string(),
  thumbnailStem: NonEmptyString,
});

export const VaultThumbResolveResponseSchema = z.object({
  items: z.array(VaultThumbResolveResponseItemSchema),
});

export type VaultThumbResolveResponse = z.infer<typeof VaultThumbResolveResponseSchema>;
