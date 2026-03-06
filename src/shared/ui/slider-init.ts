// ─── Shared Slider Init ──────────────────────────────────────────────────────
// Extracted from GamesScroller.astro + FeaturedScroller.astro.
// Provides drag-to-scroll, momentum, arrow navigation, and scroll/resize sync.
// Returns a cleanup function that removes all listeners (AbortController).

export interface SliderOptions {
  slider: HTMLElement;
  leftArrow: HTMLElement | null;
  rightArrow: HTMLElement | null;
}

const DRAG_THRESHOLD = 5;

/** Initialize slider with drag, momentum, arrows. Returns cleanup function. */
export function initSlider(options: SliderOptions): () => void {
  const { slider, leftArrow, rightArrow } = options;
  const ac = new AbortController();
  const { signal } = ac;

  // ── Arrow state management ──────────────────────────────────────────────
  function updateArrows() {
    const scrollLeft = slider.scrollLeft;
    const maxScroll = slider.scrollWidth - slider.clientWidth;

    if (maxScroll <= 0) {
      leftArrow?.classList.add('inactive');
      rightArrow?.classList.add('inactive');
      return;
    }

    if (scrollLeft <= 0) {
      leftArrow?.classList.add('inactive');
    } else {
      leftArrow?.classList.remove('inactive');
    }

    if (scrollLeft >= maxScroll - 1) {
      rightArrow?.classList.add('inactive');
    } else {
      rightArrow?.classList.remove('inactive');
    }
  }

  // ── Arrow click handlers ────────────────────────────────────────────────
  function handleArrowClick(arrow: HTMLElement) {
    arrow.classList.add('active');
    setTimeout(() => arrow.classList.remove('active'), 400);
  }

  leftArrow?.addEventListener('click', (e) => {
    e.stopPropagation();
    handleArrowClick(leftArrow);
    const scrollAmount = Math.min(slider.clientWidth, slider.scrollLeft);
    slider.scrollBy({ left: -scrollAmount, behavior: 'smooth' });
  }, { signal });

  rightArrow?.addEventListener('click', (e) => {
    e.stopPropagation();
    handleArrowClick(rightArrow);
    const maxScroll = Math.round(slider.scrollWidth - slider.clientWidth);
    const remaining = maxScroll - slider.scrollLeft;
    const scrollAmount = Math.min(slider.clientWidth, remaining);
    slider.scrollBy({ left: scrollAmount, behavior: 'smooth' });
  }, { signal });

  // ── Grab-and-go drag ────────────────────────────────────────────────────
  let isDown = false;
  let isDragging = false;
  let startX = 0;
  let startY = 0;
  let scrollLeftStart = 0;
  let velocity = 0;
  let momentumId = 0;
  let lastX = 0;
  let lastTime = 0;
  let clickPrevented = false;

  // Prevent native image/link drag
  slider.querySelectorAll('img').forEach(img =>
    img.addEventListener('dragstart', e => e.preventDefault(), { signal })
  );
  slider.querySelectorAll('a').forEach(link =>
    link.addEventListener('dragstart', e => e.preventDefault(), { signal })
  );

  function momentumScroll() {
    if (Math.abs(velocity) > 0.1) {
      const maxScroll = Math.round(slider.scrollWidth - slider.clientWidth);
      slider.scrollLeft += velocity;
      velocity *= 0.95;

      if (slider.scrollLeft <= 0) {
        slider.scrollLeft = 0;
        velocity = 0;
      } else if (slider.scrollLeft >= maxScroll) {
        slider.scrollLeft = maxScroll;
        velocity = 0;
      }
      momentumId = requestAnimationFrame(momentumScroll);
    } else {
      cancelAnimationFrame(momentumId);
    }
  }

  slider.addEventListener('mousedown', (e) => {
    if ((e.target as Element).closest('button, .button, input')) return;
    isDown = true;
    isDragging = false;
    startX = e.pageX;
    startY = e.pageY;
    scrollLeftStart = slider.scrollLeft;
    velocity = 0;
    lastX = e.pageX;
    lastTime = Date.now();
    cancelAnimationFrame(momentumId);
  }, { signal });

  const stopDrag = (e: MouseEvent) => {
    if (!isDown) return;
    isDown = false;
    if (isDragging) {
      momentumScroll();
      e.preventDefault();
      e.stopPropagation();
      clickPrevented = true;
      setTimeout(() => { clickPrevented = false; }, 100);
    }
    setTimeout(() => { isDragging = false; }, 0);
  };

  slider.addEventListener('mouseleave', stopDrag, { signal });
  slider.addEventListener('mouseup', stopDrag, { signal });

  slider.addEventListener('mousemove', (e) => {
    if (!isDown) return;
    const deltaX = e.pageX - startX;
    const deltaY = e.pageY - startY;
    const absDeltaX = Math.abs(deltaX);
    const absDeltaY = Math.abs(deltaY);

    // Cancel if vertical scroll
    if (absDeltaY > absDeltaX && absDeltaY > DRAG_THRESHOLD) {
      isDown = false;
      return;
    }

    if (!isDragging && absDeltaX > DRAG_THRESHOLD && absDeltaX > absDeltaY) {
      isDragging = true;
    }

    if (isDragging) {
      e.preventDefault();
      const maxScroll = Math.round(slider.scrollWidth - slider.clientWidth);
      slider.scrollLeft = Math.max(0, Math.min(maxScroll, scrollLeftStart - deltaX));

      const now = Date.now();
      const elapsed = now - lastTime;
      const distance = e.pageX - lastX;
      velocity = -(distance / elapsed) * 16;
      lastX = e.pageX;
      lastTime = now;
    }
  }, { signal });

  // Prevent clicks after drag
  slider.addEventListener('click', (e) => {
    if (clickPrevented) {
      e.preventDefault();
      e.stopPropagation();
      clickPrevented = false;
    }
  }, { capture: true, signal });

  // ── Scroll + resize listeners ───────────────────────────────────────────
  let ticking = false;
  slider.addEventListener('scroll', () => {
    if (!ticking) {
      ticking = true;
      requestAnimationFrame(() => {
        updateArrows();
        ticking = false;
      });
    }
  }, { signal });

  window.addEventListener('resize', updateArrows, { signal });

  // Initial state
  updateArrows();

  // ── Cleanup ─────────────────────────────────────────────────────────────
  return () => {
    ac.abort();
    cancelAnimationFrame(momentumId);
  };
}
