/**
 * bootstrap.ts — Client-side ad hydration.
 *
 * Vite-processed module imported from MainLayout.astro.
 * Replaces HBS ads_bootstrap.js + ads_inline_bootstrap.js.
 *
 * Simplifications vs HBS:
 * - No runtime config fetches (baked in at build time via AD_REGISTRY)
 * - No campaign alias resolution (campaigns are explicit in templates)
 * - placementType from registry replaces runtime DOM inference
 */

import { AD_REGISTRY, ADSENSE_CLIENT } from './config';
import type { AdSlotConfig } from './config';

// ─── Types ──────────────────────────────────────────────────────────────

type ProviderRoute = 'adsense' | 'gpt' | 'direct' | 'native';

interface BootstrapState {
  mounted: Set<Element>;
  adsenseLoaded: boolean;
  gptLoaded: boolean;
}

// ─── Module state ───────────────────────────────────────────────────────

const state: BootstrapState = {
  mounted: new Set(),
  adsenseLoaded: false,
  gptLoaded: false,
};

// ═══════════════════════════════════════════════════════════════════════════
// PURE FUNCTIONS — testable without DOM
// ═══════════════════════════════════════════════════════════════════════════

/** Convert "300x250,336x280" to [[300,250],[336,280]] for GPT defineSlot. */
export function parseSizesForGPT(sizes: string): number[][] {
  if (!sizes) return [];
  return sizes.split(',')
    .map(s => {
      const parts = s.trim().split('x').map(Number);
      return parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1]) ? parts : null;
    })
    .filter((s): s is number[] => s !== null);
}

/** Returns a warning string if AdSense + sticky, null otherwise. */
export function checkStickyPolicy(
  provider: string,
  sticky: boolean,
  campaign: string,
): string | null {
  if (provider === 'adsense' && sticky) {
    return `[egAds] Sticky ad "${campaign}" uses AdSense — AdSense prohibits sticky positioning.`;
  }
  return null;
}

/** Returns true if the element is hidden (no layout box). */
export function isSlotHidden(el: Pick<HTMLElement, 'offsetParent'>): boolean {
  return el.offsetParent === null;
}

/** Validate and return the provider route, or null if unknown. */
export function resolveProviderRoute(provider: string): ProviderRoute | null {
  const valid: ProviderRoute[] = ['adsense', 'gpt', 'direct', 'native'];
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
    '.ad-slot:not([data-placeholder="true"])'
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
  const campaign = el.dataset.campaign ?? '';
  const sticky = el.dataset.sticky === 'true';

  // Sticky policy check
  const warning = checkStickyPolicy(provider, sticky, campaign);
  if (warning) console.warn(warning);

  const route = resolveProviderRoute(provider);
  switch (route) {
    case 'adsense':
      mountAdSense(el);
      break;
    case 'gpt':
      mountGPT(el, campaign);
      break;
    case 'direct':
      mountDirect(el, campaign);
      break;
    case 'native':
      // WHY: native ads are handled by NativeCard component, not bootstrap
      break;
    default:
      console.warn(`[egAds] Unknown provider "${provider}" for campaign "${campaign}"`);
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
    const w = window as Record<string, unknown>;
    w.adsbygoogle = (w.adsbygoogle as unknown[]) || [];
    (w.adsbygoogle as unknown[]).push({});
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
// GPT (Google Publisher Tags)
// ═══════════════════════════════════════════════════════════════════════════

function mountGPT(el: HTMLElement, campaign: string): void {
  const config = AD_REGISTRY[campaign];
  if (!config?.slot) return;

  ensureGPT(() => {
    const sizes = parseSizesForGPT(config.sizes);
    const divId = `gpt-${campaign}-${Date.now()}`;

    const container = document.createElement('div');
    container.id = divId;
    el.appendChild(container);

    const gt = (window as Record<string, any>).googletag;
    gt.defineSlot(config.slot, sizes, divId)
      .addService(gt.pubads());
    gt.pubads().enableSingleRequest();
    gt.enableServices();
    gt.display(divId);

    el.dataset.fill = 'filled';
  });
}

function ensureGPT(callback: () => void): void {
  const w = window as Record<string, any>;
  w.googletag = w.googletag || { cmd: [] };

  if (!state.gptLoaded) {
    state.gptLoaded = true;
    const script = document.createElement('script');
    script.async = true;
    script.src = 'https://securepubads.g.doubleclick.net/tag/js/gpt.js';
    document.head.appendChild(script);
  }

  w.googletag.cmd.push(callback);
}

// ═══════════════════════════════════════════════════════════════════════════
// DIRECT (sponsor image links)
// ═══════════════════════════════════════════════════════════════════════════

function mountDirect(el: HTMLElement, campaign: string): void {
  const config = AD_REGISTRY[campaign];
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
  (window as Record<string, unknown>).egAds = { init, mountAll };
}
