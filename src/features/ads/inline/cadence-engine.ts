/**
 * cadence-engine.ts — Pure injection point calculator.
 *
 * Determines WHERE to auto-inject inline ads in article content.
 * Zero DOM/HAST dependency — pure numbers in, indices out.
 */

// ─── Types ──────────────────────────────────────────────────────────────

export interface CadenceInput {
  anchorCount: number;       // total content anchors in the article
  wordCount: number;         // total word count
  firstAfter: number;        // first ad after N anchors (0-based index)
  every: number;             // then every M anchors after previous injection
  max: number;               // hard cap on total ads
  wordsPerAd: number;        // word-scaling divisor (0 = disabled)
  minFirstAdWords: number;   // suppress all ads if word count below this
  manualAdIndices: number[]; // indices where author placed <InlineAd />
}

// ─── Public API ─────────────────────────────────────────────────────────

/** Calculate sorted injection indices for auto-placed inline ads. */
export function calculateInjectionPoints(input: CadenceInput): number[] {
  const {
    anchorCount, wordCount, firstAfter, every, max,
    wordsPerAd, minFirstAdWords, manualAdIndices,
  } = input;

  // No content → no ads
  if (anchorCount === 0) return [];

  // Below minimum word threshold → suppress all
  if (minFirstAdWords > 0 && wordCount < minFirstAdWords) return [];

  // Word-scaling: how many ads the content can sustain
  // WHY max(1, ...): if the article passed the threshold, guarantee at least 1 ad.
  const wordScaledMax = wordsPerAd > 0
    ? Math.max(1, Math.floor(wordCount / wordsPerAd))
    : max;

  // Effective cap: minimum of hard max and word-scaled max
  const effectiveMax = Math.min(max, wordScaledMax);

  // Total budget includes manual ads
  const manualCount = manualAdIndices.length;
  const autoSlots = Math.max(0, effectiveMax - manualCount);

  if (autoSlots === 0) return [];

  // WHY: manual ads at known positions affect spacing. An auto ad must be
  // at least `firstAfter` positions away from any manual ad to avoid
  // over-density in the content.
  const minSpacing = Math.max(1, firstAfter);
  const result: number[] = [];

  // Walk cadence positions
  let nextIndex = Math.max(1, firstAfter); // never index 0

  while (result.length < autoSlots && nextIndex < anchorCount) {
    // Check spacing against all manual ads
    const tooCloseToManual = manualAdIndices.some(
      m => Math.abs(nextIndex - m) < minSpacing,
    );

    if (!tooCloseToManual) {
      result.push(nextIndex);
    }
    nextIndex += every;
  }

  return result;
}
