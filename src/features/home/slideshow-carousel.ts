/**
 * slideshow-carousel.ts — Client-side carousel logic for HomeSlideshow.
 * Extracted from HomeSlideshow.astro <script> block (pure move, zero logic changes).
 *
 * Handles: Embla init, autoplay, lazy loading, vault toggle hydration,
 * category filtering, drag suppression, visibility pause/resume.
 */
import EmblaCarousel from 'embla-carousel';
import { createElement } from 'react';
import { createRoot } from 'react-dom/client';
import VaultToggleButton from '@features/vault/components/VaultToggleButton';

// ─── Constants ──────────────────────────────────────────────────────────────
const AUTO_INTERVAL = 5000;
const RESET_AFTER_INTERACTION = 5000;

// ─── State ──────────────────────────────────────────────────────────────────
let embla: ReturnType<typeof EmblaCarousel> | null = null;
let autoID: ReturnType<typeof setInterval> | null = null;
let isPaused = false;
let isTabPaused = false;
const lastSelectedPerCategory: Record<string, string> = {};

// ─── Lazy-load helpers ──────────────────────────────────────────────────────
function loadImgIfNeeded(img: HTMLImageElement | null) {
  if (!img) return;
  if (img.dataset.src) { img.src = img.dataset.src; delete img.dataset.src; }
  if (img.dataset.srcset) { img.srcset = img.dataset.srcset; delete img.dataset.srcset; }
  if (img.dataset.sizes) { img.sizes = img.dataset.sizes; delete img.dataset.sizes; }
}

function loadAllImgs(el: Element) {
  el.querySelectorAll<HTMLImageElement>('img[data-src], img[data-srcset]').forEach(loadImgIfNeeded);
}

// ─── Re-hydrate vault toggles on cloned slides ────────────────────────────
// WHY: Embla's cloneNode(true) creates dead DOM copies — Astro's React
// hydration doesn't survive cloning. We mount fresh React roots on each
// cloned .vault-toggle-slot using the serialized product data.

type ReactRoot = ReturnType<typeof createRoot>;
const activeVaultRoots: ReactRoot[] = [];

// WHY deferred: CategoryDropdown dispatches slideshow:refresh from a useEffect,
// which can fire while React is mid-render on VaultToggleButton roots.
// Synchronous unmount during an active render throws a React race-condition
// error. Deferring to the next task lets React finish first.
function cleanupVaultRoots() {
  const toUnmount = [...activeVaultRoots];
  activeVaultRoots.length = 0;
  setTimeout(() => {
    for (const root of toUnmount) {
      try { root.unmount(); } catch { /* already unmounted */ }
    }
  }, 0);
}

function hydrateVaultToggles(container: HTMLElement) {
  container.querySelectorAll<HTMLElement>('.vault-toggle-slot').forEach(slot => {
    if (slot.dataset.hydrated) return;

    const productJson = slot.dataset.vaultProduct;
    if (!productJson) return;

    try {
      const product = JSON.parse(productJson);
      slot.innerHTML = '';
      slot.dataset.hydrated = '1';
      const root = createRoot(slot);
      root.render(createElement(VaultToggleButton, { product }));
      activeVaultRoots.push(root);
    } catch {
      // Invalid JSON — leave as-is
    }
  });
}

// ─── Autoplay controls ─────────────────────────────────────────────────────
function clearAutoplay() { if (autoID) { clearInterval(autoID); autoID = null; } }

function startAuto() {
  clearAutoplay();
  if (!isPaused && !isTabPaused && embla) {
    autoID = setInterval(() => embla?.scrollNext(), AUTO_INTERVAL);
  }
}

function pauseAuto(ms: number) {
  clearAutoplay();
  if (!isPaused && !isTabPaused && embla) {
    setTimeout(() => startAuto(), ms);
  }
}

function fullPause() { clearAutoplay(); }
function fullResume() { if (!isPaused && !isTabPaused && embla) startAuto(); }

// ─── Press effect on arrows ─────────────────────────────────────────────────
function pressFX(el: Element | null) {
  if (!el) return;
  const add = () => el.classList.add('active');
  const rem = () => el.classList.remove('active');
  ['mousedown', 'touchstart', 'pointerdown'].forEach(ev => el.addEventListener(ev, add));
  ['mouseup', 'touchend', 'pointerup', 'mouseleave', 'touchcancel', 'pointercancel']
    .forEach(ev => el.addEventListener(ev, rem));
}

// ─── Keyboard support on arrows ─────────────────────────────────────────────
function addKeyboardSupport(el: HTMLElement | null) {
  if (!el) return;
  el.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      el.click();
    }
  });
}

// ─── Overlay counter + pause icon ──────────────────────────────────────────
function getOverlayEls() {
  const overlay = document.querySelector('.slide-info-overlay');
  return {
    curEl: overlay?.querySelector<HTMLElement>('.current-slide-number'),
    totalEl: overlay?.querySelector<HTMLElement>('.total-slides'),
    pauseBtn: overlay?.querySelector<HTMLElement>('.pause-button'),
    barsEl: overlay?.querySelector<HTMLElement>('.bars'),
    playEl: overlay?.querySelector<HTMLElement>('.arrow'),
  };
}

function updatePauseIcon(barsEl: HTMLElement | null | undefined, playEl: HTMLElement | null | undefined) {
  if (!barsEl || !playEl) return;
  barsEl.style.display = isPaused ? 'none' : 'flex';
  playEl.style.display = isPaused ? 'flex' : 'none';
}

// ─── Category color propagation ────────────────────────────────────────────
function updateColor(slideEl: Element | null) {
  const cat = slideEl?.querySelector<HTMLElement>('.compare-toggle')?.dataset.category;
  if (!cat) return;
  document.querySelectorAll(
    '.slide-card-carousel-circle-left, .slide-card-carousel-circle-right, .pause-button'
  ).forEach(el => {
    el.classList.forEach(c => c.endsWith('-color') && el.classList.remove(c));
    el.classList.add(`${cat}-color`);
  });
}

// ─── Prefetch adjacent slide images ────────────────────────────────────────
function prefetch(idx: number, slides: Element[]) {
  if (!slides.length) return;
  const n = (idx + 1) % slides.length;
  const p = (idx - 1 + slides.length) % slides.length;
  [n, p].forEach(i => { const s = slides[i]; if (s) loadAllImgs(s); });
}

// ─── Pristine clone storage for category filtering ─────────────────────────
let cleanClones: HTMLElement[] = [];

// ─── Get current category from dropdown ────────────────────────────────────
function getCategory(): string {
  return document.querySelector<HTMLElement>('.custom-dropdown-button')?.dataset.category || 'all';
}

// ─── Init / rebuild carousel ───────────────────────────────────────────────
function initCarousel(category: string, isFirstRun = false) {
  const root = document.querySelector<HTMLElement>('[data-slideshow]');
  if (!root) return;
  const track = root.querySelector<HTMLElement>('.slideshow-track');
  if (!track) return;

  // Store pristine clones on first run
  if (cleanClones.length === 0) {
    cleanClones = Array.from(track.querySelectorAll<HTMLElement>('.slide-anchor')).map(
      n => n.cloneNode(true) as HTMLElement
    );
  }

  // Destroy existing instance
  if (embla) {
    embla.destroy();
    embla = null;
  }

  // Unmount React roots from previous slides before removing them
  cleanupVaultRoots();

  // Remove old slides from track
  track.querySelectorAll('.slide-anchor').forEach(el => el.remove());

  if (isFirstRun) root.style.opacity = '0';

  // Filter clones by category
  const source = category === 'all'
    ? cleanClones
    : cleanClones.filter(c => c.dataset.category === category);

  // Insert fresh clones into track (Embla container)
  source.forEach(c => track.appendChild(c.cloneNode(true)));

  // Re-hydrate vault toggles on cloned slides (dead after cloneNode)
  hydrateVaultToggles(track);

  // Force reflow before Embla init
  void root.offsetHeight;

  // Init Embla
  embla = EmblaCarousel(root, {
    loop: true,
    dragFree: false,
    containScroll: false,
    align: 'start',
    skipSnaps: false,
    dragThreshold: 10,
  });

  const leftArrow = root.querySelector<HTMLElement>('.left-arrow');
  const rightArrow = root.querySelector<HTMLElement>('.right-arrow');
  const { curEl, totalEl, pauseBtn, barsEl, playEl } = getOverlayEls();

  // Reset pause state
  isPaused = false;
  updatePauseIcon(barsEl, playEl);
  startAuto();

  // Drag pauses autoplay
  embla.on('pointerDown', () => pauseAuto(RESET_AFTER_INTERACTION));

  // Pause button
  if (pauseBtn) {
    pauseBtn.onclick = () => {
      isPaused = !isPaused;
      updatePauseIcon(barsEl, playEl);
      isPaused ? fullPause() : fullResume();
    };
  }

  // Arrow buttons
  pressFX(leftArrow);
  pressFX(rightArrow);
  addKeyboardSupport(leftArrow);
  addKeyboardSupport(rightArrow);

  if (leftArrow) {
    leftArrow.onclick = (e) => {
      e.preventDefault();
      embla?.scrollPrev();
      pauseAuto(AUTO_INTERVAL);
    };
  }
  if (rightArrow) {
    rightArrow.onclick = (e) => {
      e.preventDefault();
      embla?.scrollNext();
      pauseAuto(AUTO_INTERVAL);
    };
  }

  // Compare toggle pauses
  root.onclick = (e) => {
    if ((e.target as Element)?.closest('.compare-label, .compare-toggle')) {
      pauseAuto(RESET_AFTER_INTERACTION);
    }
  };

  // Update overlay counter
  function updateOverlayCounter() {
    if (!embla) return;
    const total = embla.slideNodes().length;
    const idx = embla.selectedScrollSnap();
    if (curEl) curEl.textContent = String(total ? idx + 1 : 0);
    if (totalEl) totalEl.textContent = String(total);
  }

  // On slide change
  embla.on('select', () => {
    const slides = Array.from(root.querySelectorAll('.slide-anchor'));
    const idx = embla!.selectedScrollSnap();
    updateOverlayCounter();

    // Lazy-load current slide
    const current = slides[idx];
    if (current) {
      loadAllImgs(current);
      updateColor(current);
    }

    // Prefetch adjacent
    prefetch(idx, slides);
  });

  // WHY rAF not 'settle': the settle handler can be destroyed if slideshow:refresh
  // fires before Embla settles (race with CategoryDropdown mount). Checking the
  // actual DOM state makes this resilient to any destroy/recreate timing.
  if (root.style.opacity === '0') {
    requestAnimationFrame(() => { root.style.opacity = ''; });
  }

  updateOverlayCounter();

  // Load first slide images immediately
  const firstSlide = root.querySelector('.slide-anchor');
  if (firstSlide) {
    loadAllImgs(firstSlide);
    updateColor(firstSlide);
  }

  // Restore remembered position
  const remembered = lastSelectedPerCategory[category];
  if (remembered) {
    const slides = Array.from(root.querySelectorAll<HTMLElement>('.slide-anchor'));
    const idx = slides.findIndex(a => a.dataset.id === remembered);
    if (idx !== -1) {
      embla.scrollTo(idx, true);
      updateOverlayCounter();
    }
  }

  // Hover on current slide pauses briefly
  root.querySelectorAll<HTMLElement>('.slide-anchor').forEach((a, i) => {
    a.onmouseenter = () => {
      if (embla && i === embla.selectedScrollSnap()) pauseAuto(AUTO_INTERVAL);
    };
  });

  // Drag suppression — prevent link activation during drag
  let pointerStartX = 0;
  let wasDragged = false;

  root.addEventListener('pointerdown', (e) => {
    pointerStartX = e.clientX;
    wasDragged = false;
  }, { passive: true });

  root.addEventListener('pointermove', (e) => {
    if (Math.abs(e.clientX - pointerStartX) > 3) wasDragged = true;
  }, { passive: true });

  root.addEventListener('click', (e) => {
    const anchor = (e.target as Element)?.closest('.slide-anchor');
    if (anchor && wasDragged) {
      e.preventDefault();
      e.stopPropagation();
    }
  }, true);
}

// ─── Refresh listener (called by CategoryDropdown via CustomEvent) ────────
window.addEventListener('slideshow:refresh', () => {
  if (embla) {
    const slides = document.querySelectorAll<HTMLElement>('[data-slideshow] .slide-anchor');
    const idx = embla.selectedScrollSnap();
    const curAnchor = slides[idx];
    if (curAnchor?.dataset.id && curAnchor.dataset.category) {
      lastSelectedPerCategory[curAnchor.dataset.category] = curAnchor.dataset.id;
    }
  }
  initCarousel(getCategory());
});

// ─── Tab visibility pause/resume ───────────────────────────────────────────
document.addEventListener('visibilitychange', () => {
  if (!embla) return;
  if (document.hidden) {
    isTabPaused = true;
    fullPause();
  } else {
    isTabPaused = false;
    fullResume();
  }
});

// ─── Public init ──────────────────────────────────────────────────────────
export function initSlideshow() {
  initCarousel('all', true);

  // Load all images after page load (background prefetch)
  window.addEventListener('load', () => {
    document.querySelectorAll<HTMLElement>('[data-slideshow] .slide-anchor').forEach(a => {
      loadAllImgs(a);
    });
  });
}
