// ─── DexaBadge pure logic (shared by component + tests) ─────────────────────

/**
 * Format a score value for display inside the hex badge.
 * @param {number|string|null|undefined} score
 * @returns {{ text: string, render: boolean }}
 */
export function formatScore(score) {
  if (score === null || score === undefined || score === '') return { text: '', render: false };
  const value = Number(score);
  if (!Number.isFinite(value)) return { text: '', render: false };
  const text = value === 10 ? '10' : value.toFixed(1);
  return { text, render: true };
}

/**
 * Return inline letter-spacing style for the score text.
 * Score "10" needs extra spacing to avoid cramping the two digits.
 * @param {number|string} score
 * @returns {string} CSS property string or empty
 */
export function scoreLetterSpacing(score) {
  return Number(score) === 10 ? 'letter-spacing:1.75px' : '';
}

/** Counter for unique gradient IDs within a single build. */
let _counter = 0;

/**
 * Generate a unique gradient ID for each DexaBadge instance.
 * Uses a simple counter — sufficient for Astro SSG (single process, deterministic order).
 * @returns {string}
 */
export function makeGradientId() {
  return `dexaGrad-${++_counter}`;
}
