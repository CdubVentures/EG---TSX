/** OAuth popup/redirect logic — Google and Discord only. */

import { hydrateAuth, closeAuth, $auth } from './store';

const POPUP_WIDTH = 500;
const POPUP_HEIGHT = 700;
const FALLBACK_POLL_INTERVAL = 1000;

/** Detect mobile: touch device or narrow screen (matches nav breakpoint). */
function isMobile(): boolean {
  return (
    'ontouchstart' in window ||
    navigator.maxTouchPoints > 0 ||
    window.innerWidth <= 1150
  );
}

/**
 * Open OAuth popup for Google/Discord login.
 * Desktop: popup → postMessage from callback → hydrates → closes popup.
 * Mobile/tablet: sets eg_return cookie → full-page redirect → callback 302s back.
 */
export function openOAuthPopup(path: string): void {
  if (isMobile()) {
    // WHY: store current page so callback can 302 back here instead of /
    document.cookie = `eg_return=${encodeURIComponent(
      window.location.pathname + window.location.search
    )}; Path=/; SameSite=Lax; Max-Age=300`;
    window.location.href = path;
    return;
  }

  // Desktop: popup window
  const left = Math.round(window.screenX + (window.outerWidth - POPUP_WIDTH) / 2);
  const top = Math.round(window.screenY + (window.outerHeight - POPUP_HEIGHT) / 2);
  const features = `width=${POPUP_WIDTH},height=${POPUP_HEIGHT},left=${left},top=${top},toolbar=no,menubar=no,scrollbars=yes`;

  const popup = window.open(path, 'eg-auth-popup', features);

  // Layer 1: postMessage from callback page (immediate, most reliable)
  const onMessage = (e: MessageEvent) => {
    if (e.data === 'eg-auth-done' && e.origin === window.location.origin) {
      cleanup();
      hydrateAuth().then(() => closeAuth());
    }
  };
  window.addEventListener('message', onMessage);

  // Layer 2: BroadcastChannel — already handled by store.ts listener

  // WHY: No popup.closed detection. Cognito's Hosted UI sets
  // Cross-Origin-Opener-Policy which severs the popup reference,
  // making popup.closed return true immediately (false positive).
  // Any grace-period-based cancellation would race against the user
  // typing credentials (email login takes 15-60s). The 10-minute
  // timeout is the real safety net for abandoned popups.

  // Layer 3: Cookie poll (primary fallback when COOP breaks postMessage)
  const timer = setInterval(() => {
    if (document.cookie.includes('eg_hint=1') && $auth.get().status !== 'authenticated') {
      cleanup();
      hydrateAuth().then(() => closeAuth());
    }
  }, FALLBACK_POLL_INTERVAL);

  function cleanup() {
    window.removeEventListener('message', onMessage);
    clearInterval(timer);
    clearTimeout(timeout);
    try { popup?.close(); } catch {}
  }

  const timeout = setTimeout(cleanup, 600_000);
}
