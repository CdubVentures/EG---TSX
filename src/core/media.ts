// ─── Product Media Helpers ──────────────────────────────────────────────────
// Pure functions for querying the structured `media` object in product JSON.
// No side effects, no imports — just data queries.

// ─── Types ──────────────────────────────────────────────────────────────────

export interface ProductImage {
  stem: string;
  view: string;
  color?: string;
  edition?: string;
  seq?: number;
}

export interface ProductMedia {
  defaultColor: string | null;
  defaultEdition?: string | null;
  colors: string[];
  editions: string[];
  images: ProductImage[];
}

// Views that are SVG shape diagrams, not photos
const SHAPE_VIEWS = new Set(['side', 'top']);

/** Is this a photo view (not a shape diagram)? */
function isPhotoView(img: ProductImage): boolean {
  // "top" is a shape only when it has no color and the stem is exactly "top" (SVG shape).
  // But "top" with or without color can also be a photo (imgTop).
  // Shapes are always stem === view (no color, no edition, no seq).
  // We identify shapes by checking: view is in SHAPE_VIEWS AND no color AND no edition AND no seq
  // AND stem exactly equals view (no separators).
  if (!SHAPE_VIEWS.has(img.view)) return true;
  return img.color !== undefined || img.edition !== undefined || img.seq !== undefined || img.stem !== img.view;
}

type ImageScore = [number, number, number, string, string];

function normalizeToken(value: string | null | undefined): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function resolveTargetColor(media: ProductMedia, color?: string): string | null {
  return normalizeToken(color) ?? normalizeToken(media.defaultColor);
}

function resolveTargetEdition(media: ProductMedia, edition?: string): string | null {
  return normalizeToken(edition) ?? normalizeToken(media.defaultEdition);
}

function colorRank(imageColor: string | undefined, targetColor: string | null): number {
  const normalized = normalizeToken(imageColor);
  if (targetColor) {
    if (normalized === targetColor) return 0;
    if (!normalized) return 1;
    return 2;
  }
  return normalized ? 1 : 0;
}

function editionRank(imageEdition: string | undefined, targetEdition: string | null): number {
  const normalized = normalizeToken(imageEdition);
  if (targetEdition) {
    if (normalized === targetEdition) return 0;
    if (!normalized) return 1;
    return 2;
  }
  return normalized ? 1 : 0;
}

function scoreImage(image: ProductImage, targetColor: string | null, targetEdition: string | null): ImageScore {
  return [
    colorRank(image.color, targetColor),
    editionRank(image.edition, targetEdition),
    image.seq ?? 0,
    normalizeToken(image.edition) ?? '',
    image.stem,
  ];
}

function compareScore(a: ImageScore, b: ImageScore): number {
  const [aColor, aEdition, aSeq, aEditionLabel, aStem] = a;
  const [bColor, bEdition, bSeq, bEditionLabel, bStem] = b;

  if (aColor !== bColor) return aColor - bColor;
  if (aEdition !== bEdition) return aEdition - bEdition;
  if (aSeq !== bSeq) return aSeq - bSeq;
  if (aEditionLabel !== bEditionLabel) return aEditionLabel < bEditionLabel ? -1 : 1;
  if (aStem !== bStem) return aStem < bStem ? -1 : 1;
  return 0;
}

// ─── Public API ─────────────────────────────────────────────────────────────

/**
 * Get carousel-ready images, optionally filtered by color.
 * Excludes SVG shape views (side, top shapes).
 * When a color is specified, returns images matching that color + colorless images.
 * When no color specified on a multi-color product, returns default-color + colorless images.
 */
export function getCarouselImages(media: ProductMedia, color?: string): ProductImage[] {
  if (media.images.length === 0) return [];

  const photos = media.images.filter(isPhotoView);

  // No color system — return all photos
  if (media.colors.length === 0 && !color) return photos;

  const targetColor = color ?? media.defaultColor;

  return photos.filter(img => {
    // Colorless images always included
    if (!img.color) return true;
    // Color-specific images only if they match the target
    return img.color === targetColor;
  });
}

/**
 * Get the best single image for a view, optionally for a specific color.
 * Falls back to default (colorless/editionless) image when needed.
 */
export function getImage(media: ProductMedia, view: string, color?: string, edition?: string): ProductImage | null {
  if (media.images.length === 0) return null;

  const viewImages = media.images.filter(img => img.view === view);
  if (viewImages.length === 0) return null;

  const targetColor = resolveTargetColor(media, color);
  const targetEdition = resolveTargetEdition(media, edition);

  const [firstImage, ...remainingImages] = viewImages;
  if (!firstImage) return null;

  let best = firstImage;
  let bestScore = scoreImage(best, targetColor, targetEdition);

  for (const candidate of remainingImages) {
    const candidateScore = scoreImage(candidate, targetColor, targetEdition);
    if (compareScore(candidateScore, bestScore) < 0) {
      best = candidate;
      bestScore = candidateScore;
    }
  }

  return best;
}

/**
 * Try views in order, return the first match or null.
 * WHY: defaultImageView and listThumbKeyBase are now fallback chains (arrays).
 */
export function getImageWithFallback(
  media: ProductMedia,
  views: string[],
  color?: string,
  edition?: string,
): ProductImage | null {
  for (const view of views) {
    const img = getImage(media, view, color, edition);
    if (img) return img;
  }
  return null;
}

/**
 * Try views in order, but only return a match when stemExists confirms the
 * actual file is on disk at the needed size variant.
 *
 * WHY: media.images[] proves a view exists, but specific size variants (_t, _l)
 * may be missing. This function adds filesystem-aware fallback so consumers
 * never reference a 404.
 *
 * @param stemExists — predicate: receives the stem string, returns true if the
 *   file exists at the size the consumer needs (e.g. `stem => fs.existsSync(...)`)
 */
export function resolveImage(
  media: ProductMedia,
  views: string[],
  stemExists: (stem: string) => boolean,
  color?: string,
  edition?: string,
): ProductImage | null {
  for (const view of views) {
    const img = getImage(media, view, color, edition);
    if (!img) continue;
    if (!stemExists(img.stem)) continue;
    return img;
  }
  return null;
}

/**
 * Get an image for a specific color + view, with fallback to default color.
 */
export function getImageForColor(
  media: ProductMedia,
  color: string,
  view: string,
  edition?: string,
): ProductImage | null {
  return getImage(media, view, color, edition);
}

/**
 * Get all available colors from the media object.
 */
export function getAvailableColors(media: ProductMedia): string[] {
  return media.colors;
}

/**
 * Check if a product has multiple color variants.
 */
export function hasColorVariants(media: ProductMedia): boolean {
  return media.colors.length > 1;
}
