/**
 * cadence-engine.mjs - Pure injection point calculator.
 */

/**
 * Calculate sorted injection indices for auto-placed inline ads.
 *
 * @param {{
 *   anchorCount: number;
 *   wordCount: number;
 *   firstAfter: number;
 *   every: number;
 *   max: number;
 *   wordsPerAd: number;
 *   minFirstAdWords: number;
 *   manualAdIndices: number[];
 * }} input
 * @returns {number[]}
 */
export function calculateInjectionPoints(input) {
  const {
    anchorCount,
    wordCount,
    firstAfter,
    every,
    max,
    wordsPerAd,
    minFirstAdWords,
    manualAdIndices,
  } = input;

  if (anchorCount === 0) return [];
  if (minFirstAdWords > 0 && wordCount < minFirstAdWords) return [];

  const wordScaledMax = wordsPerAd > 0
    ? Math.max(1, Math.floor(wordCount / wordsPerAd))
    : max;

  const effectiveMax = Math.min(max, wordScaledMax);
  const manualCount = manualAdIndices.length;
  const autoSlots = Math.max(0, effectiveMax - manualCount);

  if (autoSlots === 0) return [];

  const minSpacing = Math.max(1, firstAfter);
  const result = [];
  let nextIndex = Math.max(1, firstAfter);

  while (result.length < autoSlots && nextIndex < anchorCount) {
    const tooCloseToManual = manualAdIndices.some(
      (manualIndex) => Math.abs(nextIndex - manualIndex) < minSpacing,
    );

    if (!tooCloseToManual) {
      result.push(nextIndex);
    }

    nextIndex += every;
  }

  return result;
}
