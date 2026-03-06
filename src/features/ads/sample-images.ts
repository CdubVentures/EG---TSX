/**
 * Sample ad image lookup — maps display sizes to SVG ad creatives.
 * SVG sources live in config/media/sample-ads/ and are imported at build time.
 * Only used when LOAD_SAMPLE_ADS is true (dev/layout verification).
 *
 * 3 variants per size (18 total). A per-size counter guarantees that two
 * slots with the same display size always show different ads.
 */

// WHY: ?raw imports return the SVG source as a string for inline rendering.
// 18 SVGs × ~3 KB each ≈ 54 KB total — only included when LOAD_SAMPLE_ADS is true.

// ── 970x250 (leaderboard) ──
import svg970x250_0 from '../../../config/media/sample-ads/970x250-0.svg?raw';
import svg970x250_1 from '../../../config/media/sample-ads/970x250-1.svg?raw';
import svg970x250_2 from '../../../config/media/sample-ads/970x250-2.svg?raw';

// ── 336x280 (large rectangle) ──
import svg336x280_0 from '../../../config/media/sample-ads/336x280-0.svg?raw';
import svg336x280_1 from '../../../config/media/sample-ads/336x280-1.svg?raw';
import svg336x280_2 from '../../../config/media/sample-ads/336x280-2.svg?raw';

// ── 300x600 (half page) ──
import svg300x600_0 from '../../../config/media/sample-ads/300x600-0.svg?raw';
import svg300x600_1 from '../../../config/media/sample-ads/300x600-1.svg?raw';
import svg300x600_2 from '../../../config/media/sample-ads/300x600-2.svg?raw';

// ── 300x450 (tall rectangle) ──
import svg300x450_0 from '../../../config/media/sample-ads/300x450-0.svg?raw';
import svg300x450_1 from '../../../config/media/sample-ads/300x450-1.svg?raw';
import svg300x450_2 from '../../../config/media/sample-ads/300x450-2.svg?raw';

// ── 300x400 (medium tall) ──
import svg300x400_0 from '../../../config/media/sample-ads/300x400-0.svg?raw';
import svg300x400_1 from '../../../config/media/sample-ads/300x400-1.svg?raw';
import svg300x400_2 from '../../../config/media/sample-ads/300x400-2.svg?raw';

// ── 300x300 (square) ──
import svg300x300_0 from '../../../config/media/sample-ads/300x300-0.svg?raw';
import svg300x300_1 from '../../../config/media/sample-ads/300x300-1.svg?raw';
import svg300x300_2 from '../../../config/media/sample-ads/300x300-2.svg?raw';

const sampleAdVariants: Record<string, string[]> = {
  '970x250': [svg970x250_0, svg970x250_1, svg970x250_2],
  '336x280': [svg336x280_0, svg336x280_1, svg336x280_2],
  '300x600': [svg300x600_0, svg300x600_1, svg300x600_2],
  '300x450': [svg300x450_0, svg300x450_1, svg300x450_2],
  '300x400': [svg300x400_0, svg300x400_1, svg300x400_2],
  '300x300': [svg300x300_0, svg300x300_1, svg300x300_2],
};

// WHY: Per-size counter — each call to getSampleAdSvg for the same size
// returns the NEXT variant. Two 300x400 slots on the same page always
// show different ads. Counter resets per build (module-level state).
const sizeCounters: Record<string, number> = {};

/** Look up an inline SVG ad creative by WxH display size. */
export function getSampleAdSvg(
  width: number,
  height: number,
): string | undefined {
  const key = `${width}x${height}`;
  const variants = sampleAdVariants[key];
  if (!variants || variants.length === 0) return undefined;
  const idx = (sizeCounters[key] ?? 0) % variants.length;
  sizeCounters[key] = idx + 1;
  return variants[idx];
}
