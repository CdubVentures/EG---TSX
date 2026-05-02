import type { APIRoute } from 'astro';
import { imageDefaults } from '@core/config';
import { getImageWithFallback } from '@core/media';
import type { ProductMedia } from '@core/media';
import {
  VaultThumbResolveRequestSchema,
  VaultThumbResolveResponseSchema,
} from '@features/vault/server/schema';
import { jsonNoIndex } from '@core/seo/indexation-policy';

export const prerender = false;

const CACHE_HEADERS = { 'Cache-Control': 'public, max-age=60, s-maxage=300' };

interface ProductDataLike {
  slug: string;
  brand: string;
  model: string;
  category: string;
  imagePath: string;
  url?: string;
  media: ProductMedia;
}

interface ProductLookupEntry {
  productId: string;
  slug: string;
  brand: string;
  model: string;
  category: string;
  imagePath: string;
  media: ProductMedia;
}

function normalizeKey(value: string): string {
  return value.trim().toLowerCase();
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function addLookup(map: Map<string, ProductLookupEntry[]>, key: string, entry: ProductLookupEntry): void {
  const normalizedKey = normalizeKey(key);
  if (!normalizedKey) return;
  const current = map.get(normalizedKey) ?? [];
  current.push(entry);
  map.set(normalizedKey, current);
}

function buildLookupMap(products: Array<{ id: string; data: unknown }>): Map<string, ProductLookupEntry[]> {
  const byKey = new Map<string, ProductLookupEntry[]>();

  for (const product of products) {
    const data = product.data as ProductDataLike;
    if (!data || !data.slug || !data.category || !data.imagePath || !data.media) continue;

    const entry: ProductLookupEntry = {
      productId: data.slug,
      slug: data.slug,
      brand: data.brand,
      model: data.model,
      category: data.category,
      imagePath: data.imagePath,
      media: data.media,
    };

    const parts = data.imagePath.split('/').filter(Boolean);
    const pathCategory = parts[1] ?? data.category;
    const pathBrand = parts[2] ?? '';
    const pathSlug = parts[3] ?? data.slug;
    const fullPathKey = pathBrand
      ? `${pathCategory}/${pathBrand}/${pathSlug}`
      : `${pathCategory}/${pathSlug}`;
    const hubsPathKey = `hubs/${fullPathKey}`;

    addLookup(byKey, product.id, entry);
    addLookup(byKey, data.slug, entry);
    addLookup(byKey, `${data.category}/${data.slug}`, entry);
    addLookup(byKey, `${pathCategory}/${pathSlug}`, entry);
    addLookup(byKey, pathSlug, entry);
    addLookup(byKey, fullPathKey, entry);
    addLookup(byKey, hubsPathKey, entry);
    addLookup(byKey, `/${hubsPathKey}`, entry);
    if (pathBrand) {
      addLookup(byKey, `${pathBrand}/${pathSlug}`, entry);
      addLookup(byKey, `${pathCategory}/${pathBrand}/${pathSlug}`, entry);
    }

    if (isNonEmptyString(data.url)) {
      addLookup(byKey, data.url, entry);
      addLookup(byKey, data.url.replace(/^\/+/, ''), entry);
    }
  }

  return byKey;
}

function buildRequestIdVariants(requestId: string): string[] {
  const seen = new Set<string>();
  const variants: string[] = [];

  const add = (value: string): void => {
    const normalized = normalizeKey(value);
    if (!normalized || seen.has(normalized)) return;
    seen.add(normalized);
    variants.push(value);
  };

  const trimmed = requestId.trim();
  add(trimmed);

  const noOrigin = trimmed.replace(/^https?:\/\/[^/]+/i, '');
  add(noOrigin);

  const noQuery = noOrigin.split(/[?#]/, 1)[0] ?? noOrigin;
  add(noQuery);

  const noLeadingSlash = noQuery.replace(/^\/+/, '');
  add(noLeadingSlash);

  if (noLeadingSlash.startsWith('hubs/')) {
    add(noLeadingSlash.slice('hubs/'.length));
  }

  const parts = noLeadingSlash.split('/').filter(Boolean);
  if (parts.length >= 3) add(parts.slice(-3).join('/'));
  if (parts.length >= 2) add(parts.slice(-2).join('/'));
  if (parts.length >= 1) add(parts[parts.length - 1] ?? '');

  return variants;
}

function getCandidatesByRequestId(
  byKey: Map<string, ProductLookupEntry[]>,
  requestId: string,
): ProductLookupEntry[] {
  for (const variant of buildRequestIdVariants(requestId)) {
    const candidates = byKey.get(normalizeKey(variant));
    if (candidates && candidates.length > 0) return candidates;
  }
  return [];
}

function pickByCategory(candidates: ProductLookupEntry[], category: string): ProductLookupEntry | null {
  const exact = candidates.find(candidate => candidate.category === category);
  if (exact) return exact;
  return candidates[0] ?? null;
}

async function loadProducts(): Promise<Array<{ id: string; data: unknown }>> {
  const mockGetProducts = globalThis.__mockGetProducts;
  if (mockGetProducts) {
    return mockGetProducts();
  }

  const { getProducts } = await import('@core/products');
  return getProducts() as unknown as Array<{ id: string; data: unknown }>;
}

export const POST: APIRoute = async ({ request }) => {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonNoIndex({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parsedRequest = VaultThumbResolveRequestSchema.safeParse(body);
  if (!parsedRequest.success) {
    return jsonNoIndex(
      { error: 'Validation failed', details: parsedRequest.error.issues },
      { status: 400 },
    );
  }

  const products = await loadProducts();
  const byKey = buildLookupMap(products);

  const resolvedItems = parsedRequest.data.items.flatMap((item) => {
    const candidates = getCandidatesByRequestId(byKey, item.requestId);
    if (!candidates || candidates.length === 0) return [];

    const match = pickByCategory(candidates, item.category);
    if (!match) return [];

    const defaults = imageDefaults(match.category);
    const thumb = getImageWithFallback(match.media, defaults.defaultImageView)
      ?? getImageWithFallback(match.media, defaults.coverImageView);
    if (!thumb) return [];

    return [{
      requestId: item.requestId,
      productId: match.productId,
      category: match.category,
      slug: match.slug,
      brand: match.brand,
      model: match.model,
      imagePath: match.imagePath,
      thumbnailStem: thumb.stem,
    }];
  });

  const parsedResponse = VaultThumbResolveResponseSchema.safeParse({ items: resolvedItems });
  if (!parsedResponse.success) {
    return jsonNoIndex({ error: 'Response validation failed' }, { status: 500 });
  }

  return jsonNoIndex(parsedResponse.data, { headers: CACHE_HEADERS });
};
