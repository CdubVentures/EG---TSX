// ─── Brand tile types for site-index brand dashboard ────────────────────────
// WHY: Brands differ from article dashboards — they use logo tiles in a 3×2 grid
// instead of 3-slot hero+side cards. These types define the brand-specific data shape.

export interface BrandTileItem {
  slug: string;
  name: string;
  url: string;
  logoBase: string;               // e.g. "/images/brands/razer/brand-logo-horizontal-index"
  logoBaseLight: string;          // e.g. "/images/brands/razer/brand-logo-horizontal-primary"
  logoStyle?: string;             // CSS object-fit override (null = "contain")
  categories: string[];           // index page membership (all category pages)
  navbar: string[];               // nav mega-menu display (curated subset of categories)
  iDashboard?: string;            // e.g. "all_1" — pin to slot 1 in all-view
  iFilteredDashboard?: string;    // e.g. "mouse_3" — pin to slot 3 in mouse view
  sortDate?: string;              // max(datePublished, dateUpdated) — ISO date string for sorting
}
