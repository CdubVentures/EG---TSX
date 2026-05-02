import { z } from 'zod';
import inlineAdsRaw from '../../../../config/data/inline-ads-config.json' with { type: 'json' };

const cadenceSchema = z.object({
  firstAfter: z.number().int().min(0),
  every: z.number().int().min(1),
  max: z.number().int().min(1),
});

const wordScalingSchema = z.object({
  enabled: z.boolean(),
  desktopWordsPerAd: z.number().int().min(1),
  mobileWordsPerAd: z.number().int().min(1),
  minFirstAdWords: z.number().int().min(0),
});

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

const defaultsSchema = z.object({
  position: z.string(),
  desktop: z.boolean(),
  mobile: z.boolean(),
});

const inlineAdsConfigSchema = z.object({
  defaults: defaultsSchema,
  collections: z.record(z.string(), collectionConfigSchema),
});

export const INLINE_ADS_CONFIG = inlineAdsConfigSchema.parse(inlineAdsRaw);
