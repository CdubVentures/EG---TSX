// ─── Slug derivation helpers ─────────────────────────────────────────────────
// Pure functions — testable, no side effects.
// The slug is the URL segment and the stable primary key (filename-based).

/** "Alienware - AW610M [id = 1].md" → "alienware-aw610m" */
export function fileNameToSlug(fileName: string): string {
  return fileName
    .replace(/\[id\s*=\s*\d+\]/g, '')   // strip [id = N]
    .replace(/\s*\(\d+\)\s*/g, '')        // strip (N) used in game files
    .replace(/\.mdx?$/i, '')              // strip extension
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')          // non-alphanumeric → hyphen
    .replace(/^-+|-+$/g, '');             // strip leading/trailing hyphens
}

/** "Alienware" + "AW610M" → "alienware-aw610m" */
export function productToSlug(brand: string, model: string): string {
  return `${toSlug(brand)}-${toSlug(model)}`;
}

/** Generic string → URL slug */
export function toSlug(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** Brand slug from brand name: "Logitech G" → "logitech-g" */
export function brandNameToSlug(brandName: string): string {
  return toSlug(brandName);
}

/** Game slug from game name: "Apex Legends" → "apex-legends" */
export function gameNameToSlug(gameName: string): string {
  return toSlug(gameName);
}
