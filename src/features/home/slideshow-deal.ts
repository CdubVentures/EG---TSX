interface AffiliateLink {
  url?: string;
  retailer?: string;
  slug?: string;
  variant?: string;
  isPrimary?: boolean;
}

interface SlideshowDealProduct {
  brand: string;
  model: string;
  category: string;
  affiliateLinks?: AffiliateLink[];
}

export interface SlideshowDeal {
  kind: 'primary-affiliate' | 'affiliate-fallback' | 'search-fallback';
  href: string;
  label: 'View Deal' | 'Search Amazon';
  retailer: string;
  slug: string;
  variant?: string;
}

function isValidUrl(url: string | undefined): url is string {
  if (!url) return false;

  try {
    const parsed = new URL(url);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

function toDeal(
  link: AffiliateLink,
  kind: 'primary-affiliate' | 'affiliate-fallback'
): SlideshowDeal | null {
  if (!isValidUrl(link.url)) return null;

  return {
    kind,
    href: link.url,
    label: 'View Deal',
    retailer: String(link.retailer || link.slug || 'retailer').trim().toLowerCase() || 'retailer',
    slug: String(link.slug || link.retailer || 'retailer').trim().toLowerCase() || 'retailer',
    variant: link.variant,
  };
}

function buildAmazonSearchHref(product: SlideshowDealProduct): string | null {
  const brand = String(product.brand || '').trim();
  const model = String(product.model || '').trim();
  const category = String(product.category || '').trim();
  if (!brand || !model || !category) return null;

  const params = new URLSearchParams({
    k: `${brand} ${model} ${category}`,
    tag: 'eggear-20',
  });

  return `https://www.amazon.com/s?${params.toString()}`;
}

export function resolveSlideshowDeal(product: SlideshowDealProduct): SlideshowDeal | null {
  const links = Array.isArray(product.affiliateLinks) ? product.affiliateLinks : [];

  const primary = links.find(link => link?.isPrimary);
  const primaryDeal = primary ? toDeal(primary, 'primary-affiliate') : null;
  if (primaryDeal) return primaryDeal;

  const firstExplicit = links
    .map(link => toDeal(link, 'affiliate-fallback'))
    .find(Boolean);
  if (firstExplicit) return firstExplicit;

  const searchHref = buildAmazonSearchHref(product);
  if (!searchHref) return null;

  return {
    kind: 'search-fallback',
    href: searchHref,
    label: 'Search Amazon',
    retailer: 'amazon',
    slug: 'amazon',
  };
}
