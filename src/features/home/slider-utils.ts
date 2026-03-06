// ─── Slider Utilities ────────────────────────────────────────────────────────
// Pure functions for horizontal slider arrow state logic.
// Used by GamesScroller and future slider components.

export interface ArrowState {
  leftActive: boolean;
  rightActive: boolean;
}

/**
 * Compute arrow active/inactive state from scroll position.
 * WHY: Extracted as pure function so it's testable without DOM.
 *
 * @param scrollLeft  - Current scroll position (pixels from left)
 * @param scrollWidth - Total scrollable content width
 * @param clientWidth - Visible viewport width
 */
export function computeArrowState(
  scrollLeft: number,
  scrollWidth: number,
  clientWidth: number,
): ArrowState {
  const maxScroll = scrollWidth - clientWidth;

  // Content fits entirely — no scrolling possible
  if (maxScroll <= 0) {
    return { leftActive: false, rightActive: false };
  }

  return {
    leftActive: scrollLeft > 0,
    // WHY: browser rounding can leave scrollLeft 1px short of true max
    rightActive: scrollLeft < maxScroll - 1,
  };
}
