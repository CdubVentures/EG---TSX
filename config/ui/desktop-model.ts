export interface NavItem {
  key: string;
  label: string;
  icon: string;
}

export interface ShellTheme {
  id: string;
  label: string;
  mode: string;
}

export interface ShellPayload {
  appTitle: string;
  projectRootName?: string;
  theme: ShellTheme;
  accent: string;
  navItems: NavItem[];
  statusText: string;
  versions: Record<string, number>;
}

export interface ToggleState {
  production: boolean;
  vite: boolean;
}

export interface CollectionsState {
  dataProducts: boolean;
  reviews: boolean;
  guides: boolean;
  news: boolean;
}

export type DerivedColors = Record<string, string>;

export interface IconStatus {
  exists: boolean;
  label: string;
  path: string;
  tooltip: string;
}

export interface CategoryCounts {
  products: number;
  reviews: number;
  guides: number;
  news: number;
}

export interface CategoryCardData {
  id: string;
  label: string;
  plural: string;
  color: string;
  derivedColors: DerivedColors;
  product: ToggleState;
  content: ToggleState;
  collections: CollectionsState;
  counts: CategoryCounts;
  countText: string;
  presence: {
    hasProducts: boolean;
    hasContent: boolean;
  };
  showProductToggles: boolean;
  showContentToggles: boolean;
  iconStatus: IconStatus;
}

export interface SiteColors {
  primary: string;
  secondary: string;
  derivedColors: DerivedColors;
}

export interface CategoriesPanelPayload {
  siteColors: SiteColors;
  categories: CategoryCardData[];
  categoryCount: number;
  statusRight: string;
  version: number;
}

export type ContentCollectionKey =
  | 'reviews'
  | 'guides'
  | 'news'
  | 'brands'
  | 'games';

export type ContentCollectionFilter = 'all' | ContentCollectionKey;

export type ContentSortKey =
  | 'sortDate'
  | 'datePublished'
  | 'dateUpdated'
  | 'pinned'
  | 'badge';

export interface ContentSummary {
  totalArticles: number;
  eligibleArticles: number;
  disabledArticles: number;
  slotCount: number;
  manualCount: number;
  pinnedCount: number;
  badgedCount: number;
  excludedCount: number;
}

export interface ContentArticleData {
  key: string;
  collection: ContentCollectionKey;
  collectionLabel: string;
  collectionColor: string;
  entryId: string;
  title: string;
  category: string;
  categoryLabel: string;
  categoryColor: string;
  datePublished: string;
  dateUpdated: string;
  sortDate: string;
  dateText: string;
  hasHero: boolean;
  fullArticle: boolean;
  draft: boolean;
  categoryActive: boolean;
  isPinned: boolean;
  badge: string;
  isExcluded: boolean;
  isManualAssigned: boolean;
  feedLabels: string[];
  feedPosition: number;
}

export interface ContentDashboardSlot {
  slotNumber: number;
  rowIndex: number;
  columnStart: number;
  columnSpan: number;
  rowWeight: number;
  rowLabel: string;
  isManual: boolean;
  manualKey: string;
  article: ContentArticleData | null;
}

export type ContentTabs = Record<ContentCollectionKey, ContentArticleData[]>;

export interface ContentPanelPayload {
  summary: ContentSummary;
  statusRight: string;
  manualSlots: Record<string, string>;
  pinned: string[];
  badges: Record<string, string>;
  excluded: string[];
  dashboardSlots: ContentDashboardSlot[];
  articlePool: ContentArticleData[];
  tabs: ContentTabs;
  version: number;
}

export type IndexHeroTypeKey = 'reviews' | 'news' | 'guides' | 'brands';

export interface IndexHeroTypeConfig {
  key: IndexHeroTypeKey;
  label: string;
  color: string;
  slotCount: number;
}

export interface IndexHeroCategory {
  key: string;
  label: string;
  count: number;
  color: string;
}

export interface IndexHeroCandidate {
  key: string;
  type: IndexHeroTypeKey;
  title: string;
  category: string;
  categoryLabel: string;
  categoryColor: string;
  categories: string[];
  dateText: string;
  sortDate: string;
  isPinned: boolean;
  badge: string;
}

export type IndexHeroPools = Record<IndexHeroTypeKey, IndexHeroCandidate[]>;
export type IndexHeroSlots = Record<IndexHeroTypeKey, Array<IndexHeroCandidate | null>>;
export type IndexHeroCategoryMap = Record<IndexHeroTypeKey, IndexHeroCategory[]>;
export type IndexHeroOverrides = Record<IndexHeroTypeKey, Record<string, string[]>>;

export interface IndexHeroesPanelPayload {
  types: IndexHeroTypeConfig[];
  activeType: IndexHeroTypeKey;
  activeCategory: string;
  categories: IndexHeroCategoryMap;
  pools: IndexHeroPools;
  slots: IndexHeroSlots;
  overrides: IndexHeroOverrides;
  statusRight: string;
  version: number;
}

export type HubToolTypeKey = 'hub' | 'database' | 'versus' | 'radar' | 'shapes';

export type HubToolsIndexView = 'all' | HubToolTypeKey;

export interface HubToolTypeConfig {
  key: HubToolTypeKey;
  label: string;
}

export interface HubToolCategory {
  id: string;
  label: string;
  color: string;
  productActive: boolean;
  enabledCount: number;
  totalCount: number;
}

export interface HubToolEntry {
  tool: string;
  title: string;
  description: string;
  subtitle: string;
  url: string;
  svg: string;
  enabled: boolean;
  navbar: boolean;
  hero: string;
}

export type HubToolsByCategory = Record<string, HubToolEntry[]>;
export type HubToolsTooltipMap = Record<HubToolTypeKey, string>;
export type HubToolsIndexMap = Record<string, string[]>;

export interface HubToolsPanelPayload {
  toolTypes: HubToolTypeConfig[];
  categories: HubToolCategory[];
  tools: HubToolsByCategory;
  tooltips: HubToolsTooltipMap;
  index: HubToolsIndexMap;
  statusRight: string;
  version: number;
}

// ── Navbar panel types ─────────────────────────────────────────────────

export interface NavbarGuideItem {
  slug: string;
  category: string;
  guide: string;
  title: string;
  section: string;
}

export interface NavbarGuideSection {
  name: string;
  items: NavbarGuideItem[];
}

export interface NavbarBrandItem {
  slug: string;
  displayName: string;
  categories: string[];
  navbar: string[];
}

export interface NavbarGameItem {
  slug: string;
  game: string;
  title: string;
  navbar: boolean;
}

export interface NavbarHubCategory {
  id: string;
  label: string;
  color: string;
  productActive: boolean;
  viteActive: boolean;
}

export type NavbarSectionOrder = Record<string, string[]>;

export interface NavbarPanelPayload {
  guideSections: Record<string, NavbarGuideSection[]>;
  sectionOrder: NavbarSectionOrder;
  brands: NavbarBrandItem[];
  games: NavbarGameItem[];
  hubs: NavbarHubCategory[];
  categoryColors: Record<string, string>;
  categoryLabels: Record<string, string>;
  statusRight: string;
  version: number;
}

export interface NavbarGuideChange {
  slug: string;
  category: string;
  navbar: string[];
}

export interface NavbarBrandChange {
  slug: string;
  categories: string[];
  navbar: string[];
}

export interface NavbarGameChange {
  slug: string;
  navbar: boolean;
}

export interface NavbarRename {
  slug: string;
  collection: 'guides' | 'brands' | 'games';
  field: string;
  value: string;
}

export interface NavbarLocalChanges {
  guideChanges: Record<string, NavbarGuideChange>;
  brandChanges: Record<string, NavbarBrandChange>;
  gameChanges: Record<string, NavbarGameChange>;
  renames: NavbarRename[];
  sectionOrder: NavbarSectionOrder | null;
}

export interface NavbarSaveRequest {
  guideChanges: NavbarGuideChange[];
  brandChanges: NavbarBrandChange[];
  gameChanges: NavbarGameChange[];
  renames: NavbarRename[];
  sectionOrder: NavbarSectionOrder | null;
}

export function emptyNavbarChanges(): NavbarLocalChanges {
  return {
    guideChanges: {},
    brandChanges: {},
    gameChanges: {},
    renames: [],
    sectionOrder: null,
  };
}

export function toNavbarRequestPayload(changes: NavbarLocalChanges): NavbarSaveRequest {
  return {
    guideChanges: Object.values(changes.guideChanges).sort((a, b) =>
      a.slug.localeCompare(b.slug),
    ),
    brandChanges: Object.values(changes.brandChanges).sort((a, b) =>
      a.slug.localeCompare(b.slug),
    ),
    gameChanges: Object.values(changes.gameChanges).sort((a, b) =>
      a.slug.localeCompare(b.slug),
    ),
    renames: [...changes.renames],
    sectionOrder: changes.sectionOrder,
  };
}

export function snapshotNavbar(changes: NavbarLocalChanges): string {
  return JSON.stringify(toNavbarRequestPayload(changes));
}

// ── Slideshow panel types ────────────────────────────────────────────────

export interface SlideshowProduct {
  entryId: string;
  slug: string;
  brand: string;
  model: string;
  category: string;
  overall: number;
  releaseDate: string;
  imagePath: string;
  imageCount: number;
  hasDeal: boolean;
}

export interface SlideshowPanelPayload {
  products: SlideshowProduct[];
  slides: string[];
  maxSlides: number;
  categoryColors: Record<string, string>;
  categoryLabels: Record<string, string>;
  statusRight: string;
  version: number;
}

export interface SlideshowSaveRequest {
  slides: string[];
  maxSlides: number;
}

export function toSlideshowRequestPayload(panel: SlideshowPanelPayload): SlideshowSaveRequest {
  return {
    slides: [...panel.slides],
    maxSlides: panel.maxSlides,
  };
}

export function snapshotSlideshow(panel: SlideshowPanelPayload | null): string {
  if (!panel) {
    return '';
  }
  return JSON.stringify(toSlideshowRequestPayload(panel));
}

// ── Image Defaults panel types ──────────────────────────────────────────

export interface ImageDefaultsViewStat {
  view: string;
  count: number;
  coveragePct: number;
  status: 'common' | 'partial' | 'sparse' | 'anomaly';
  isCanonical: boolean;
}

export interface ImageDefaultsCategoryScannerData {
  categoryId: string;
  productCount: number;
  views: ImageDefaultsViewStat[];
}

export interface ImageDefaultsCategoryPill {
  id: string;
  label: string;
  color: string;
  productCount: number;
}

export interface ImageDefaultsViewMeta {
  objectFit: 'contain' | 'cover';
  label: string;
  labelShort: string;
}

export interface ImageDefaultsDisplayOption {
  view: string;
  labelFull: string;
  labelShort: string;
}

export interface ImageDefaultsConfig {
  defaultImageView: string[];
  listThumbKeyBase: string[];
  coverImageView: string[];
  headerGame: string[];
  viewPriority: string[];
  imageDisplayOptions: ImageDefaultsDisplayOption[];
  viewMeta: Record<string, ImageDefaultsViewMeta>;
}

export interface ImageDefaultsPanelPayload {
  defaults: ImageDefaultsConfig;
  categories: Record<string, Partial<ImageDefaultsConfig>>;
  scanner: Record<string, ImageDefaultsCategoryScannerData>;
  categoryPills: ImageDefaultsCategoryPill[];
  canonicalViews: string[];
  categoryColors: Record<string, string>;
  categoryLabels: Record<string, string>;
  statusRight: string;
  version: number;
}

export interface ImageDefaultsSaveRequest {
  defaults: ImageDefaultsConfig;
  categories: Record<string, Partial<ImageDefaultsConfig>>;
}

export function toImageDefaultsRequestPayload(panel: ImageDefaultsPanelPayload): ImageDefaultsSaveRequest {
  return {
    defaults: structuredClone(panel.defaults),
    categories: structuredClone(panel.categories),
  };
}

export function snapshotImageDefaults(panel: ImageDefaultsPanelPayload | null): string {
  if (!panel) {
    return '';
  }
  return JSON.stringify(toImageDefaultsRequestPayload(panel));
}

// ── Cache / CDN panel types ──────────────────────────────────────────────

export interface CachePolicy {
  browserMaxAge: number;
  edgeMaxAge: number;
  staleWhileRevalidate: number;
  mustRevalidate: boolean;
  immutable: boolean;
  noStore: boolean;
  varyQuery: 'none' | 'all';
  varyHeaders: string[];
  invalidationGroup: string;
}

export interface CachePageType {
  label: string;
  description: string;
  policy: string;
}

export interface CacheTarget {
  id: string;
  label: string;
  pathPatterns: string[];
  pageType: string;
}

export interface CacheCdnConfig {
  policies: Record<string, CachePolicy>;
  pageTypes: Record<string, CachePageType>;
  targets: CacheTarget[];
}

export interface CacheCdnPanelPayload {
  config: CacheCdnConfig;
  statusRight: string;
  version: number;
}

export interface CacheCdnSaveRequest {
  config: CacheCdnConfig;
}

export function toCacheCdnRequestPayload(panel: CacheCdnPanelPayload): CacheCdnSaveRequest {
  return {
    config: structuredClone(panel.config),
  };
}

export function snapshotCacheCdn(panel: CacheCdnPanelPayload | null): string {
  if (!panel) {
    return '';
  }
  return JSON.stringify(toCacheCdnRequestPayload(panel));
}

// ── Ads panel types ─────────────────────────────────────────────────────

export interface AdsGlobal {
  adsenseClient: string;
  adLabel: string;
  showProductionPlaceholders: boolean;
  loadSampleAds: boolean;
  sampleAdMode: string;
  sampleAdNetwork: string;
}

export interface AdsPosition {
  provider: 'adsense' | 'direct';
  adSlot: string;
  sizes: string;
  display: boolean;
  placementType?: 'rail' | 'inline';
  notes: string;
  // Direct provider fields
  img?: string;
  href?: string;
  width?: number;
  height?: number;
}

export interface AdsRegistry {
  global: AdsGlobal;
  positions: Record<string, AdsPosition>;
}

export interface InlineCadence {
  firstAfter: number;
  every: number;
  max: number;
}

export interface InlineWordScaling {
  enabled: boolean;
  desktopWordsPerAd: number;
  mobileWordsPerAd: number;
  minFirstAdWords: number;
}

export interface InlineCollectionConfig {
  enabled: boolean;
  desktop?: InlineCadence;
  mobile?: InlineCadence;
  wordScaling?: InlineWordScaling;
}

export interface InlineAdsConfig {
  defaults: { position: string };
  collections: Record<string, InlineCollectionConfig>;
}

export interface SponsorCreative {
  label: string;
  img: string;
  href: string;
  width: number;
  height: number;
  weight: number;
  startDate: string;
  endDate: string;
  rel: string;
  alt: string;
}

export interface SponsorsConfig {
  creatives: Record<string, SponsorCreative[]>;
}

export interface AdsPanelPayload {
  registry: AdsRegistry;
  inline: InlineAdsConfig;
  sponsors: SponsorsConfig;
  adsEnabled: boolean;
  statusRight: string;
  version: number;
}

export interface AdsSaveRequest {
  registry: AdsRegistry;
  inline: InlineAdsConfig;
  sponsors: SponsorsConfig;
  adsEnabled: boolean;
}

export function toAdsRequestPayload(panel: AdsPanelPayload): AdsSaveRequest {
  return {
    registry: structuredClone(panel.registry),
    inline: structuredClone(panel.inline),
    sponsors: structuredClone(panel.sponsors),
    adsEnabled: panel.adsEnabled,
  };
}

export function snapshotAds(panel: AdsPanelPayload | null): string {
  if (!panel) {
    return '';
  }
  return JSON.stringify(toAdsRequestPayload(panel));
}

export interface AdsScanRow {
  file: string;
  line: number;
  position: string;
  provider: string;
  display: string;
}

export interface AdsScanResult {
  rows: AdsScanRow[];
  orphans: string[];
  enabledCollections: string[];
  disabledCollections: string[];
}

export interface BootstrapPayload {
  shell: ShellPayload;
  panels: {
    categories: CategoriesPanelPayload;
    content: ContentPanelPayload;
    indexHeroes: IndexHeroesPanelPayload;
    hubTools: HubToolsPanelPayload;
    navbar: NavbarPanelPayload;
    slideshow: SlideshowPanelPayload;
    imageDefaults: ImageDefaultsPanelPayload;
    cacheCdn: CacheCdnPanelPayload;
    ads: AdsPanelPayload;
  };
}

export interface WatchPayload {
  changed: string[];
  versions: Record<string, number>;
}

export interface PreviewPayload<TPanel> {
  shell: ShellPayload;
  panel: TPanel;
}

export interface SavePayload<TPanel> extends PreviewPayload<TPanel> {
  savedAt: string;
  message: string;
}

export interface PoolFilterOptions {
  collection: ContentCollectionFilter;
  search: string;
}

function compareStrings(left: string, right: string): number {
  return left.localeCompare(right, undefined, { sensitivity: 'base' });
}

function compareDatesDesc(left: string, right: string): number {
  return right.localeCompare(left);
}

function toSortedRecord(
  entries: Iterable<[string, string]>,
  compareKeys?: (left: string, right: string) => number,
): Record<string, string> {
  return Object.fromEntries(
    Array.from(entries).sort(([left], [right]) =>
      compareKeys ? compareKeys(left, right) : compareStrings(left, right),
    ),
  );
}

export function uniqueSorted(values: readonly string[]): string[] {
  return Array.from(new Set(values)).sort(compareStrings);
}

function compareNumericKeys(left: string, right: string): number {
  return Number.parseInt(left, 10) - Number.parseInt(right, 10);
}

function compareIndexCategoryKeys(left: string, right: string): number {
  if (left === '_all' && right !== '_all') {
    return -1;
  }
  if (right === '_all' && left !== '_all') {
    return 1;
  }
  return compareStrings(left, right);
}

function uniqueInOrder(values: readonly string[]): string[] {
  const seen = new Set<string>();
  return values.filter((value) => {
    if (seen.has(value)) {
      return false;
    }
    seen.add(value);
    return true;
  });
}

const HUB_INDEX_VIEW_ORDER: string[] = ['all', 'hub', 'database', 'versus', 'radar', 'shapes'];

function compareHubIndexViews(left: string, right: string): number {
  const leftIndex = HUB_INDEX_VIEW_ORDER.indexOf(left);
  const rightIndex = HUB_INDEX_VIEW_ORDER.indexOf(right);
  if (leftIndex !== -1 || rightIndex !== -1) {
    if (leftIndex === -1) {
      return 1;
    }
    if (rightIndex === -1) {
      return -1;
    }
    return leftIndex - rightIndex;
  }
  return compareStrings(left, right);
}

function normalizeIndexHeroOverrides(
  overrides: IndexHeroOverrides,
): IndexHeroOverrides {
  const typeOrder: IndexHeroTypeKey[] = ['reviews', 'news', 'guides', 'brands'];
  const normalized = {} as IndexHeroOverrides;

  for (const type of typeOrder) {
    const categories = overrides[type] ?? {};
    const sortedCategories = Object.keys(categories).sort(compareIndexCategoryKeys);

    normalized[type] = {};
    for (const category of sortedCategories) {
      const cleaned = uniqueInOrder(
        (categories[category] ?? []).map((value) => value.trim()).filter(Boolean),
      );
      if (cleaned.length > 0) {
        normalized[type][category] = cleaned;
      }
    }
  }

  return normalized;
}

export function getSidebarFooterText(
  shell: Pick<ShellPayload, 'appTitle' | 'projectRootName'> | null | undefined,
): string {
  const projectRootName = shell?.projectRootName?.trim();
  if (projectRootName) {
    return projectRootName;
  }
  return shell?.appTitle ?? 'EG Config Manager';
}

export function toCategoriesRequestPayload(panel: CategoriesPanelPayload) {
  return {
    siteColors: {
      primary: panel.siteColors.primary,
      secondary: panel.siteColors.secondary,
    },
    categories: panel.categories.map((category) => ({
      id: category.id,
      label: category.label,
      plural: category.plural,
      color: category.color,
      product: { ...category.product },
      content: { ...category.content },
      collections: { ...category.collections },
    })),
  };
}

export function snapshotCategories(panel: CategoriesPanelPayload | null): string {
  if (!panel) {
    return '';
  }
  return JSON.stringify(toCategoriesRequestPayload(panel));
}

export function toContentRequestPayload(panel: ContentPanelPayload) {
  return {
    manualSlots: toSortedRecord(Object.entries(panel.manualSlots), compareNumericKeys),
    pinned: uniqueSorted(panel.pinned),
    badges: toSortedRecord(
      Object.entries(panel.badges)
        .map(([key, value]) => [key, value.trim()] as const)
        .filter(([, value]) => value.length > 0),
    ),
    excluded: uniqueSorted(panel.excluded),
  };
}

export function snapshotContent(panel: ContentPanelPayload | null): string {
  if (!panel) {
    return '';
  }
  return JSON.stringify(toContentRequestPayload(panel));
}

export function toIndexHeroesRequestPayload(panel: IndexHeroesPanelPayload) {
  return {
    activeType: panel.activeType,
    activeCategory: panel.activeCategory,
    overrides: normalizeIndexHeroOverrides(panel.overrides),
  };
}

export function snapshotIndexHeroes(panel: IndexHeroesPanelPayload | null): string {
  if (!panel) {
    return '';
  }
  return JSON.stringify({
    overrides: normalizeIndexHeroOverrides(panel.overrides),
  });
}

function normalizeHubToolsMap(tools: HubToolsByCategory): HubToolsByCategory {
  return Object.fromEntries(
    Object.keys(tools)
      .sort(compareStrings)
      .map((categoryId) => {
        const entries = Array.isArray(tools[categoryId]) ? tools[categoryId] : [];
        const normalizedEntries: HubToolEntry[] = [];
        const seen = new Set<string>();

        for (const entry of entries) {
          const tool = String(entry.tool ?? '').trim().toLowerCase();
          if (!tool || seen.has(tool)) {
            continue;
          }
          seen.add(tool);
          normalizedEntries.push({
            tool,
            title: String(entry.title ?? '').trim(),
            description: String(entry.description ?? '').trim(),
            subtitle: String(entry.subtitle ?? '').trim(),
            url: String(entry.url ?? '').trim(),
            svg: String(entry.svg ?? ''),
            enabled: Boolean(entry.enabled),
            navbar: Boolean(entry.navbar),
            hero: String(entry.hero ?? '').trim(),
          });
        }

        return [categoryId, normalizedEntries];
      }),
  );
}

function normalizeHubTooltips(tooltips: HubToolsTooltipMap): HubToolsTooltipMap {
  return {
    hub: String(tooltips.hub ?? '').trim(),
    database: String(tooltips.database ?? '').trim(),
    versus: String(tooltips.versus ?? '').trim(),
    radar: String(tooltips.radar ?? '').trim(),
    shapes: String(tooltips.shapes ?? '').trim(),
  };
}

function normalizeHubIndex(index: HubToolsIndexMap): HubToolsIndexMap {
  return Object.fromEntries(
    Object.keys(index)
      .sort(compareHubIndexViews)
      .map((view) => [
        view,
        uniqueInOrder((index[view] ?? []).map((value) => value.trim()).filter(Boolean)),
      ]),
  );
}

export function toHubToolsRequestPayload(panel: HubToolsPanelPayload) {
  return {
    tools: normalizeHubToolsMap(panel.tools),
    tooltips: normalizeHubTooltips(panel.tooltips),
    index: normalizeHubIndex(panel.index),
  };
}

export function snapshotHubTools(panel: HubToolsPanelPayload | null): string {
  if (!panel) {
    return '';
  }
  return JSON.stringify(toHubToolsRequestPayload(panel));
}

export function getEligiblePoolArticles(
  panel: ContentPanelPayload,
  options: PoolFilterOptions,
): ContentArticleData[] {
  const search = options.search.trim().toLowerCase();
  return panel.articlePool
    .filter((article) => article.fullArticle)
    .filter((article) => !article.draft)
    .filter((article) => article.hasHero)
    .filter((article) => article.categoryActive)
    .filter((article) => !article.isExcluded)
    .filter((article) => !article.isManualAssigned)
    .filter((article) =>
      options.collection === 'all' ? true : article.collection === options.collection,
    )
    .filter((article) =>
      search.length === 0 ? true : article.title.toLowerCase().includes(search),
    )
    .sort((left, right) => compareStrings(left.title, right.title))
    .sort((left, right) => compareDatesDesc(left.sortDate, right.sortDate));
}

export function sortCollectionArticles(
  articles: readonly ContentArticleData[],
  sortKey: ContentSortKey,
): ContentArticleData[] {
  const sorted = [...articles];

  if (sortKey === 'pinned') {
    return sorted
      .sort((left, right) => compareStrings(left.title, right.title))
      .sort((left, right) => compareDatesDesc(left.sortDate, right.sortDate))
      .sort((left, right) => Number(right.isPinned) - Number(left.isPinned));
  }

  if (sortKey === 'badge') {
    return sorted
      .sort((left, right) => compareStrings(left.title, right.title))
      .sort((left, right) => compareDatesDesc(left.sortDate, right.sortDate))
      .sort((left, right) => Number(Boolean(right.badge)) - Number(Boolean(left.badge)));
  }

  return sorted
    .sort((left, right) => compareStrings(left.title, right.title))
    .sort((left, right) => compareDatesDesc(left[sortKey], right[sortKey]));
}
