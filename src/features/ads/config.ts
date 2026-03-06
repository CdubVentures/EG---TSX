import { z } from 'zod';
import adsRegistryRaw from '../../../config/data/ads-registry.json';

// ─── Types ──────────────────────────────────────────────────────────────────
// Matches CONTENT_LAYOUT_AND_ADS.md Section 5.2

export const adProviderSchema = z.enum(['adsense', 'gpt', 'direct', 'native']);
export type AdProvider = z.infer<typeof adProviderSchema>;

export const adSlotConfigSchema = z.object({
  provider: adProviderSchema,
  adClient: z.string().optional(),   // AdSense publisher ID
  adSlot: z.string().optional(),     // AdSense slot ID
  slot: z.string().optional(),       // GPT slot path
  sizes: z.string(),                 // "300x250,300x300"
  display: z.boolean(),              // false = skip this slot entirely
  placementType: z.enum(['inline', 'rail']).default('rail'),
  // Direct/sponsor fields (future expansion):
  img: z.string().optional(),
  href: z.string().optional(),
  width: z.number().optional(),
  height: z.number().optional(),
});

export type AdSlotConfig = z.infer<typeof adSlotConfigSchema>;

export interface ParsedSize {
  width: number;
  height: number;
}

// ─── AdSense client ID (global) ─────────────────────────────────────────────
export const ADSENSE_CLIENT = adsRegistryRaw.adsenseClient;

// ─── Ad label text ──────────────────────────────────────────────────────────
export const AD_LABEL = adsRegistryRaw.adLabel;

// ─── Display knobs ──────────────────────────────────────────────────────────
// WHY: showProductionPlaceholders renders HBS-style border + "Ad" circle
// instead of the dev dashed-outline placeholder. loadSampleAds fills slots
// with colored dummy rectangles so layout can be verified without ad networks.
export const SHOW_PRODUCTION_PLACEHOLDERS: boolean = adsRegistryRaw.showProductionPlaceholders ?? false;
export const LOAD_SAMPLE_ADS: boolean = adsRegistryRaw.loadSampleAds ?? false;

// ─── Ad Registry ────────────────────────────────────────────────────────────
// Single source of truth — config/data/ads-registry.json
// Editable via config/ads-manager.pyw GUI tool.
// WHY: Zod parse catches typos/schema drift immediately, not at runtime.
// Also materializes defaults (e.g. placementType: 'rail').
const registrySchema = z.record(z.string(), adSlotConfigSchema);
export const AD_REGISTRY: Record<string, AdSlotConfig> = registrySchema.parse(
  adsRegistryRaw.placements
);
