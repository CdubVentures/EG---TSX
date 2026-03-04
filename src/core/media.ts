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
 * Falls back to default (colorless) image if the requested color isn't available.
 */
export function getImage(media: ProductMedia, view: string, color?: string): ProductImage | null {
  if (media.images.length === 0) return null;

  const viewImages = media.images.filter(img => img.view === view);
  if (viewImages.length === 0) return null;

  if (color) {
    const colorMatch = viewImages.find(img => img.color === color);
    if (colorMatch) return colorMatch;
  }

  // Fall back to default (no color)
  const defaultMatch = viewImages.find(img => !img.color);
  if (defaultMatch) return defaultMatch;

  // Last resort: first image for that view
  return viewImages[0];
}

/**
 * Get an image for a specific color + view, with fallback to default color.
 */
export function getImageForColor(media: ProductMedia, color: string, view: string): ProductImage | null {
  return getImage(media, view, color);
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
