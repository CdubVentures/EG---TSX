import { z } from 'zod';
import adsRegistryRaw from '../../../config/data/ads-registry.json';

// ─── Types ──────────────────────────────────────────────────────────────────
// Matches CONTENT_LAYOUT_AND_ADS.md Section 5.2

export const adProviderSchema = z.enum(['adsense', 'direct']);
export type AdProvider = z.infer<typeof adProviderSchema>;

export const adSlotConfigSchema = z.object({
  provider: adProviderSchema,
  adSlot: z.string().optional(),     // AdSense slot ID
  sizes: z.string(),                 // "300x250,300x300"
  display: z.boolean(),              // false = skip this slot entirely
  placementType: z.enum(['inline', 'rail']).default('rail'),
  notes: z.string().optional(),        // free-text notes per position
  // Direct/sponsor fields (future expansion):
  img: z.string().optional(),
  href: z.string().optional(),
  width: z.number().optional(),
  height: z.number().optional(),
});

export type AdSlotConfig = z.infer<typeof adSlotConfigSchema>;
export const sampleAdNetworkSchema = z.enum(['adsense', 'raptive', 'mediavine', 'ezoic', 'mixed']);
export type SampleAdNetwork = z.infer<typeof sampleAdNetworkSchema>;
export const sampleAdModeSchema = z.enum(['svg', 'video', 'mixed']);
export type SampleAdMode = z.infer<typeof sampleAdModeSchema>;

export interface ParsedSize {
  width: number;
  height: number;
}

function isProdRuntime(): boolean {
  try {
    const astroProd = import.meta.env?.PROD;
    if (typeof astroProd === 'boolean') return astroProd;
    if (typeof astroProd === 'string') return astroProd === 'true';
  } catch {
    // WHY: import.meta.env is unavailable in the Node test runner.
  }

  return process.env.NODE_ENV === 'production';
}

// ─── Global settings (from global block) ─────────────────────────────────
const globals = adsRegistryRaw.global;

export const ADSENSE_CLIENT = globals.adsenseClient;
export const AD_LABEL = globals.adLabel;

// WHY: showProductionPlaceholders renders HBS-style border + "Ad" circle
// instead of the dev dashed-outline placeholder. loadSampleAds fills slots
// with colored dummy rectangles so layout can be verified without ad networks.
export const SHOW_PRODUCTION_PLACEHOLDERS: boolean = globals.showProductionPlaceholders ?? false;
// WHY: sample creatives are for local layout verification only and must never ship in production HTML.
export const LOAD_SAMPLE_ADS: boolean = !isProdRuntime() && (globals.loadSampleAds ?? false);
const parsedSampleAdMode = sampleAdModeSchema.safeParse(globals.sampleAdMode);
const parsedSampleAdNetwork = sampleAdNetworkSchema.safeParse(globals.sampleAdNetwork);

export const SAMPLE_AD_MODE: SampleAdMode = parsedSampleAdMode.success
  ? parsedSampleAdMode.data
  : 'svg';
export const SAMPLE_AD_NETWORK: SampleAdNetwork = parsedSampleAdNetwork.success
  ? parsedSampleAdNetwork.data
  : 'adsense';

// ─── Ad Positions ────────────────────────────────────────────────────────
// Single source of truth — config/data/ads-registry.json
// Editable via the Ads panel in config/eg-config.pyw.
// WHY: Zod parse catches typos/schema drift immediately, not at runtime.
// Also materializes defaults (e.g. placementType: 'rail').
const registrySchema = z.record(z.string(), adSlotConfigSchema);
export const AD_POSITIONS: Record<string, AdSlotConfig> = registrySchema.parse(
  adsRegistryRaw.positions
);
