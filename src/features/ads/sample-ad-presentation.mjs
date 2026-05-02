function toTitleCase(value) {
  return String(value || '')
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(' ');
}

function normalize(value) {
  return String(value || '').trim().toLowerCase();
}

function includesOneOf(value, tokens) {
  return tokens.some((token) => value.includes(token));
}

function resolveVariant(creative) {
  const brand = normalize(creative?.brand);
  const campaign = normalize(creative?.campaign);
  const offer = normalize(creative?.offer);

  if (includesOneOf(brand, ['glow ritual', 'lumaskin', 'derma daily'])) {
    return 'beauty';
  }

  if (includesOneOf(brand, ['apex drive', 'vertex auto'])) {
    return 'auto';
  }

  if (includesOneOf(brand, ['signalos', 'northline desk'])) {
    return 'software';
  }

  if (includesOneOf(brand, ['maison slate', 'atelier lane'])) {
    return 'fashion';
  }

  if (includesOneOf(brand, ['fresh pantry']) || campaign.includes('cart') || offer.includes('delivery')) {
    return 'grocery';
  }

  return 'editorial';
}

function buildBadge(variant, creative) {
  if (variant === 'beauty') return 'Launch Drop';
  if (variant === 'auto') return 'Reserve Test Drive';
  if (variant === 'software') return toTitleCase(creative?.cta || 'Open Demo');
  if (variant === 'fashion') return 'Shop the Drop';
  if (variant === 'grocery') return 'Free Delivery';
  return toTitleCase(creative?.campaign || 'Sponsored');
}

function buildKicker(variant) {
  if (variant === 'beauty') return 'Creator Routine';
  if (variant === 'auto') return 'New Model Launch';
  if (variant === 'software') return 'Workflow Platform';
  if (variant === 'fashion') return 'Season Edit';
  if (variant === 'grocery') return 'Weekly Essentials';
  return 'Sponsored Feature';
}

export function buildSampleOverlayPresentation(creative) {
  if (!creative || creative.kind !== 'video') {
    return null;
  }

  const variant = resolveVariant(creative);
  return {
    variant,
    sponsorLabel: creative.networkLabel ? `Sponsored · ${creative.networkLabel}` : 'Sponsored',
    kicker: buildKicker(variant),
    badge: buildBadge(variant, creative),
    brand: creative.brand,
    headline: creative.headline,
    offer: creative.offer,
    cta: creative.cta,
    disclaimer: creative.disclaimer,
    duration: creative.duration,
  };
}
