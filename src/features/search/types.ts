// ─── Search Feature Types ────────────────────────────────────────────────────

/** Shape returned by /api/search — used by SearchDialog and future search page. */
export interface SearchResult {
  title: string;
  url: string;
  type: 'product' | 'review' | 'guide' | 'news' | 'brand' | 'game';
  category?: string;
  imageUrl?: string;
  imageFit?: 'cover' | 'contain';
  snippet?: string;
  brand?: string;
}
