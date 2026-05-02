/**
 * bootstrap.ts — Client-side ad hydration.
 *
 * Vite-processed module imported from MainLayout.astro.
 * Replaces HBS ads_bootstrap.js + ads_inline_bootstrap.js.
 *
 * Simplifications vs HBS:
 * - No runtime config fetches (baked in at build time via AD_POSITIONS)
 * - No position alias resolution (positions are explicit in templates)
 * - placementType from registry replaces runtime DOM inference
 */

import { AD_POSITIONS, ADSENSE_CLIENT } from './config';

// ─── Types ──────────────────────────────────────────────────────────────

type ProviderRoute = 'adsense' | 'direct';

interface BootstrapState {
  mounted: Set<Element>;
  adsenseLoaded: boolean;
}

interface EgAdsBridge {
  init: () => void;
  mountAll: (root: Document | Element) => void;
}

interface EgAdsWindow extends Window {
  adsbygoogle?: unknown[];
  egAds?: EgAdsBridge;
}

// ─── Module state ───────────────────────────────────────────────────────

const state: BootstrapState = {
  mounted: new Set(),
  adsenseLoaded: false,
};

// ═══════════════════════════════════════════════════════════════════════════
// PURE FUNCTIONS — testable without DOM
// ═══════════════════════════════════════════════════════════════════════════

/** Returns a warning string if AdSense + sticky, null otherwise. */
export function checkStickyPolicy(
  provider: string,
  sticky: boolean,
  position: string,
): string | null {
  if (provider === 'adsense' && sticky) {
    return `[egAds] Sticky ad "${position}" uses AdSense — AdSense prohibits sticky positioning.`;
  }
  return null;
}

/** Returns true if the element is hidden (no layout box). */
export function isSlotHidden(el: Pick<HTMLElement, 'offsetParent'>): boolean {
  return el.offsetParent === null;
}

/** Validate and return the provider route, or null if unknown. */
export function resolveProviderRoute(provider: string): ProviderRoute | null {
  const valid: ProviderRoute[] = ['adsense', 'direct'];
  return valid.includes(provider as ProviderRoute) ? (provider as ProviderRoute) : null;
}

// ═══════════════════════════════════════════════════════════════════════════
// PUBLIC API
// ═══════════════════════════════════════════════════════════════════════════

/** Initialize ad system. Call once from MainLayout. */
export function init(): void {
  // WHY: import.meta.env.PUBLIC_* is inlined by Vite at build time
  const enabled = import.meta.env?.PUBLIC_ADS_ENABLED === 'true';
  const html = document.documentElement;

  if (!enabled) {
    html.classList.add('eg-ads-killed');
    return;
  }

  html.classList.add('eg-ads-on');
  mountAll(document);
}

/** Find and mount all live ad slots within a root element. */
export function mountAll(root: Document | Element): void {
  const slots = root.querySelectorAll<HTMLElement>(
    '.ad-slot:not([data-placeholder="true"]):not(.ad-slot--sample)'
  );
  slots.forEach(slot => scheduleMount(slot));
}

// ═══════════════════════════════════════════════════════════════════════════
// SCHEDULING — above-fold immediate, below-fold lazy
// ═══════════════════════════════════════════════════════════════════════════

function scheduleMount(el: HTMLElement): void {
  if (state.mounted.has(el)) return;
  state.mounted.add(el);

  if (isAboveFold(el)) {
    mountSlot(el);
  } else {
    lazyMount(el);
  }
}

function isAboveFold(el: HTMLElement): boolean {
  const rect = el.getBoundingClientRect();
  return rect.top < window.innerHeight;
}

function lazyMount(el: HTMLElement): void {
  const io = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          io.disconnect();
          mountSlot(el);
        }
      }
    },
    { rootMargin: '200px' },
  );
  io.observe(el);
}

// ═══════════════════════════════════════════════════════════════════════════
// PROVIDER ROUTING
// ═══════════════════════════════════════════════════════════════════════════

function mountSlot(el: HTMLElement): void {
  // WHY: prevents wasted impressions on slots hidden by CSS (e.g., sidebar on mobile).
  // A hidden slot has no offsetParent. Requesting an ad that's never seen tanks CTR
  // and viewability scores, hurting domain reputation with ad networks.
  if (isSlotHidden(el)) return;

  const provider = el.dataset.provider ?? '';
  const position = el.dataset.position ?? '';
  const sticky = el.dataset.sticky === 'true';

  // Sticky policy check
  const warning = checkStickyPolicy(provider, sticky, position);
  if (warning) console.warn(warning);

  const route = resolveProviderRoute(provider);
  switch (route) {
    case 'adsense':
      mountAdSense(el);
      break;
    case 'direct':
      mountDirect(el, position);
      break;
    default:
      console.warn(`[egAds] Unknown provider "${provider}" for position "${position}"`);
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// ADSENSE
// ═══════════════════════════════════════════════════════════════════════════

function mountAdSense(el: HTMLElement): void {
  ensureAdSense();

  const ins = el.querySelector<HTMLElement>('ins.adsbygoogle');
  if (!ins) return;

  const isInline = el.dataset.placementType === 'inline';

  // WHY: AdSense injects height:auto!important on inline ads, causing CLS
  if (isInline) {
    watchAutoSizing(ins);
  }

  // Push to adsbygoogle queue — triggers ad request
  try {
    const w = window as EgAdsWindow;
    w.adsbygoogle ??= [];
    w.adsbygoogle.push({});
  } catch (e) {
    console.error('[egAds] AdSense push failed:', e);
  }

  // Observe fill status
  observeFill(el, ins);
}

function ensureAdSense(): void {
  if (state.adsenseLoaded) return;
  state.adsenseLoaded = true;

  const script = document.createElement('script');
  script.async = true;
  script.crossOrigin = 'anonymous';
  script.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADSENSE_CLIENT}`;
  document.head.appendChild(script);
}

/** Watch for and strip Google-injected height:auto!important on inline ads. */
function watchAutoSizing(ins: HTMLElement): void {
  const mo = new MutationObserver(() => {
    const style = ins.getAttribute('style') ?? '';
    if (style.includes('height') && style.includes('auto')) {
      ins.style.removeProperty('height');
    }
  });
  mo.observe(ins, { attributes: true, attributeFilter: ['style'] });
}

// ═══════════════════════════════════════════════════════════════════════════
// DIRECT (sponsor image links)
// ═══════════════════════════════════════════════════════════════════════════

function mountDirect(el: HTMLElement, position: string): void {
  const config = AD_POSITIONS[position];
  if (!config?.img || !config?.href) return;

  const link = document.createElement('a');
  link.href = config.href;
  link.rel = 'nofollow sponsored noopener';
  link.target = '_blank';

  const img = document.createElement('img');
  img.src = config.img;
  img.alt = 'Sponsored';
  img.width = config.width ?? 300;
  img.height = config.height ?? 250;
  img.loading = 'lazy';

  link.appendChild(img);
  el.appendChild(link);
  el.dataset.fill = 'filled';
}

// ═══════════════════════════════════════════════════════════════════════════
// FILL OBSERVATION
// ═══════════════════════════════════════════════════════════════════════════

function observeFill(el: HTMLElement, ins: HTMLElement): void {
  // WHY: AdSense sets data-adsbygoogle-status or data-ad-status when done
  const mo = new MutationObserver(() => {
    const status =
      ins.dataset.adsbygoogleStatus ??
      ins.dataset.adStatus ??
      '';

    if (status === 'done') {
      const iframe = el.querySelector('iframe');
      const filled = iframe != null && iframe.offsetHeight > 0;
      el.dataset.fill = filled ? 'filled' : 'unfilled';
      mo.disconnect();
    }
  });

  mo.observe(ins, {
    attributes: true,
    attributeFilter: ['data-adsbygoogle-status', 'data-ad-status'],
  });

  // WHY: handle race — status may already be set if script loaded fast
  const existing = ins.dataset.adsbygoogleStatus ?? ins.dataset.adStatus;
  if (existing === 'done') {
    const iframe = el.querySelector('iframe');
    const filled = iframe != null && iframe.offsetHeight > 0;
    el.dataset.fill = filled ? 'filled' : 'unfilled';
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// GLOBAL EXPOSURE
// ═══════════════════════════════════════════════════════════════════════════

if (typeof window !== 'undefined') {
  const w = window as EgAdsWindow;
  w.egAds = { init, mountAll };
}
