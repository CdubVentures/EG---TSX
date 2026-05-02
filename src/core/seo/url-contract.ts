import { normalizeContentImagePath } from '../image-path';

export interface ProductUrlFromImagePathOptions {
  category: string;
  imagePath: string;
  fallbackSlug?: string;
}

function normalizeSegment(value: string | undefined): string {
  return String(value ?? '').trim();
}

export function productUrlFromImagePath({
  category,
  imagePath,
  fallbackSlug,
}: ProductUrlFromImagePathOptions): string {
  const normalizedCategory = normalizeSegment(category);
  if (!normalizedCategory) {
    throw new Error('Product URL requires a category.');
  }

  const normalizedImagePath = normalizeContentImagePath(imagePath);
  let segments = normalizedImagePath.split('/').filter(Boolean);
  if (segments[0] === 'images') {
    segments = segments.slice(1);
  }

  const includesCategorySegment = segments[0] === normalizedCategory || segments.length >= 3;
  if (includesCategorySegment) {
    const pathCategory = normalizeSegment(segments[0]);
    if (!pathCategory) {
      throw new Error('Product URL requires an image path category segment.');
    }
    if (pathCategory !== normalizedCategory) {
      throw new Error(`Product URL category mismatch: expected "${normalizedCategory}", received "${pathCategory}".`);
    }
    segments = segments.slice(1);
  }

  const brandSlug = normalizeSegment(segments[0]);
  if (!brandSlug) {
    throw new Error('Product URL requires a brand slug in the image path.');
  }

  const modelSlug = normalizeSegment(segments[1]) || normalizeSegment(fallbackSlug);
  if (!modelSlug) {
    throw new Error('Product URL requires a model slug in the image path or fallback slug.');
  }

  return `/hubs/${normalizedCategory}/${brandSlug}/${modelSlug}`;
}
