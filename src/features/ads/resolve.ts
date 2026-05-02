import { AD_POSITIONS, ADSENSE_CLIENT } from './config';
import type { AdSlotConfig, ParsedSize } from './config';

/** Look up an ad slot by position name. Returns undefined if not found. */
export function resolveAd(position: string): AdSlotConfig | undefined {
  return AD_POSITIONS[position];
}

/** Returns the global AdSense publisher client ID. */
export function getAdsenseClient(): string {
  return ADSENSE_CLIENT;
}

/** Returns true if ads are enabled (PUBLIC_ADS_ENABLED env var). */
export function isAdsEnabled(): boolean {
  // WHY: import.meta.env is only available inside Vite/Astro, not in Node test runner
  try {
    return import.meta.env?.PUBLIC_ADS_ENABLED === 'true';
  } catch {
    return false;
  }
}

/** Parse "WxH" string into {width, height}. Returns undefined on bad format. */
export function parseSize(size: string): ParsedSize | undefined {
  const match = size.match(/^(\d+)x(\d+)$/);
  if (!match) return undefined;
  return { width: Number(match[1]), height: Number(match[2]) };
}

/** Parse first size from a comma-separated sizes string. */
export function parseFirstSize(sizes: string): ParsedSize | undefined {
  const first = sizes.split(',')[0]?.trim();
  if (!first) return undefined;
  return parseSize(first);
}

/** Parse all sizes from a comma-separated sizes string. Skips invalid entries. */
export function parseAllSizes(sizes: string): ParsedSize[] {
  if (!sizes) return [];
  return sizes.split(',')
    .map(s => parseSize(s.trim()))
    .filter((s): s is ParsedSize => s !== undefined);
}

/** Return the largest size by area (ties broken by height). */
export function parseLargestSize(sizes: string): ParsedSize | undefined {
  const all = parseAllSizes(sizes);
  if (all.length === 0) return undefined;
  return all.reduce((max, s) => {
    const maxArea = max.width * max.height;
    const sArea = s.width * s.height;
    return sArea > maxArea || (sArea === maxArea && s.height > max.height) ? s : max;
  });
}

/** Return the smallest size by area. */
export function parseSmallestSize(sizes: string): ParsedSize | undefined {
  const all = parseAllSizes(sizes);
  if (all.length === 0) return undefined;
  return all.reduce((min, s) => {
    const minArea = min.width * min.height;
    const sArea = s.width * s.height;
    return sArea < minArea ? s : min;
  });
}
