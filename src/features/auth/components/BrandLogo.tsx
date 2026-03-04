/**
 * BrandLogo.tsx — "EG GEAR" wordmark for React context.
 *
 * WHY: Astro components can't render inside React islands.
 * Uses the SAME global CSS classes as NavLogo.astro (.site-name,
 * .navsitename1, .navsitename2) — one CSS definition, identical markup.
 * Only the parent font-size changes per context.
 */

export default function BrandLogo() {
  return (
    <span className="site-name">
      <span className="navsitename1">EG</span>
      <span className="navsitename2">GEAR</span>
    </span>
  );
}
