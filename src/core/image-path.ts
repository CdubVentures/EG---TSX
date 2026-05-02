export interface BuildContentImageUrlOptions {
  baseUrl?: string;
  imagePath: string;
  stem: string;
  size: string;
  ext?: string;
}

export function normalizeContentImagePath(imagePath: string): string {
  const normalized = String(imagePath || '')
    .trim()
    .replace(/\\/g, '/')
    .replace(/^images\//, '/images/')
    .replace(/^\/images\/data-products\//, '/images/')
    .replace(/^images\/data-products\//, '/images/')
    .replace(/\/{2,}/g, '/');

  if (!normalized) {
    return '';
  }

  const withLeadingSlash = normalized.startsWith('/') ? normalized : `/${normalized}`;
  return withLeadingSlash.endsWith('/') ? withLeadingSlash.slice(0, -1) : withLeadingSlash;
}

export function buildContentImageUrl({
  baseUrl = '',
  imagePath,
  stem,
  size,
  ext = 'webp',
}: BuildContentImageUrlOptions): string {
  const normalizedBaseUrl = String(baseUrl || '').trim().replace(/\/+$/, '');
  const normalizedImagePath = normalizeContentImagePath(imagePath);
  return `${normalizedBaseUrl}${normalizedImagePath}/${stem}_${size}.${ext}`;
}
