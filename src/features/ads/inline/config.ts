import { z } from 'zod';
import inlineAdsRaw from '../../../../config/data/inline-ads-config.json';

// ─── Cadence schema (per-device) ─────────────────────────────────────────
const cadenceSchema = z.object({
  firstAfter: z.number().int().min(0),
  every: z.number().int().min(1),
  max: z.number().int().min(1),
});

// ─── Word-scaling schema ─────────────────────────────────────────────────
const wordScalingSchema = z.object({
  enabled: z.boolean(),
  desktopWordsPerAd: z.number().int().min(1),
  mobileWordsPerAd: z.number().int().min(1),
  minFirstAdWords: z.number().int().min(0),
});

// ─── Collection config (discriminated on enabled) ────────────────────────
// WHY: enabled=false collections don't need cadence fields.
const enabledCollectionSchema = z.object({
  enabled: z.literal(true),
  desktop: cadenceSchema,
  mobile: cadenceSchema,
  wordScaling: wordScalingSchema,
});

const disabledCollectionSchema = z.object({
  enabled: z.literal(false),
});

const collectionConfigSchema = z.discriminatedUnion('enabled', [
  enabledCollectionSchema,
  disabledCollectionSchema,
]);

// ─── Top-level config ────────────────────────────────────────────────────
const defaultsSchema = z.object({
  campaign: z.string(),
  desktop: z.boolean(),
  mobile: z.boolean(),
});

export const inlineAdsConfigSchema = z.object({
  defaults: defaultsSchema,
  collections: z.record(z.string(), collectionConfigSchema),
});

export type InlineAdsConfig = z.infer<typeof inlineAdsConfigSchema>;
export type CollectionCadence = z.infer<typeof enabledCollectionSchema>;

// ─── Validated config (single source of truth) ──────────────────────────
// WHY: Zod parse at module load catches typos/drift immediately.
export const INLINE_ADS_CONFIG: InlineAdsConfig = inlineAdsConfigSchema.parse(inlineAdsRaw);
