import { createPortal } from 'react-dom';

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
} from 'react';

import {
  getEligiblePoolArticles,
  sortCollectionArticles,
  type CategoriesPanelPayload,
  type CategoryCardData,
  type ContentArticleData,
  type ContentCollectionFilter,
  type ContentCollectionKey,
  type ContentPanelPayload,
  type ContentSortKey,
  type HubToolsIndexView,
  type HubToolsPanelPayload,
  type HubToolTypeKey,
  type IndexHeroCandidate,
  type IndexHeroTypeKey,
  type IndexHeroesPanelPayload,
  type NavbarBrandItem,
  type NavbarPanelPayload,
  type SiteColors,
  type SlideshowPanelPayload,
  type SlideshowProduct,
  type ImageDefaultsPanelPayload,
  type CacheCdnPanelPayload,
  type AdsPanelPayload,
  type AdsScanResult,
  type AdsScanRow,
} from './desktop-model';
import { parseReleaseDate } from './slideshow-editor.mjs';
import { resolveDefaults, computeFallbacks } from './image-defaults-editor.mjs';
import {
  buildPolicyPreview,
  buildPreviewText,
  auditConfig,
  listPageTypeTargets,
  coerceInt,
  cleanHeaders,
  cleanPatterns,
} from './cache-cdn-editor.mjs';
import {
  filterPositions as adsFilterPositions,
  calculateInlineAds,
  getCreativeStatus,
  parseSizes as adsParseSizes,
} from './ads-editor.mjs';
import {
  AutoIcon,
  CategoryPreviewIcon,
  CloseIcon,
  DialogOverlay,
  LabeledField,
  LockIcon,
  PillBar,
  PinIcon,
  StarIcon,
  Toggle,
  ToggleRow,
  useEscapeDismiss,
  type VariableStyle,
} from './shared-ui';

/* ─────────────────────────────────────────────────────────────────
 * Shared drag ghost system
 * Mouse-based drag (not HTML5 DnD) for custom ghost + drop highlighting.
 * ────────────────────────────────────────────────────────────────── */

interface GhostState {
  title: string;
  color: string;
  x: number;
  y: number;
}

interface DragItem {
  source: 'pool' | 'slot';
  key: string;
  slotIndex?: number;
  title: string;
  color: string;
}

function useDragGhost() {
  const [ghost, setGhost] = useState<GhostState | null>(null);
  const [dragItem, setDragItem] = useState<DragItem | null>(null);
  const [dropTarget, setDropTarget] = useState<string | null>(null);
  const [overPool, setOverPool] = useState(false);
  const dragItemRef = useRef<DragItem | null>(null);
  const dropTargetRef = useRef<string | null>(null);
  const overPoolRef = useRef(false);
  const slotsRef = useRef<Map<string, HTMLElement>>(new Map());
  const poolRef = useRef<HTMLElement | null>(null);
  const onDropRef = useRef<((item: DragItem, targetSlotId: string | null, isOverPool: boolean) => void) | null>(null);

  const startDrag = useCallback((item: DragItem, x: number, y: number) => {
    dragItemRef.current = item;
    setDragItem(item);
    setGhost({ title: item.title, color: item.color, x, y });
  }, []);

  const endDrag = useCallback(() => {
    dragItemRef.current = null;
    dropTargetRef.current = null;
    overPoolRef.current = false;
    setDragItem(null);
    setGhost(null);
    setDropTarget(null);
    setOverPool(false);
  }, []);

  const registerSlot = useCallback((id: string, el: HTMLElement | null) => {
    if (el) {
      slotsRef.current.set(id, el);
    } else {
      slotsRef.current.delete(id);
    }
  }, []);

  const registerPool = useCallback((el: HTMLElement | null) => {
    poolRef.current = el;
  }, []);

  const registerOnDrop = useCallback((fn: (item: DragItem, targetSlotId: string | null, isOverPool: boolean) => void) => {
    onDropRef.current = fn;
  }, []);

  useEffect(() => {
    if (!dragItemRef.current) {
      return;
    }

    const handleMouseMove = (event: MouseEvent) => {
      if (!dragItemRef.current) {
        return;
      }
      setGhost((prev) =>
        prev ? { ...prev, x: event.clientX, y: event.clientY } : null,
      );

      // Hit-test slots
      let hitSlotId: string | null = null;
      for (const [id, el] of slotsRef.current) {
        const rect = el.getBoundingClientRect();
        if (
          event.clientX >= rect.left &&
          event.clientX <= rect.right &&
          event.clientY >= rect.top &&
          event.clientY <= rect.bottom
        ) {
          hitSlotId = id;
          break;
        }
      }
      dropTargetRef.current = hitSlotId;
      setDropTarget(hitSlotId);

      // Hit-test pool
      if (poolRef.current) {
        const rect = poolRef.current.getBoundingClientRect();
        const isOver =
          event.clientX >= rect.left &&
          event.clientX <= rect.right &&
          event.clientY >= rect.top &&
          event.clientY <= rect.bottom;
        overPoolRef.current = isOver;
        setOverPool(isOver);
      }
    };

    const handleMouseUp = () => {
      const item = dragItemRef.current;
      if (item && onDropRef.current) {
        onDropRef.current(item, dropTargetRef.current, overPoolRef.current);
      }
      document.body.classList.remove('drag-active');
      dragItemRef.current = null;
      dropTargetRef.current = null;
      overPoolRef.current = false;
      setDragItem(null);
      setGhost(null);
      setDropTarget(null);
      setOverPool(false);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [dragItem]);

  const poolMouseDown = useCallback(
    (key: string, title: string, color: string) =>
      (event: ReactMouseEvent<HTMLElement>) => {
        if (event.button !== 0) { return; }
        event.preventDefault();
        document.body.classList.add('drag-active');
        startDrag(
          { source: 'pool', key, title, color },
          event.clientX, event.clientY,
        );
      },
    [startDrag],
  );

  const slotMouseDown = useCallback(
    (slotIndex: number, key: string, title: string, color: string) =>
      (event: ReactMouseEvent<HTMLElement>) => {
        if (event.button !== 0) { return; }
        event.preventDefault();
        document.body.classList.add('drag-active');
        startDrag(
          { source: 'slot', key, slotIndex, title, color },
          event.clientX, event.clientY,
        );
      },
    [startDrag],
  );

  return {
    ghost,
    dragItem,
    dropTarget,
    overPool,
    startDrag,
    endDrag,
    registerSlot,
    registerPool,
    registerOnDrop,
    poolMouseDown,
    slotMouseDown,
    slotsRef,
  };
}

function createDropHandler(config: {
  onAssign: (key: string, slotIndex: number) => void;
  onRemove: (slotIndex: number) => void;
  onMove?: (fromSlot: number, toSlot: number) => void;
}) {
  return (item: DragItem, targetSlotId: string | null, isOverPool: boolean) => {
    if (targetSlotId !== null) {
      const slotNumber = Number.parseInt(targetSlotId, 10);
      if (item.source === 'pool') {
        config.onAssign(item.key, slotNumber);
      } else if (item.slotIndex !== undefined && item.slotIndex !== slotNumber) {
        if (config.onMove) {
          config.onMove(item.slotIndex, slotNumber);
        } else {
          config.onAssign(item.key, slotNumber);
        }
      }
    } else if (isOverPool && item.source === 'slot' && item.slotIndex !== undefined) {
      config.onRemove(item.slotIndex);
    }
  };
}

function DragGhost({ ghost }: { ghost: GhostState | null }) {
  if (!ghost) {
    return null;
  }
  const truncated = ghost.title.length > 45 ? ghost.title.slice(0, 42) + '...' : ghost.title;
  return createPortal(
    <div
      className="drag-ghost"
      style={{
        position: 'fixed',
        left: ghost.x + 12,
        top: ghost.y - 8,
        backgroundColor: ghost.color,
      }}
    >
      {truncated}
    </div>,
    document.body,
  );
}

export interface CategoriesPanelViewProps {
  panel: CategoriesPanelPayload;
  onSiteColorPick: (which: 'primary' | 'secondary') => void;
  onCategoryColorPick: (categoryId: string) => void;
  onCategoryChange: (categoryId: string, field: 'label' | 'plural', value: string) => void;
  onToggleChange: (
    categoryId: string,
    section: 'product' | 'content',
    field: 'production' | 'vite',
    value: boolean,
  ) => void;
  onAddCategory: () => void;
}

export interface ContentPanelViewProps {
  panel: ContentPanelPayload;
  activeCollection: ContentCollectionFilter;
  onAssignToSlot: (articleKey: string, slotNumber?: number) => void;
  onRemoveSlot: (slotNumber: number) => void;
  onTogglePinned: (articleKey: string, isPinned: boolean) => void;
  onToggleExcluded: (articleKey: string, isExcluded: boolean) => void;
  onBadgeChange: (articleKey: string, badgeText: string) => void;
  onSelectCollection: (collection: ContentCollectionFilter) => void;
  onMoveSlot?: (fromSlot: number, toSlot: number) => void;
  onResetManualSlots?: () => void;
}

export interface IndexHeroesPanelViewProps {
  panel: IndexHeroesPanelPayload;
  onSelectType: (type: IndexHeroTypeKey) => void;
  onSelectCategory: (category: string) => void;
  onAssignToSlot: (itemKey: string, slotIndex?: number) => void;
  onRemoveSlot: (slotIndex: number) => void;
  onClearOverrides?: () => void;
}

export interface HubToolsPanelViewProps {
  panel: HubToolsPanelPayload;
  activeCategory: string;
  activeIndexView: HubToolsIndexView;
  onSelectCategory: (categoryId: string) => void;
  onSelectIndexView: (view: HubToolsIndexView) => void;
  onToolFieldChange: (
    categoryId: string,
    toolType: string,
    field: 'title' | 'url' | 'description' | 'subtitle' | 'hero' | 'svg',
    value: string,
  ) => void;
  onToolToggle: (
    categoryId: string,
    toolType: string,
    field: 'enabled' | 'navbar',
    value: boolean,
  ) => void;
  onMoveTool: (categoryId: string, toolType: string, direction: -1 | 1) => void;
  onRemoveTool: (categoryId: string, toolType: string) => void;
  onAddTool: (categoryId: string, toolType: HubToolTypeKey) => void;
  onTooltipChange: (toolType: HubToolTypeKey, value: string) => void;
  onIndexAssign: (view: HubToolsIndexView, itemKey: string, slotIndex?: number) => void;
  onIndexRemove: (view: HubToolsIndexView, slotIndex: number) => void;
}

const CONTENT_COLLECTIONS: ContentCollectionKey[] = [
  'reviews',
  'guides',
  'news',
  'brands',
  'games',
];
const DEFAULT_CONTENT_COLLECTION: ContentCollectionKey = 'reviews';

const CONTENT_SORT_OPTIONS: Array<{ key: ContentSortKey; label: string }> = [
  { key: 'sortDate', label: 'Date' },
  { key: 'datePublished', label: 'Published' },
  { key: 'dateUpdated', label: 'Updated' },
  { key: 'pinned', label: 'Pinned' },
  { key: 'badge', label: 'Badge' },
];

const CONTENT_TAB_LABELS: Record<ContentCollectionFilter, string> = {
  all: 'Homepage',
  reviews: 'Reviews',
  guides: 'Guides',
  news: 'News',
  brands: 'Brands',
  games: 'Games',
};

const FEED_ORDER: Record<string, number> = {
  Dash: 0,
  'News F': 1,
  Games: 2,
  'Rev H': 3,
  Rev: 4,
  'Guide H': 5,
  Guides: 6,
  'News L': 7,
  'News C': 8,
};

const FEED_LEGEND: Array<{ label: string; colorVar: string; tooltip: string }> = [
  {
    label: 'Dash',
    colorVar: 'var(--color-blue)',
    tooltip:
      'Dashboard | 15 slots\n' +
      'Sort: max(datePublished, dateUpdated), newest first\n' +
      'Pins: no, manual slots control ordering',
  },
  {
    label: 'News F',
    colorVar: 'var(--color-peach)',
    tooltip:
      'News Feed sidebar | top 3 news items\n' +
      'Sort: datePublished only, newest first\n' +
      'Pins: no',
  },
  {
    label: 'Games',
    colorVar: 'var(--color-yellow)',
    tooltip:
      'Game picks section\n' +
      'Sort: pinned first, then max(datePublished, dateUpdated)',
  },
  {
    label: 'Rev H',
    colorVar: 'var(--color-sapphire)',
    tooltip:
      'Featured Reviews hero item\n' +
      'Sort: pinned first, then max(datePublished, dateUpdated)',
  },
  {
    label: 'Rev',
    colorVar: 'var(--color-sapphire)',
    tooltip:
      'Featured Reviews list after hero\n' +
      'Sort: pinned first, then max(datePublished, dateUpdated)',
  },
  {
    label: 'Guide H',
    colorVar: 'var(--color-green)',
    tooltip:
      'Highlighted Guides hero item\n' +
      'Sort: pinned first, then max(datePublished, dateUpdated)',
  },
  {
    label: 'Guides',
    colorVar: 'var(--color-green)',
    tooltip:
      'Highlighted Guides list after hero\n' +
      'Sort: pinned first, then max(datePublished, dateUpdated)',
  },
  {
    label: 'News L & C',
    colorVar: 'var(--color-peach)',
    tooltip:
      'Latest News blocks and continued feed\n' +
      'Sort: pinned first, then max(datePublished, dateUpdated)',
  },
];

function categoryStyle(category: CategoryCardData): VariableStyle {
  return {
    '--category-color': category.color,
    '--category-accent': category.derivedColors.accent,
    '--category-hover': category.derivedColors.hover,
    '--category-gradient': category.derivedColors['grad-start'],
    '--category-score-end': category.derivedColors['score-end'],
    '--category-dark': category.derivedColors.dark,
    '--category-soft': category.derivedColors.soft,
  };
}

function siteThemeStyle(siteColors: SiteColors): VariableStyle {
  return {
    '--site-primary': siteColors.primary,
    '--site-secondary': siteColors.secondary,
    '--site-der-accent': siteColors.derivedColors.accent,
    '--site-der-hover': siteColors.derivedColors.hover,
    '--site-der-grad': siteColors.derivedColors['grad-start'],
    '--site-der-dark': siteColors.derivedColors.dark,
    '--site-der-soft': siteColors.derivedColors.soft,
  };
}

function contentAccentStyle(color: string): VariableStyle {
  return { '--content-accent': color };
}

function feedLegendPillStyle(colorVar: string): VariableStyle {
  return { '--content-accent': colorVar };
}

function collectionPillStyle(article: ContentArticleData): VariableStyle {
  return {
    '--content-accent': article.categoryColor || article.collectionColor,
  };
}

function getPrimaryFeedLabel(labels: readonly string[]): string {
  if (labels.length === 0) {
    return '';
  }

  return [...labels].sort(
    (left, right) => (FEED_ORDER[left] ?? 99) - (FEED_ORDER[right] ?? 99),
  )[0];
}

function contentSlotClassName(slot: ContentPanelPayload['dashboardSlots'][number]): string {
  return [
    'content-dashboard__slot',
    `content-dashboard__slot--row-${slot.rowIndex + 1}`,
    `content-dashboard__slot--col-${slot.columnStart + 1}`,
    `content-dashboard__slot--span-${slot.columnSpan}`,
    slot.article ? 'content-dashboard__slot--filled' : 'content-dashboard__slot--empty',
    slot.isManual ? 'content-dashboard__slot--manual' : 'content-dashboard__slot--auto',
  ].join(' ');
}

function ContentArticleEditorCard({
  article,
  onTogglePinned,
  onToggleExcluded,
  onBadgeChange,
}: {
  article: ContentArticleData;
  onTogglePinned: (articleKey: string, isPinned: boolean) => void;
  onToggleExcluded: (articleKey: string, isExcluded: boolean) => void;
  onBadgeChange: (articleKey: string, badgeText: string) => void;
}) {
  return (
    <article className="content-article-card" style={collectionPillStyle(article)}>
      <div className="content-article-card__accent" />
      <div className="content-article-card__body">
        <div className="content-article-card__row content-article-card__row--header">
          <h3 className="content-article-card__title">{article.title}</h3>
          <div className="content-article-card__header-meta">
            {article.badge ? (
              <span className="content-article-card__badge-indicator">
                <StarIcon title="Badge" />
                {article.badge}
              </span>
            ) : null}
            {article.isPinned ? (
              <span className="content-article-card__pin-indicator">
                <PinIcon title="Pinned" />
                Pinned
              </span>
            ) : null}
            <span className="content-article-card__category-pill">
              {article.category || article.collection}
            </span>
          </div>
        </div>

        <div className="content-article-card__row content-article-card__row--meta">
          <span className="content-article-card__date">{article.dateText || '-'}</span>
          {article.categoryActive ? null : (
            <span className="content-article-card__disabled">[category off]</span>
          )}
        </div>

        <div className="content-article-card__row content-article-card__row--controls">
          <div className="content-article-card__control">
            <span className="content-article-card__control-label">Publish</span>
            <Toggle
              checked={!article.isExcluded}
              label={`Publish ${article.title}`}
              onChange={(nextValue) => onToggleExcluded(article.key, !nextValue)}
            />
          </div>
          <div className="content-article-card__control">
            <span className="content-article-card__control-label">Pin</span>
            <Toggle
              checked={article.isPinned}
              label={`Pin ${article.title}`}
              onChange={(nextValue) => onTogglePinned(article.key, nextValue)}
            />
          </div>
          <label className="content-article-card__badge-field">
            <span className="content-article-card__control-label">Badge</span>
            <input
              className="field__input"
              value={article.badge}
              onChange={(event) => onBadgeChange(article.key, event.target.value)}
            />
          </label>
        </div>
      </div>
    </article>
  );
}

export function CategoriesPanelView({
  panel,
  onSiteColorPick,
  onCategoryColorPick,
  onCategoryChange,
  onToggleChange,
  onAddCategory,
}: CategoriesPanelViewProps) {
  return (
    <section className="categories-panel">
      <div className="categories-panel__top" style={siteThemeStyle(panel.siteColors)}>
        <div className="categories-panel__theme-bar" />
        <div className="categories-panel__theme-content">
          <div className="categories-panel__theme-row categories-panel__theme-row--header">
            <div className="categories-panel__theme-title-wrap">
              <h2 className="categories-panel__theme-title">Site Theme</h2>
              <span className="categories-panel__theme-subtitle">seasonal colors</span>
            </div>
            <div className="categories-panel__theme-derived">
              <span className="categories-panel__derived-label">Derived:</span>
              <span className="derived-chip derived-chip--soft" />
              <span className="derived-chip derived-chip--dark" />
              <span className="derived-chip derived-chip--grad" />
              <span className="derived-chip derived-chip--hover" />
              <span className="derived-chip derived-chip--accent" />
              <span className="categories-panel__theme-gradient" />
            </div>
          </div>
          <div className="categories-panel__theme-row categories-panel__theme-row--inputs">
            <label className="color-field">
              <span className="color-field__label">Primary:</span>
              <button
                type="button"
                className="color-field__swatch color-field__swatch--site-primary"
                onClick={() => onSiteColorPick('primary')}
                aria-label="Pick primary site color"
              />
              <button
                type="button"
                className="color-field__value"
                onClick={() => onSiteColorPick('primary')}
              >
                {panel.siteColors.primary}
              </button>
            </label>
            <label className="color-field">
              <span className="color-field__label">Secondary:</span>
              <button
                type="button"
                className="color-field__swatch color-field__swatch--site-secondary"
                onClick={() => onSiteColorPick('secondary')}
                aria-label="Pick secondary site color"
              />
              <button
                type="button"
                className="color-field__value"
                onClick={() => onSiteColorPick('secondary')}
              >
                {panel.siteColors.secondary}
              </button>
            </label>
          </div>
        </div>
      </div>

      <div className="categories-panel__scroll">
        <div className="categories-panel__grid">
          {panel.categories.map((category) => (
            <article key={category.id} className="category-card" style={categoryStyle(category)}>
              <div className="category-card__accent" />
              <div className="category-card__body">
                <div className="category-card__row category-card__row--header">
                  <div className="category-card__identity">
                    <button
                      type="button"
                      className="category-card__swatch"
                      onClick={() => onCategoryColorPick(category.id)}
                      aria-label={`Pick color for ${category.id}`}
                    />
                    <h3 className="category-card__id">{category.id}</h3>
                  </div>
                  <button
                    type="button"
                    className="category-card__color-button"
                    onClick={() => onCategoryColorPick(category.id)}
                  >
                    {category.color}
                  </button>
                </div>

                <div className="category-card__row category-card__row--inputs">
                  <label className="field-inline">
                    <span className="field-inline__label">Label:</span>
                    <input
                      className="field-inline__input"
                      value={category.label}
                      onChange={(event) => onCategoryChange(category.id, 'label', event.target.value)}
                    />
                  </label>
                  <label className="field-inline">
                    <span className="field-inline__label">Plural:</span>
                    <input
                      className="field-inline__input"
                      value={category.plural}
                      onChange={(event) => onCategoryChange(category.id, 'plural', event.target.value)}
                    />
                  </label>
                </div>

                <div className="category-card__row category-card__row--toggles">
                  {category.showProductToggles ? (
                    <div className="toggle-group toggle-group--product">
                      <span className="toggle-group__title">Product</span>
                      <ToggleRow
                        label="Prod"
                        checked={category.product.production}
                        ariaLabel={`${category.id} product production`}
                        onChange={(v) => onToggleChange(category.id, 'product', 'production', v)}
                      />
                      <ToggleRow
                        label="Vite"
                        checked={category.product.vite}
                        ariaLabel={`${category.id} product vite`}
                        onChange={(v) => onToggleChange(category.id, 'product', 'vite', v)}
                      />
                    </div>
                  ) : null}

                  {category.showProductToggles && category.showContentToggles ? (
                    <span className="category-card__divider" />
                  ) : null}

                  {category.showContentToggles ? (
                    <div className="toggle-group">
                      <span className="toggle-group__title">Content</span>
                      <ToggleRow
                        label="Prod"
                        checked={category.content.production}
                        ariaLabel={`${category.id} content production`}
                        onChange={(v) => onToggleChange(category.id, 'content', 'production', v)}
                      />
                      <ToggleRow
                        label="Vite"
                        checked={category.content.vite}
                        ariaLabel={`${category.id} content vite`}
                        onChange={(v) => onToggleChange(category.id, 'content', 'vite', v)}
                      />
                    </div>
                  ) : null}
                </div>

                <div className="category-card__row category-card__row--status">
                  <span className="category-card__count-text">{category.countText}</span>
                  <div className="category-card__icon-status" title={category.iconStatus.tooltip}>
                    <span className="category-card__icon-preview">
                      <CategoryPreviewIcon categoryId={category.id} />
                    </span>
                    {category.iconStatus.exists ? null : (
                      <span className="category-card__warning-badge">!</span>
                    )}
                    <span
                      className={
                        category.iconStatus.exists
                          ? 'category-card__icon-label category-card__icon-label--ok'
                          : 'category-card__icon-label category-card__icon-label--warning'
                      }
                    >
                      {category.iconStatus.label}
                    </span>
                  </div>
                </div>

                <div className="category-card__row category-card__row--derived">
                  <span className="category-card__derived-swatch category-card__derived-swatch--base" />
                  <span className="category-card__derived-swatch category-card__derived-swatch--accent" />
                  <span className="category-card__derived-swatch category-card__derived-swatch--hover" />
                  <span className="category-card__derived-swatch category-card__derived-swatch--grad" />
                  <span className="category-card__derived-swatch category-card__derived-swatch--score" />
                  <span className="category-card__derived-swatch category-card__derived-swatch--dark" />
                  <span className="category-card__derived-swatch category-card__derived-swatch--soft" />
                </div>
              </div>
            </article>
          ))}
        </div>
      </div>

      <div className="categories-panel__footer">
        <button type="button" className="token-button token-button--quiet" onClick={onAddCategory}>
          + Add Category
        </button>
      </div>
    </section>
  );
}

export function ContentPanelView({
  panel,
  activeCollection,
  onAssignToSlot,
  onRemoveSlot,
  onTogglePinned,
  onToggleExcluded,
  onBadgeChange,
  onSelectCollection,
  onMoveSlot,
  onResetManualSlots,
}: ContentPanelViewProps) {
  const [poolFilter, setPoolFilter] = useState<ContentCollectionFilter>('all');
  const [search, setSearch] = useState('');
  const [sortState, setSortState] = useState<Record<ContentCollectionKey, ContentSortKey>>({
    reviews: 'sortDate',
    guides: 'sortDate',
    news: 'sortDate',
    brands: 'sortDate',
    games: 'sortDate',
  });
  const isHomepageView = activeCollection === 'all';
  const collectionTab = isHomepageView ? DEFAULT_CONTENT_COLLECTION : activeCollection;

  const drag = useDragGhost();

  const eligiblePool = getEligiblePoolArticles(panel, {
    collection: poolFilter,
    search,
  });

  const currentArticles = isHomepageView
    ? []
    : sortCollectionArticles(panel.tabs[collectionTab], sortState[collectionTab]);

  const manualCount = Object.keys(panel.manualSlots).length;
  const filledCount = panel.dashboardSlots.filter((slot) => slot.article !== null).length;
  const autoCount = Math.max(0, filledCount - manualCount);

  drag.registerOnDrop(createDropHandler({
    onAssign: (key, slotIndex) => onAssignToSlot(key, slotIndex),
    onRemove: (slotIndex) => onRemoveSlot(slotIndex),
    onMove: onMoveSlot,
  }));

  const handleMainTabSelect = (target: 'homepage' | 'collections') => {
    if (target === 'homepage') {
      onSelectCollection('all');
      return;
    }

    onSelectCollection(collectionTab);
  };

  return (
    <section className="content-panel">
      <DragGhost ghost={drag.ghost} />
      <PillBar
        items={[
          { key: 'homepage' as const, label: 'Homepage' },
          { key: 'collections' as const, label: 'Collections' },
        ]}
        activeKey={isHomepageView ? 'homepage' : 'collections'}
        onSelect={handleMainTabSelect}
        className="content-panel__main-tabs"
        pillClassName="content-panel__main-tab"
      />

      {!isHomepageView ? (
        <PillBar
          items={CONTENT_COLLECTIONS.map((collection) => ({
            key: collection,
            label: CONTENT_TAB_LABELS[collection],
          }))}
          activeKey={collectionTab}
          onSelect={onSelectCollection}
          className="content-panel__subtabs"
          pillClassName="content-panel__subtab"
        />
      ) : null}

      {isHomepageView ? (
        <div className="content-panel__homepage">
          <div className="content-panel__toolbar">
            <div className="content-panel__filter-pills">
              {(['all', ...CONTENT_COLLECTIONS] as ContentCollectionFilter[]).map((collection) => (
                <button
                  key={collection}
                  type="button"
                  className="content-panel__filter-pill"
                  data-active={collection === poolFilter ? 'true' : 'false'}
                  onClick={() => setPoolFilter(collection)}
                >
                  {collection === 'all' ? 'All' : CONTENT_TAB_LABELS[collection]}
                </button>
              ))}
            </div>
            <label className="content-panel__search">
              <span className="content-panel__search-label">Search</span>
              <input
                className="field__input"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </label>
          </div>

          <div className="content-panel__feed-guide">
            <span className="content-panel__feed-guide-label">Feeds</span>
            {FEED_LEGEND.map((feed) => (
              <span
                key={feed.label}
                className="content-panel__feed-pill"
                style={feedLegendPillStyle(feed.colorVar)}
                title={feed.tooltip}
              >
                {feed.label}
              </span>
            ))}
          </div>

          <div className="content-panel__homepage-grid">
            <section
              className={`content-pool${drag.overPool && drag.dragItem ? ' content-pool--drop-active' : ''}`}
              ref={drag.registerPool}
            >
              <div className="content-pool__accent" />
              <div className="content-pool__header">
                <h2 className="content-pool__title">Article Pool</h2>
                <span className="content-pool__meta">
                  {panel.summary.eligibleArticles} eligible · {eligiblePool.length} shown
                </span>
              </div>
              <div className="content-pool__table">
                <div className="content-pool__head">
                  <span className="content-pool__col content-pool__col--pin">Pin</span>
                  <span className="content-pool__col content-pool__col--title">Title</span>
                  <span className="content-pool__col content-pool__col--feed">Feed</span>
                  <span className="content-pool__col content-pool__col--cat">Cat</span>
                  <span className="content-pool__col content-pool__col--date">Date</span>
                  <span className="content-pool__col content-pool__col--type">Type</span>
                </div>
                <div className="content-pool__body">
                  {eligiblePool.map((article) => (
                    <div
                      key={article.key}
                      className={`content-pool__row${drag.dragItem?.key === article.key ? ' content-pool__row--dragging' : ''}`}
                      style={{ ...contentAccentStyle(article.categoryColor || article.collectionColor), cursor: 'grab' }}
                      onDoubleClick={() => onAssignToSlot(article.key)}
                      onMouseDown={drag.poolMouseDown(
                        article.key,
                        article.title,
                        article.categoryColor || article.collectionColor || 'var(--color-surface-2)',
                      )}
                    >
                      <span className="content-pool__cell content-pool__cell--pin">
                        {article.isPinned ? <PinIcon title="Pinned" /> : null}
                      </span>
                      <span className="content-pool__cell content-pool__cell--title">
                        {article.title}
                      </span>
                      <span className="content-pool__cell content-pool__cell--feed">
                        {getPrimaryFeedLabel(article.feedLabels)}
                      </span>
                      <span className="content-pool__cell content-pool__cell--cat">
                        {article.categoryLabel || article.category}
                      </span>
                      <span className="content-pool__cell content-pool__cell--date">
                        {article.dateText}
                      </span>
                      <span className="content-pool__cell content-pool__cell--type">
                        {article.collectionLabel || CONTENT_TAB_LABELS[article.collection]}
                      </span>
                    </div>
                  ))}
                  {eligiblePool.length === 0 ? (
                    <div className="content-pool__empty">
                      No eligible articles match the current filter.
                    </div>
                  ) : null}
                </div>
              </div>
            </section>

            <section className="content-dashboard">
              <div className="content-dashboard__header">
                <div className="content-dashboard__title-wrap">
                  <h2 className="content-dashboard__title">Dashboard Layout</h2>
                  <button
                    type="button"
                    className="token-button token-button--quiet"
                    disabled={manualCount === 0}
                    onClick={() => onResetManualSlots?.()}
                  >
                    Reset All
                  </button>
                </div>
                <span className="content-dashboard__meta">
                  <LockIcon title="Manual slot count" />
                  {manualCount} manual · <AutoIcon title="Auto slot count" />
                  {autoCount} auto · {panel.summary.slotCount} slots
                </span>
              </div>
              <div className="content-dashboard__grid">
                {panel.dashboardSlots.map((slot) => {
                  const isDropTarget = drag.dropTarget === String(slot.slotNumber);
                  const slotClass = contentSlotClassName(slot) +
                    (isDropTarget ? ' content-dashboard__slot--drop-target' : '');
                  return (
                    <article
                      key={slot.slotNumber}
                      className={slotClass}
                      style={contentAccentStyle(
                        slot.article?.categoryColor ||
                          slot.article?.collectionColor ||
                          'var(--color-surface-2)',
                      )}
                      ref={(el) => drag.registerSlot(String(slot.slotNumber), el)}
                    >
                      <div className="content-dashboard__slot-inner">
                        <div className="content-dashboard__slot-top">
                          <div className="content-dashboard__slot-labels">
                            <span className="content-dashboard__slot-number">
                              {slot.slotNumber}
                              {slot.isManual ? <LockIcon title="Manual slot" /> : null}
                              {!slot.isManual && slot.article ? <AutoIcon title="Auto slot" /> : null}
                            </span>
                            {slot.rowLabel ? (
                              <span className="content-dashboard__row-label">{slot.rowLabel}</span>
                            ) : null}
                          </div>
                          {slot.article?.isPinned ? (
                            <span className="content-dashboard__slot-pin">
                              <PinIcon title="Pinned" />
                            </span>
                          ) : null}
                          {slot.article?.badge ? (
                            <span className="content-dashboard__slot-badge">{slot.article.badge}</span>
                          ) : null}
                          {slot.isManual ? (
                            <button
                              type="button"
                              className="content-dashboard__remove"
                              onClick={() => onRemoveSlot(slot.slotNumber)}
                            >
                              <CloseIcon title="Remove override" />
                            </button>
                          ) : null}
                        </div>

                        {slot.article ? (
                          <div
                            className="content-dashboard__slot-body"
                            style={{ cursor: slot.isManual ? 'grab' : 'default' }}
                            onMouseDown={
                              slot.isManual && slot.manualKey
                                ? drag.slotMouseDown(
                                    slot.slotNumber,
                                    slot.manualKey,
                                    slot.article.title,
                                    slot.article.categoryColor || slot.article.collectionColor || 'var(--color-surface-2)',
                                  )
                                : undefined
                            }
                          >
                            <div className="content-dashboard__slot-title">{slot.article.title}</div>
                            <div className="content-dashboard__slot-bottom">
                              <span className="content-dashboard__slot-category">
                                {slot.article.categoryLabel || slot.article.collectionLabel}
                              </span>
                              <span className="content-dashboard__slot-date">
                                {slot.article.dateText || '-'}
                              </span>
                            </div>
                          </div>
                        ) : (
                          <div className="content-dashboard__slot-empty">Drop article here</div>
                        )}
                      </div>
                    </article>
                  );
                })}
              </div>
            </section>
          </div>
        </div>
      ) : (
        <div className="content-panel__collection">
          <div className="content-panel__collection-header">
            <h2 className="content-panel__collection-title">
              {CONTENT_TAB_LABELS[collectionTab].toUpperCase()} ({panel.tabs[collectionTab].length} articles)
            </h2>
            <PillBar
              items={CONTENT_SORT_OPTIONS.map((option) => ({
                key: option.key,
                label: option.label,
              }))}
              activeKey={sortState[collectionTab]}
              onSelect={(key) =>
                setSortState((current) => ({
                  ...current,
                  [collectionTab]: key,
                }))
              }
              className="content-panel__sort-pills"
              pillClassName="content-panel__sort-pill"
            />
          </div>

          <div className="content-panel__collection-list">
            {currentArticles.map((article) => (
              <ContentArticleEditorCard
                key={article.key}
                article={article}
                onTogglePinned={onTogglePinned}
                onToggleExcluded={onToggleExcluded}
                onBadgeChange={onBadgeChange}
              />
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

const HUB_TOOL_TYPE_ORDER: HubToolTypeKey[] = ['hub', 'database', 'versus', 'radar', 'shapes'];

function compareHubToolOrder(left: string, right: string): number {
  const leftIndex = HUB_TOOL_TYPE_ORDER.indexOf(left as HubToolTypeKey);
  const rightIndex = HUB_TOOL_TYPE_ORDER.indexOf(right as HubToolTypeKey);
  if (leftIndex === -1 || rightIndex === -1) {
    return left.localeCompare(right, undefined, { sensitivity: 'base' });
  }
  return leftIndex - rightIndex;
}

function resolveHubCategory(panel: HubToolsPanelPayload, activeCategory: string): string {
  if (panel.categories.some((category) => category.id === activeCategory)) {
    return activeCategory;
  }
  return panel.categories[0]?.id ?? '';
}

function resolveHubIndexView(
  panel: HubToolsPanelPayload,
  activeIndexView: HubToolsIndexView,
): HubToolsIndexView {
  if (activeIndexView === 'all') {
    return 'all';
  }
  if (panel.toolTypes.some((type) => type.key === activeIndexView)) {
    return activeIndexView;
  }
  return 'all';
}

function hubAccentStyle(color: string): VariableStyle {
  return { '--content-accent': color || 'var(--color-surface-2)' };
}

/* ─────────────────────────────────────────────────────────────────
 * Hub tool type mini-icons (SVG, 20×20 viewBox)
 * ────────────────────────────────────────────────────────────────── */

const HUB_TOOL_ICON_PROPS = {
  viewBox: '0 0 20 20',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: '1.5',
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': 'true',
};

const HUB_TOOL_ICON_PATHS: Record<string, ReactNode> = {
  hub: (
    <>
      <circle cx="10" cy="4" r="2.5" />
      <circle cx="4" cy="15" r="2.5" />
      <circle cx="16" cy="15" r="2.5" />
      <line x1="8.5" y1="6" x2="5.5" y2="13" />
      <line x1="11.5" y1="6" x2="14.5" y2="13" />
      <line x1="6.5" y1="15" x2="13.5" y2="15" />
    </>
  ),
  database: (
    <>
      <ellipse cx="10" cy="5" rx="6.5" ry="3" />
      <line x1="3.5" y1="5" x2="3.5" y2="15" />
      <line x1="16.5" y1="5" x2="16.5" y2="15" />
      <ellipse cx="10" cy="15" rx="6.5" ry="3" />
      <path d="M3.5 10c3.25 2.5 9.75 2.5 13 0" />
    </>
  ),
  versus: (
    <>
      <rect x="2" y="2" width="16" height="16" rx="1" />
      <line x1="10" y1="2" x2="10" y2="18" />
      <polyline points="5,8 6.5,9.5 9,7" />
      <polyline points="5,13 6.5,14.5 9,12" />
      <line x1="12" y1="8" x2="17" y2="8" />
      <line x1="12" y1="10.5" x2="16" y2="10.5" />
      <line x1="12" y1="13" x2="17" y2="13" />
      <line x1="12" y1="15.5" x2="16" y2="15.5" />
    </>
  ),
  radar: (
    <polygon points="10,3 17.6,8.5 14.7,17.5 5.3,17.5 2.4,8.5" />
  ),
  shapes: (
    <>
      <ellipse cx="10" cy="10" rx="5.5" ry="8.5" />
      <line x1="10" y1="1.5" x2="10" y2="8" />
      <circle cx="10" cy="5" r="1.2" />
    </>
  ),
};

function HubToolIcon({ toolType, className }: { toolType: string; className?: string }) {
  const paths = HUB_TOOL_ICON_PATHS[toolType];
  if (!paths) {
    return null;
  }
  return (
    <span className={`hub-tools-panel__tool-icon${className ? ` ${className}` : ''}`}>
      <svg {...HUB_TOOL_ICON_PROPS}>{paths}</svg>
    </span>
  );
}

/* ─────────────────────────────────────────────────────────────────
 * SVG Editor Dialog
 * ────────────────────────────────────────────────────────────────── */

interface SvgEditorState {
  categoryId: string;
  toolType: string;
  draft: string;
}

function SvgEditorDialog({
  state,
  onClose,
}: {
  state: SvgEditorState;
  onClose: (nextSvg: string | null) => void;
}) {
  const [draft, setDraft] = useState(state.draft);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  return (
    <DialogOverlay onDismiss={() => onClose(null)}>
      <div className="svg-editor">
        <div className="svg-editor__header">
          <h3 className="svg-editor__title">
            SVG for {state.categoryId}/{state.toolType}
          </h3>
        </div>
        <textarea
          ref={textareaRef}
          className="svg-editor__textarea"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder="Paste SVG markup here..."
          spellCheck={false}
        />
        <div className="svg-editor__info">
          <span className="svg-editor__hint">
            SVG must use fill=&apos;currentColor&apos; for theme compatibility
          </span>
          <span className="svg-editor__count">{draft.length} chars</span>
        </div>
        <div className="svg-editor__actions">
          <button
            type="button"
            className="token-button token-button--quiet svg-editor__clear"
            onClick={() => setDraft('')}
          >
            Clear
          </button>
          <div className="svg-editor__actions-right">
            <button
              type="button"
              className="token-button token-button--quiet"
              onClick={() => onClose(null)}
            >
              Cancel
            </button>
            <button
              type="button"
              className="token-button token-button--accent"
              onClick={() => onClose(draft)}
            >
              OK
            </button>
          </div>
        </div>
      </div>
    </DialogOverlay>
  );
}

/* ─────────────────────────────────────────────────────────────────
 * Shared Tooltips Editor Dialog
 * ────────────────────────────────────────────────────────────────── */

function TooltipEditorDialog({
  toolTypes,
  tooltips,
  onTooltipChange,
  onClose,
}: {
  toolTypes: { key: string; label: string }[];
  tooltips: Record<string, string>;
  onTooltipChange: (toolType: HubToolTypeKey, value: string) => void;
  onClose: () => void;
}) {
  return (
    <DialogOverlay onDismiss={onClose}>
      <div className="tooltip-editor">
        <div className="svg-editor__header">
          <h3 className="svg-editor__title">Shared Tooltips</h3>
        </div>
        <p className="tooltip-editor__hint">
          Tooltip descriptions shown on hover for each tool type.
        </p>
        <div className="tooltip-editor__fields">
          {toolTypes.map((type) => (
            <LabeledField
              key={type.key}
              label={type.label}
              value={tooltips[type.key] ?? ''}
              onChange={(v) => onTooltipChange(type.key as HubToolTypeKey, v)}
            />
          ))}
        </div>
        <div className="svg-editor__actions">
          <span />
          <button
            type="button"
            className="token-button token-button--accent"
            onClick={onClose}
          >
            Done
          </button>
        </div>
      </div>
    </DialogOverlay>
  );
}

/* ─────────────────────────────────────────────────────────────────
 * Hub index item (extended for richer slot rendering)
 * ────────────────────────────────────────────────────────────────── */

interface HubIndexItem {
  key: string;
  title: string;
  categoryId: string;
  categoryLabel: string;
  categoryColor: string;
  toolType: string;
  description: string;
  enabled: boolean;
  svg: string;
}

const HUB_TOOL_TYPE_LABELS: Record<string, string> = {
  hub: 'Hub',
  database: 'Database',
  versus: 'Versus',
  radar: 'Radars',
  shapes: 'Shapes',
};

export function HubToolsPanelView({
  panel,
  activeCategory,
  activeIndexView,
  onSelectCategory,
  onSelectIndexView,
  onToolFieldChange,
  onToolToggle,
  onMoveTool,
  onRemoveTool,
  onAddTool,
  onTooltipChange,
  onIndexAssign,
  onIndexRemove,
}: HubToolsPanelViewProps) {
  const drag = useDragGhost();
  const [svgEditor, setSvgEditor] = useState<SvgEditorState | null>(null);
  const [hubTab, setHubTab] = useState<'home' | 'index'>('home');
  const [tooltipDialogOpen, setTooltipDialogOpen] = useState(false);

  const resolvedCategoryId = resolveHubCategory(panel, activeCategory);
  const category = panel.categories.find((entry) => entry.id === resolvedCategoryId) ?? null;
  const categoryTools = (panel.tools[resolvedCategoryId] ?? [])
    .slice()
    .sort((left, right) => compareHubToolOrder(left.tool, right.tool));
  const existingTypes = new Set(categoryTools.map((tool) => tool.tool));
  const missingTypes = panel.toolTypes.filter((type) => !existingTypes.has(type.key));

  const resolvedIndexView = resolveHubIndexView(panel, activeIndexView);
  const indexKeys = panel.index[resolvedIndexView] ?? [];
  const slotKeys = Array.from({ length: 6 }, (_, index) => indexKeys[index] ?? '');

  const indexItems: HubIndexItem[] = panel.categories.flatMap((entry) =>
    (panel.tools[entry.id] ?? [])
      .filter((tool) => resolvedIndexView === 'all' || tool.tool === resolvedIndexView)
      .map((tool) => ({
        key: `${entry.id}:${tool.tool}`,
        title: tool.title,
        categoryId: entry.id,
        categoryLabel: entry.label,
        categoryColor: entry.color,
        toolType: tool.tool,
        description: tool.description,
        enabled: tool.enabled,
        svg: tool.svg,
      })),
  );
  const itemByKey = new Map(indexItems.map((item) => [item.key, item]));
  const assignedKeys = new Set(indexKeys.filter(Boolean));
  const unassigned = indexItems.filter((item) => !assignedKeys.has(item.key));

  drag.registerOnDrop(createDropHandler({
    onAssign: (key, slotIndex) => onIndexAssign(resolvedIndexView, key, slotIndex),
    onRemove: (slotIndex) => onIndexRemove(resolvedIndexView, slotIndex),
  }));

  const openSvgEditor = (categoryId: string, toolType: string, currentSvg: string) => {
    setSvgEditor({ categoryId, toolType, draft: currentSvg });
  };

  const closeSvgEditor = (nextSvg: string | null) => {
    if (nextSvg !== null && svgEditor) {
      onToolFieldChange(svgEditor.categoryId, svgEditor.toolType, 'svg', nextSvg);
    }
    setSvgEditor(null);
  };

  return (
    <section className="content-panel hub-tools-panel">
      <DragGhost ghost={drag.ghost} />
      {svgEditor && (
        <SvgEditorDialog state={svgEditor} onClose={closeSvgEditor} />
      )}
      {tooltipDialogOpen && (
        <TooltipEditorDialog
          toolTypes={panel.toolTypes}
          tooltips={panel.tooltips}
          onTooltipChange={onTooltipChange}
          onClose={() => setTooltipDialogOpen(false)}
        />
      )}
      <PillBar
        items={[{ key: 'home' as const, label: 'Home' }, { key: 'index' as const, label: 'Index' }]}
        activeKey={hubTab}
        onSelect={setHubTab}
        className="content-panel__main-tabs"
        pillClassName="content-panel__main-tab"
      />
      <div className="index-heroes-panel__info-bar">
        <span className="index-heroes-panel__info-text">
          {hubTab === 'home'
            ? 'Configure tool cards per category — title, URL, description, SVG icon, and visibility.'
            : 'Drag tools into the 6 dashboard slots for /hubs/ index. Empty slots auto-fill at build time.'}
        </span>
      </div>
      <div className="content-panel__homepage hub-tools-panel__home" style={{ display: hubTab === 'home' ? undefined : 'none' }}>
        <div className="content-pool hub-tools-panel__category-list">
          <div className="content-pool__accent" style={hubAccentStyle(category?.color ?? 'var(--color-surface-2)')} />
          <div className="content-pool__header hub-tools-panel__category-header">
            <h2 className="content-pool__title hub-tools-panel__section-title">Hub Tools Home</h2>
            <span className="content-pool__meta">{panel.categories.length} categories</span>
          </div>
          <div className="hub-tools-panel__category-scroll">
            {panel.categories.map((entry) => (
              <button
                key={entry.id}
                type="button"
                className="hub-tools-panel__category-tab"
                data-active={entry.id === resolvedCategoryId ? 'true' : 'false'}
                style={hubAccentStyle(entry.color)}
                onClick={() => onSelectCategory(entry.id)}
              >
                <span className="hub-tools-panel__category-name">{entry.label}</span>
                <span className="hub-tools-panel__category-count">
                  {entry.enabledCount}/{entry.totalCount}
                </span>
              </button>
            ))}
          </div>
          <div className="hub-tools-panel__tooltip-section">
            <div className="hub-tools-panel__tooltip-rule" />
            <span className="hub-tools-panel__tooltip-heading">Shared tooltips</span>
            <button
              type="button"
              className="hub-tools-panel__tooltip-btn"
              onClick={() => setTooltipDialogOpen(true)}
            >
              Edit Tooltips
            </button>
          </div>
        </div>

        <div className="content-dashboard hub-tools-panel__home-main">
          <div className="content-dashboard__header hub-tools-panel__home-header">
            <h3 className="content-dashboard__title hub-tools-panel__home-title">
              {category ? `${category.label} Tool Cards` : 'Tool Cards'}
            </h3>
            <div className="hub-tools-panel__add-row">
              {missingTypes.map((type) => (
                <button
                  key={type.key}
                  type="button"
                  className="token-button token-button--quiet hub-tools-panel__add-tool"
                  onClick={() => onAddTool(resolvedCategoryId, type.key)}
                >
                  + {type.label}
                </button>
              ))}
            </div>
          </div>

          <div className="hub-tools-panel__tool-list">
            {categoryTools.map((tool, index) => {
              const hasSvg = Boolean(tool.svg.trim());
              const accentColor = tool.enabled
                ? category?.color ?? 'var(--color-surface-2)'
                : 'var(--color-surface-2)';

              return (
                <article
                  key={`${resolvedCategoryId}:${tool.tool}`}
                  className={`hub-tools-panel__tool-card${tool.enabled ? '' : ' hub-tools-panel__tool-card--disabled'}`}
                  style={hubAccentStyle(accentColor)}
                >
                  <div className="hub-tools-panel__tool-top">
                    <div className="hub-tools-panel__tool-identity">
                      <HubToolIcon toolType={tool.tool} />
                      <span className="hub-tools-panel__tool-badge">{tool.tool.toUpperCase()}</span>
                      <span className={`hub-tools-panel__svg-status${hasSvg ? ' hub-tools-panel__svg-status--yes' : ' hub-tools-panel__svg-status--no'}`}>
                        {hasSvg ? 'SVG' : 'NO SVG'}
                      </span>
                    </div>
                    <div className="hub-tools-panel__tool-actions">
                      <Toggle
                        checked={tool.enabled}
                        label={`${resolvedCategoryId} ${tool.tool} enabled`}
                        onChange={(nextValue) =>
                          onToolToggle(resolvedCategoryId, tool.tool, 'enabled', nextValue)
                        }
                      />
                      <button
                        type="button"
                        className="hub-tools-panel__ghost-action"
                        disabled={index === 0}
                        onClick={() => onMoveTool(resolvedCategoryId, tool.tool, -1)}
                        title="Move up"
                      >
                        ▲
                      </button>
                      <button
                        type="button"
                        className="hub-tools-panel__ghost-action"
                        disabled={index === categoryTools.length - 1}
                        onClick={() => onMoveTool(resolvedCategoryId, tool.tool, 1)}
                        title="Move down"
                      >
                        ▼
                      </button>
                      <button
                        type="button"
                        className="hub-tools-panel__ghost-action hub-tools-panel__ghost-action--danger"
                        onClick={() => onRemoveTool(resolvedCategoryId, tool.tool)}
                        title="Remove"
                      >
                        ×
                      </button>
                    </div>
                  </div>

                  <div className="hub-tools-panel__field-grid">
                    <LabeledField
                      label="Title"
                      value={tool.title}
                      onChange={(v) => onToolFieldChange(resolvedCategoryId, tool.tool, 'title', v)}
                    />
                    <LabeledField
                      label="URL"
                      value={tool.url}
                      onChange={(v) => onToolFieldChange(resolvedCategoryId, tool.tool, 'url', v)}
                      mono
                    />
                    <LabeledField
                      label="Description"
                      value={tool.description}
                      onChange={(v) => onToolFieldChange(resolvedCategoryId, tool.tool, 'description', v)}
                      className="hub-tools-panel__field--full"
                    />
                    <LabeledField
                      label="Subtitle"
                      value={tool.subtitle}
                      onChange={(v) => onToolFieldChange(resolvedCategoryId, tool.tool, 'subtitle', v)}
                    />
                    <LabeledField
                      label="Hero"
                      value={tool.hero}
                      onChange={(v) => onToolFieldChange(resolvedCategoryId, tool.tool, 'hero', v)}
                      mono
                    />
                  </div>

                  <div className="hub-tools-panel__card-footer">
                    <button
                      type="button"
                      className="hub-tools-panel__ghost-action"
                      onClick={() => openSvgEditor(resolvedCategoryId, tool.tool, tool.svg)}
                    >
                      Edit SVG
                    </button>
                    <span className="hub-tools-panel__svg-preview">
                      {hasSvg
                        ? (tool.svg.length > 80 ? tool.svg.slice(0, 77) + '...' : tool.svg)
                        : '(no SVG set)'}
                    </span>
                    <div className="hub-tools-panel__toggle-field">
                      <span className="hub-tools-panel__toggle-label">Navbar</span>
                      <Toggle
                        checked={tool.navbar}
                        label={`${resolvedCategoryId} ${tool.tool} navbar`}
                        onChange={(nextValue) =>
                          onToolToggle(resolvedCategoryId, tool.tool, 'navbar', nextValue)
                        }
                      />
                    </div>
                  </div>
                </article>
              );
            })}
          </div>

        </div>
      </div>
      <div className="content-panel__collection hub-tools-panel__index" style={{ display: hubTab === 'index' ? undefined : 'none' }}>
        <div className="content-panel__collection-header hub-tools-panel__index-header">
          <h2 className="content-panel__collection-title hub-tools-panel__section-title">Hub Tools Index</h2>
          <PillBar
            items={[
              { key: 'all' as const, label: 'All' },
              ...panel.toolTypes.map((type) => ({ key: type.key, label: type.label })),
            ]}
            activeKey={resolvedIndexView}
            onSelect={onSelectIndexView}
            className="content-panel__sort-pills hub-tools-panel__index-views"
            pillClassName="content-panel__sort-pill hub-tools-panel__index-view"
          />
        </div>

        <div className="hub-tools-panel__index-grid">
          <div className="content-dashboard__grid hub-tools-panel__slots">
            {slotKeys.map((itemKey, slotIndex) => {
              const item = itemByKey.get(itemKey);
              const isDropTarget = drag.dropTarget === String(slotIndex);
              const slotClass = [
                'content-dashboard__slot',
                item ? 'content-dashboard__slot--filled' : '',
                item ? 'content-dashboard__slot--manual' : '',
                isDropTarget ? 'content-dashboard__slot--drop-target' : '',
              ].filter(Boolean).join(' ');

              return (
                <article
                  key={`slot-${slotIndex + 1}`}
                  className={slotClass}
                  data-key={itemKey || undefined}
                  style={hubAccentStyle(item?.categoryColor ?? 'var(--color-surface-2)')}
                  ref={(el) => drag.registerSlot(String(slotIndex), el)}
                >
                  <div className="content-dashboard__slot-inner">
                    <div className="content-dashboard__slot-top">
                      <div className="content-dashboard__slot-labels">
                        <span className="content-dashboard__slot-number">Slot {slotIndex + 1}</span>
                      </div>
                      {!item?.enabled && item && (
                        <span className="content-dashboard__slot-badge">OFF</span>
                      )}
                      {item ? (
                        <button
                          type="button"
                          className="content-dashboard__remove"
                          onClick={() => onIndexRemove(resolvedIndexView, slotIndex)}
                        >
                          <CloseIcon title="Remove from slot" />
                        </button>
                      ) : null}
                    </div>
                    {item ? (
                      <div
                        className="content-dashboard__slot-body"
                        style={{ cursor: 'grab' }}
                        onMouseDown={drag.slotMouseDown(
                          slotIndex,
                          item.key,
                          item.title,
                          item.categoryColor || 'var(--color-surface-2)',
                        )}
                      >
                        <div className="content-dashboard__slot-title">
                          {HUB_TOOL_TYPE_LABELS[item.toolType] ?? item.toolType} — {item.title}
                        </div>
                        {item.svg.trim() ? (
                          <div
                            className="hub-tools-panel__slot-svg"
                            dangerouslySetInnerHTML={{ __html: item.svg }}
                          />
                        ) : (
                          <div className="hub-tools-panel__slot-svg hub-tools-panel__slot-svg--empty">
                            <HubToolIcon toolType={item.toolType} />
                          </div>
                        )}
                        <div className="content-dashboard__slot-bottom">
                          <span className="content-dashboard__slot-category">
                            {item.categoryId}
                          </span>
                          <span className="content-dashboard__slot-date">
                            {item.description
                              ? (item.description.length > 50 ? item.description.slice(0, 47) + '...' : item.description)
                              : '—'}
                          </span>
                        </div>
                      </div>
                    ) : (
                      <div className="content-dashboard__slot-empty">Drop tool here</div>
                    )}
                  </div>
                </article>
              );
            })}
          </div>

          <div
            className={`content-pool hub-tools-panel__pool${drag.overPool && drag.dragItem ? ' content-pool--drop-active' : ''}`}
            ref={drag.registerPool}
          >
            <div className="content-pool__accent" style={hubAccentStyle(category?.color ?? 'var(--color-surface-2)')} />
            <div className="content-pool__header hub-tools-panel__pool-header">
              <span>Unassigned</span>
              <span>{unassigned.length}</span>
            </div>
            <div className="hub-tools-panel__pool-list">
              {unassigned.map((item) => {
                const isDragging = drag.dragItem?.key === item.key;
                const isOff = !item.enabled;
                const rowClass = [
                  'content-pool__row',
                  'hub-tools-panel__pool-row',
                  isDragging ? 'content-pool__row--dragging' : '',
                  isOff ? 'hub-tools-panel__pool-row--off' : '',
                ].filter(Boolean).join(' ');

                return (
                  <div
                    key={item.key}
                    className={rowClass}
                    style={{ ...hubAccentStyle(item.categoryColor), cursor: 'grab' }}
                    onMouseDown={drag.poolMouseDown(
                      item.key,
                      item.title,
                      item.categoryColor || 'var(--color-surface-2)',
                    )}
                  >
                    <span className="content-pool__cell hub-tools-panel__pool-key">
                      {item.key}
                    </span>
                    <span className="content-pool__cell content-pool__cell--title hub-tools-panel__pool-title">
                      {item.title}{isOff ? '  (off)' : ''}
                    </span>
                  </div>
                );
              })}
              {unassigned.length === 0 ? (
                <div className="content-pool__empty hub-tools-panel__pool-empty">No unassigned tools for this view.</div>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function indexAccentStyle(color: string): VariableStyle {
  return {
    '--index-accent': color,
    '--content-accent': color,
  };
}

function buildCatColorMap(panel: IndexHeroesPanelPayload): Record<string, string> {
  const map: Record<string, string> = {};
  for (const typeKey of Object.keys(panel.categories)) {
    for (const cat of panel.categories[typeKey as IndexHeroTypeKey] ?? []) {
      if (cat.key !== '_all' && cat.color) {
        map[cat.key] = cat.color;
      }
    }
  }
  return map;
}

function ColoredCatList({ categories, colorMap, fallback }: {
  categories: string[];
  colorMap: Record<string, string>;
  fallback: string;
}) {
  if (categories.length === 0) {
    return <>{'\u2014'}</>;
  }
  return (
    <>
      {categories.map((cat) => (
        <span
          key={cat}
          className="colored-cat-badge"
          style={{ background: colorMap[cat] || fallback }}
        >
          {cat.charAt(0).toUpperCase() + cat.slice(1)}
        </span>
      ))}
    </>
  );
}

function matchesIndexCategory(candidate: IndexHeroCandidate, category: string): boolean {
  if (category === '_all') {
    return true;
  }
  if (candidate.category === category) {
    return true;
  }
  return candidate.categories.includes(category);
}

function getActiveIndexType(panel: IndexHeroesPanelPayload) {
  return (
    panel.types.find((type) => type.key === panel.activeType) ??
    panel.types[0] ?? {
      key: 'reviews' as const,
      label: 'Reviews',
      color: 'var(--color-blue)',
      slotCount: 3,
    }
  );
}

function getActiveIndexCategory(
  panel: IndexHeroesPanelPayload,
  typeKey: IndexHeroTypeKey,
): string {
  const available = panel.categories[typeKey] ?? [];
  if (available.some((category) => category.key === panel.activeCategory)) {
    return panel.activeCategory;
  }
  return '_all';
}

function getIndexSlotItems(
  panel: IndexHeroesPanelPayload,
  typeKey: IndexHeroTypeKey,
  slotCount: number,
  category: string,
): Array<IndexHeroCandidate | null> {
  const slotItems = panel.slots[typeKey] ?? [];
  const poolItems = panel.pools[typeKey] ?? [];
  const keyMap = new Map<string, IndexHeroCandidate>();

  slotItems.forEach((item) => {
    if (item) {
      keyMap.set(item.key, item);
    }
  });
  poolItems.forEach((item) => {
    keyMap.set(item.key, item);
  });

  const overrideKeys = panel.overrides[typeKey]?.[category] ?? [];
  const manualItems = overrideKeys
    .map((key) => keyMap.get(key))
    .filter((item): item is IndexHeroCandidate => Boolean(item));
  const usedKeys = new Set(manualItems.map((item) => item.key));

  // WHY: Backend computes slots for _all only. For category views, we must
  // also pull from pool to fill slots (mirrors Tk's per-category algorithm).
  const autoItems = [...slotItems, ...poolItems]
    .filter((item): item is IndexHeroCandidate => Boolean(item))
    .filter((item) => !usedKeys.has(item.key))
    .filter((item) => matchesIndexCategory(item, category));

  // Deduplicate by key (slots may overlap with pool)
  const seen = new Set(usedKeys);
  const deduped: IndexHeroCandidate[] = [];
  for (const item of autoItems) {
    if (!seen.has(item.key)) {
      deduped.push(item);
      seen.add(item.key);
    }
  }

  const combined = [...manualItems, ...deduped]
    .slice(0, slotCount);
  while (combined.length < slotCount) {
    combined.push(null);
  }
  return combined;
}

function getIndexPoolItems(
  panel: IndexHeroesPanelPayload,
  typeKey: IndexHeroTypeKey,
  category: string,
): IndexHeroCandidate[] {
  const manualKeys = new Set(panel.overrides[typeKey]?.[category] ?? []);
  return (panel.pools[typeKey] ?? [])
    .filter((candidate) => !manualKeys.has(candidate.key))
    .filter((candidate) => matchesIndexCategory(candidate, category))
    .sort((left, right) => left.title.localeCompare(right.title))
    .sort((left, right) => right.sortDate.localeCompare(left.sortDate));
}

export function IndexHeroesPanelView({
  panel,
  onSelectType,
  onSelectCategory,
  onAssignToSlot,
  onRemoveSlot,
  onClearOverrides,
}: IndexHeroesPanelViewProps) {
  const [search, setSearch] = useState('');

  const drag = useDragGhost();

  const activeType = getActiveIndexType(panel);
  const activeCategory = getActiveIndexCategory(panel, activeType.key);
  const isBrandMode = activeType.key === 'brands';
  const categories = panel.categories[activeType.key] ?? [];
  /* WHY: accent bars propagate the active category's color (site color for
     "All", category color for specific), not the static type color. */
  const activeCatColor = categories.find((c) => c.key === activeCategory)?.color ?? activeType.color;
  const pool = getIndexPoolItems(panel, activeType.key, activeCategory)
    .filter((candidate) => {
      const query = search.trim().toLowerCase();
      if (!query) {
        return true;
      }
      return candidate.title.toLowerCase().includes(query);
    });
  const slots = getIndexSlotItems(panel, activeType.key, activeType.slotCount, activeCategory);
  const manualKeys = panel.overrides[activeType.key]?.[activeCategory] ?? [];
  const hasOverrides = manualKeys.length > 0;
  const filledCount = slots.filter((candidate) => Boolean(candidate)).length;
  const manualCount = manualKeys.length;
  const autoCount = Math.max(0, filledCount - manualCount);
  const eligibleCount = pool.length + manualCount;

  const categoryLabel = activeCategory === '_all'
    ? 'All'
    : categories.find((c) => c.key === activeCategory)?.label ?? activeCategory;

  const slotLabels = isBrandMode
    ? Array.from({ length: activeType.slotCount }, (_, i) => `Slot ${i + 1}`)
    : ['Hero', 'Side 1', 'Side 2'];

  const infoText = isBrandMode
    ? 'Select up to 6 hero brands for the top of /brands/. Empty = auto-fill (iDashboard pins, then daily rotation).'
    : 'Select 3 hero articles for the top of each index page. Empty = auto-fill (pinned first, then newest).';

  const poolTitle = isBrandMode ? 'Available Brands' : 'Available Articles';
  const itemWord = isBrandMode ? 'brand' : 'article';
  const catColorMap = buildCatColorMap(panel);

  drag.registerOnDrop(createDropHandler({
    onAssign: (key, slotIndex) => onAssignToSlot(key, slotIndex),
    onRemove: (slotIndex) => onRemoveSlot(slotIndex),
  }));

  return (
    <section className="content-panel index-heroes-panel">
      <DragGhost ghost={drag.ghost} />
      {/* Type tabs */}
      <div className="content-panel__main-tabs index-heroes-panel__type-tabs">
        {panel.types.map((type) => (
          <button
            key={type.key}
            type="button"
            className="content-panel__main-tab index-heroes-panel__type-tab"
            data-active={type.key === activeType.key ? 'true' : 'false'}
            style={indexAccentStyle(type.color)}
            onClick={() => onSelectType(type.key)}
          >
            {type.label}
          </button>
        ))}
      </div>

      {/* Info text bar */}
      <div className="index-heroes-panel__info-bar">
        <span className="index-heroes-panel__info-text">{infoText}</span>
      </div>

      {/* Category subtabs (pill bar) */}
      <PillBar
        items={categories.map((cat) => ({ key: cat.key, label: cat.label }))}
        activeKey={activeCategory}
        onSelect={onSelectCategory}
        className="content-panel__subtabs"
        pillClassName="content-panel__subtab"
      />

      {/* Main layout: category sidebar (left) + center column (slots top, pool bottom) */}
      <div className="index-heroes-panel__main">
        {/* Category sidebar */}
        <nav className="index-heroes-panel__cat-sidebar" style={indexAccentStyle(activeCatColor)}>
          <div className="index-heroes-panel__cat-accent" />
          <h3 className="index-heroes-panel__cat-heading">Category</h3>
          {categories.map((category) => (
            <button
              key={category.key}
              type="button"
              className="index-heroes-panel__cat-btn"
              data-active={category.key === activeCategory ? 'true' : 'false'}
              style={indexAccentStyle(category.color)}
              onClick={() => onSelectCategory(category.key)}
            >
              <span className="index-heroes-panel__cat-indicator" />
              <span className="index-heroes-panel__cat-label">
                {category.label} ({category.count})
              </span>
            </button>
          ))}
        </nav>

        {/* Center column: slots top + pool bottom */}
        <div className="index-heroes-panel__center">
          {/* Hero slots */}
          <section className="content-dashboard index-heroes-slots">
            <div className="content-dashboard__header index-heroes-slots__header">
              <h2 className="content-dashboard__title index-heroes-slots__title">
                {activeType.label} &rsaquo; {categoryLabel} Heroes
              </h2>
              {hasOverrides ? (
                <span className="index-heroes-slots__mode index-heroes-slots__mode--manual">
                  <LockIcon title="Manual overrides" /> {manualCount} manual
                </span>
              ) : (
                <span className="index-heroes-slots__mode index-heroes-slots__mode--auto">
                  <AutoIcon title="Auto-fill" /> auto ({Math.min(eligibleCount, activeType.slotCount)} / {eligibleCount})
                </span>
              )}
              {hasOverrides && onClearOverrides ? (
                <button
                  type="button"
                  className="token-button token-button--quiet index-heroes-slots__clear"
                  onClick={onClearOverrides}
                >
                  Clear Overrides
                </button>
              ) : null}
              {eligibleCount < activeType.slotCount ? (
                <span className="index-heroes-slots__threshold">
                  &#x26a0; Only {eligibleCount} {itemWord}{eligibleCount !== 1 ? 's' : ''} &mdash; hero section will not display (needs {activeType.slotCount})
                </span>
              ) : null}
            </div>
            <div className="content-dashboard__grid index-heroes-slots__grid">
              {slots.map((candidate, slotIndex) => {
                const isManual = hasOverrides && slotIndex < manualCount;
                const isDropTarget = drag.dropTarget === String(slotIndex);
                const slotClassName = [
                  'content-dashboard__slot',
                  candidate ? 'content-dashboard__slot--filled' : '',
                  isManual ? 'content-dashboard__slot--manual' : 'content-dashboard__slot--auto',
                  'index-heroes-slot',
                  isDropTarget ? 'content-dashboard__slot--drop-target' : '',
                ]
                  .filter(Boolean)
                  .join(' ');

                const slotLabel = slotLabels[slotIndex] ?? `Slot ${slotIndex + 1}`;

                return (
                  <article
                    key={`slot-${slotIndex + 1}`}
                    className={slotClassName}
                    data-manual={isManual ? 'true' : 'false'}
                    style={indexAccentStyle(candidate?.categoryColor || activeType.color)}
                    ref={(el) => drag.registerSlot(String(slotIndex), el)}
                  >
                    <div className="content-dashboard__slot-inner index-heroes-slot__inner">
                      <div className="content-dashboard__slot-top index-heroes-slot__header">
                        <div className="content-dashboard__slot-labels">
                          <span className="content-dashboard__slot-number index-heroes-slot__number">
                            {slotLabel}
                            {isManual ? <LockIcon title="Manual override" /> : null}
                            {!isManual && candidate ? <AutoIcon title="Auto slot" /> : null}
                          </span>
                        </div>
                        {candidate?.isPinned ? (
                          <span className="content-dashboard__slot-pin index-heroes-slot__pin">
                            <PinIcon title="Pinned" />
                          </span>
                        ) : null}
                        {candidate?.badge ? (
                          <span className="content-dashboard__slot-badge index-heroes-slot__badge">
                            {candidate.badge}
                          </span>
                        ) : null}
                        {isManual ? (
                          <button
                            type="button"
                            className="content-dashboard__remove index-heroes-slot__remove"
                            onClick={() => onRemoveSlot(slotIndex)}
                          >
                            <CloseIcon title="Remove override" />
                          </button>
                        ) : null}
                      </div>
                      {candidate ? (
                        <div
                          className="content-dashboard__slot-body index-heroes-slot__body"
                          style={{ cursor: isManual ? 'grab' : 'default' }}
                          onMouseDown={
                            isManual
                              ? drag.slotMouseDown(
                                  slotIndex,
                                  candidate.key,
                                  candidate.title,
                                  candidate.categoryColor || activeType.color || 'var(--color-surface-2)',
                                )
                              : undefined
                          }
                        >
                          <span className="content-dashboard__slot-title index-heroes-slot__title">
                            {candidate.title}
                          </span>
                          <span className="content-dashboard__slot-bottom index-heroes-slot__bottom">
                            {isBrandMode ? (
                              <span className="index-heroes-slot__brand-cats">
                                <ColoredCatList
                                  categories={candidate.categories}
                                  colorMap={catColorMap}
                                  fallback={activeType.color}
                                />
                              </span>
                            ) : (
                              <>
                                <span className="content-dashboard__slot-category index-heroes-slot__meta">
                                  {candidate.categoryLabel || candidate.type}
                                </span>
                                <span className="content-dashboard__slot-date index-heroes-slot__date">
                                  {candidate.dateText || '-'}
                                </span>
                              </>
                            )}
                          </span>
                        </div>
                      ) : (
                        <div className="content-dashboard__slot-empty index-heroes-slot__empty">
                          Drop {itemWord} here or double-click in pool
                        </div>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          </section>

          {/* Pool (below slots) */}
          <section
            className={`content-pool index-heroes-pool${drag.overPool && drag.dragItem ? ' content-pool--drop-active' : ''}`}
            ref={drag.registerPool}
          >
            <div
              className="content-pool__accent index-heroes-pool__accent"
              style={indexAccentStyle(activeCatColor)}
            />
            <div className="content-pool__header index-heroes-pool__header">
              <h2 className="content-pool__title index-heroes-pool__title">{poolTitle}</h2>
              <span className="content-pool__meta index-heroes-pool__meta">
                {pool.length} available &middot; {manualKeys.length} in hero
              </span>
              <label className="content-panel__search index-heroes-pool__search">
                <span className="content-panel__search-label">Search</span>
                <input
                  className="field__input"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                />
              </label>
            </div>
            <div
              className="content-pool__table index-heroes-pool__table"
              data-brand-mode={isBrandMode ? 'true' : 'false'}
            >
              <div className="content-pool__head index-heroes-pool__head">
                {!isBrandMode ? (
                  <span className="content-pool__col index-heroes-pool__col index-heroes-pool__col--pin">
                    &#x1f4cc;
                  </span>
                ) : null}
                <span className="content-pool__col index-heroes-pool__col index-heroes-pool__col--title">
                  {isBrandMode ? 'Brand' : 'Title'}
                </span>
                <span className="content-pool__col index-heroes-pool__col index-heroes-pool__col--cat">
                  {isBrandMode ? 'Categories' : 'Cat'}
                </span>
                {!isBrandMode ? (
                  <span className="content-pool__col index-heroes-pool__col index-heroes-pool__col--date">
                    Date
                  </span>
                ) : null}
                {!isBrandMode ? (
                  <span className="content-pool__col index-heroes-pool__col index-heroes-pool__col--badge">
                    Badge
                  </span>
                ) : null}
              </div>
              <div className="content-pool__body index-heroes-pool__rows">
                {pool.map((candidate) => {
                  const rowColor = candidate.categoryColor || activeType.color;
                  const isDragging = drag.dragItem?.key === candidate.key;
                  return (
                    <div
                      key={candidate.key}
                      className={`content-pool__row index-heroes-pool__row${isDragging ? ' content-pool__row--dragging' : ''}`}
                      data-brand-mode={isBrandMode ? 'true' : 'false'}
                      style={{
                        ...indexAccentStyle(rowColor),
                        color: isBrandMode ? undefined : rowColor,
                        cursor: 'grab',
                      }}
                      onDoubleClick={() => onAssignToSlot(candidate.key)}
                      onMouseDown={drag.poolMouseDown(
                        candidate.key,
                        candidate.title,
                        isBrandMode ? 'var(--color-surface-2)' : (rowColor || 'var(--color-surface-2)'),
                      )}
                    >
                      {!isBrandMode ? (
                        <span className="content-pool__cell index-heroes-pool__pin-cell">
                          {candidate.isPinned ? '\u{1f4cc}' : ''}
                        </span>
                      ) : null}
                      <span className="content-pool__cell content-pool__cell--title index-heroes-pool__title-cell">
                        {candidate.title}
                      </span>
                      <span className="content-pool__cell index-heroes-pool__meta-cell">
                        {isBrandMode
                          ? (candidate.categories?.length
                            ? candidate.categories.map((cat, i) => (
                                <span key={cat}>
                                  {i > 0 ? ', ' : ''}
                                  <span style={{ color: catColorMap[cat] || activeType.color }}>
                                    {cat.charAt(0).toUpperCase() + cat.slice(1)}
                                  </span>
                                </span>
                              ))
                            : '\u2014')
                          : (candidate.categoryLabel || candidate.type)}
                      </span>
                      {!isBrandMode ? (
                        <span className="content-pool__cell index-heroes-pool__date-cell">
                          {candidate.dateText || '-'}
                        </span>
                      ) : null}
                      {!isBrandMode ? (
                        <span className="content-pool__cell index-heroes-pool__badge-cell">
                          {candidate.badge || ''}
                        </span>
                      ) : null}
                    </div>
                  );
                })}
                {pool.length === 0 ? (
                  <div className="content-pool__empty index-heroes-pool__empty">
                    No candidates for this filter.
                  </div>
                ) : null}
              </div>
            </div>
          </section>
        </div>
      </div>
    </section>
  );
}


/* ─────────────────────────────────────────────────────────────────
 * Navbar Panel
 * ────────────────────────────────────────────────────────────────── */

type NavbarTab = 'guides' | 'brands' | 'games' | 'hubs';

interface NavbarPanelViewProps {
  panel: NavbarPanelPayload;
  onMoveGuide: (slug: string, category: string, toSection: string) => void;
  onAddSection: (category: string, name: string) => void;
  onDeleteSection: (category: string, name: string) => void;
  onRenameSection: (category: string, oldName: string, newName: string) => void;
  onReorderSection: (category: string, index: number, direction: -1 | 1) => void;
  onRenameGuide: (slug: string, newName: string) => void;
  onAddBrand: (slug: string, category: string) => void;
  onRemoveBrand: (slug: string, category: string) => void;
  onToggleBrandNavbar: (slug: string, category: string) => void;
  onRenameBrand: (slug: string, newName: string) => void;
  onToggleGame: (slug: string, value: boolean) => void;
  onToggleAllGames: () => void;
  onRenameGame: (slug: string, newName: string) => void;
}

type NavbarDialogState =
  | { mode: 'addSection'; category: string }
  | { mode: 'renameSection'; category: string; sectionName: string }
  | { mode: 'deleteSection'; category: string; sectionName: string }
  | { mode: 'renameGuide'; slug: string; current: string }
  | { mode: 'renameBrand'; slug: string; current: string }
  | { mode: 'renameGame'; slug: string; current: string };

function NavbarDialog({
  state,
  onClose,
  onSubmit,
}: {
  state: NavbarDialogState;
  onClose: () => void;
  onSubmit: (value: string) => void;
}) {
  const [draft, setDraft] = useState('');

  useEffect(() => {
    if (state.mode === 'addSection') {
      setDraft('');
    } else if (state.mode === 'renameSection') {
      setDraft(state.sectionName);
    } else if (state.mode === 'deleteSection') {
      setDraft('');
    } else if (state.mode === 'renameGuide') {
      setDraft(state.current);
    } else if (state.mode === 'renameBrand') {
      setDraft(state.current);
    } else if (state.mode === 'renameGame') {
      setDraft(state.current);
    }
  }, [state]);

  const title =
    state.mode === 'addSection' ? 'Add Section'
    : state.mode === 'renameSection' ? 'Rename Section'
    : state.mode === 'deleteSection' ? `Delete "${state.sectionName}"?`
    : state.mode === 'renameGuide' ? 'Rename Guide'
    : state.mode === 'renameBrand' ? 'Rename Brand'
    : 'Rename Game';

  const isDelete = state.mode === 'deleteSection';

  return (
    <DialogOverlay onDismiss={onClose}>
      <div className="dialog navbar-panel__dialog" role="dialog" aria-modal="true" aria-label={title}>
        <div className="dialog__body">
          <div className="dialog__header">
            <h2 className="dialog__title">{title}</h2>
          </div>
          {isDelete ? (
            <p className="navbar-panel__dialog-text">
              Items in this section will be moved to Unassigned.
            </p>
          ) : (
            <label className="field">
              <span className="field__label">Name</span>
              <input
                className="field__input"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && draft.trim()) {
                    onSubmit(draft.trim());
                  }
                }}
              />
            </label>
          )}
        </div>
        <div className="dialog__actions">
          <div className="dialog__actions-spacer" />
          <button type="button" className="token-button token-button--quiet" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className={`token-button ${isDelete ? 'token-button--danger' : 'token-button--accent'}`}
            onClick={() => onSubmit(isDelete ? 'confirm' : draft.trim())}
            disabled={!isDelete && !draft.trim()}
          >
            {isDelete ? 'Delete' : 'Apply'}
          </button>
        </div>
      </div>
    </DialogOverlay>
  );
}

export function NavbarPanelView({
  panel,
  onMoveGuide,
  onAddSection,
  onDeleteSection,
  onRenameSection,
  onReorderSection,
  onRenameGuide,
  onAddBrand,
  onRemoveBrand,
  onToggleBrandNavbar,
  onRenameBrand,
  onToggleGame,
  onToggleAllGames,
  onRenameGame,
}: NavbarPanelViewProps) {
  const drag = useDragGhost();
  const [activeTab, setActiveTab] = useState<NavbarTab>('guides');
  const [activeGuideCategory, setActiveGuideCategory] = useState('');
  const [activeBrandCategory, setActiveBrandCategory] = useState('');
  const [dialog, setDialog] = useState<NavbarDialogState | null>(null);
  const [guideSearch, setGuideSearch] = useState('');
  const [brandSearch, setBrandSearch] = useState('');

  // Resolve active categories
  const categoryIds = Object.keys(panel.guideSections);
  const resolvedGuideCategory = categoryIds.includes(activeGuideCategory)
    ? activeGuideCategory
    : categoryIds[0] ?? '';
  const resolvedBrandCategory = categoryIds.includes(activeBrandCategory)
    ? activeBrandCategory
    : categoryIds[0] ?? '';

  useEffect(() => {
    if (!categoryIds.includes(activeGuideCategory) && categoryIds.length > 0) {
      setActiveGuideCategory(categoryIds[0]);
    }
  }, [panel]);

  useEffect(() => {
    if (!categoryIds.includes(activeBrandCategory) && categoryIds.length > 0) {
      setActiveBrandCategory(categoryIds[0]);
    }
  }, [panel]);

  // Guide sections for current category
  const guideSections = panel.guideSections[resolvedGuideCategory] ?? [];
  const sectionOrder = panel.sectionOrder[resolvedGuideCategory] ?? [];
  const lowerGuideSearch = guideSearch.trim().toLowerCase();

  // Brand data
  const lowerBrandSearch = brandSearch.trim().toLowerCase();

  // Tab pills
  const tabItems: Array<{ key: NavbarTab; label: string }> = [
    { key: 'guides', label: 'Guides' },
    { key: 'brands', label: 'Brands' },
    { key: 'games', label: 'Games' },
    { key: 'hubs', label: 'Hubs' },
  ];

  const categoryPills = categoryIds.map((id) => ({
    key: id,
    label: panel.categoryLabels[id] ?? id,
    style: { '--pill-accent': panel.categoryColors[id] ?? 'var(--color-blue)' } as VariableStyle,
  }));

  // Drag handlers for guides
  drag.registerOnDrop((item, targetSlotId, isOverPool) => {
    if (activeTab === 'guides' && targetSlotId) {
      // targetSlotId = sectionName
      onMoveGuide(item.key, resolvedGuideCategory, targetSlotId === 'Unassigned' ? '' : targetSlotId);
    } else if (activeTab === 'brands') {
      if (targetSlotId?.startsWith('brand-')) {
        const catId = targetSlotId.slice(6);
        onAddBrand(item.key, catId);
      } else if (isOverPool && item.source === 'slot') {
        // Determine which category to remove from based on drag source
        // The brand could be in multiple categories; remove from whichever column it was dragged from
        for (const catId of categoryIds) {
          const brand = panel.brands.find((b) => b.slug === item.key);
          if (brand?.categories.includes(catId)) {
            onRemoveBrand(item.key, catId);
            break;
          }
        }
      }
    }
  });

  const handleDialogSubmit = (value: string) => {
    if (!dialog) { return; }
    if (dialog.mode === 'addSection') {
      onAddSection(dialog.category, value);
    } else if (dialog.mode === 'renameSection') {
      onRenameSection(dialog.category, dialog.sectionName, value);
    } else if (dialog.mode === 'deleteSection') {
      onDeleteSection(dialog.category, dialog.sectionName);
    } else if (dialog.mode === 'renameGuide') {
      onRenameGuide(dialog.slug, value);
    } else if (dialog.mode === 'renameBrand') {
      onRenameBrand(dialog.slug, value);
    } else if (dialog.mode === 'renameGame') {
      onRenameGame(dialog.slug, value);
    }
    setDialog(null);
  };

  const activeGames = panel.games.filter((g) => g.navbar).length;

  return (
    <section className="content-panel navbar-panel">
      <DragGhost ghost={drag.ghost} />
      {dialog && (
        <NavbarDialog
          state={dialog}
          onClose={() => setDialog(null)}
          onSubmit={handleDialogSubmit}
        />
      )}

      <PillBar
        items={tabItems}
        activeKey={activeTab}
        onSelect={setActiveTab}
        className="content-panel__main-tabs"
        pillClassName="content-panel__main-tab"
      />

      <div className="navbar-panel__info-bar">
        <span className="navbar-panel__info-text">
          {activeTab === 'guides'
            ? 'Assign guides to mega-menu sections. Drag between columns or use the Unassigned pool.'
            : activeTab === 'brands'
              ? 'Assign brands to category navbars. Checkbox toggles navbar visibility.'
              : activeTab === 'games'
                ? `Toggle which games appear in the navbar. ${activeGames}/${panel.games.length} active.`
                : 'Category hub pages — use Categories tab to edit flags.'}
        </span>
      </div>

      {/* ── Guides Tab ── */}
      {activeTab === 'guides' && (
        <div className="navbar-panel__guides">
          <div className="navbar-panel__guides-layout">
            <div className="navbar-panel__columns-area">
              <PillBar
                items={categoryPills}
                activeKey={resolvedGuideCategory}
                onSelect={setActiveGuideCategory}
                className="navbar-panel__category-pills"
                pillClassName="navbar-panel__category-pill"
              />
              <div className="navbar-panel__columns">
                {guideSections.filter((s) => s.name !== 'Unassigned').map((section) => {
                const orderIndex = sectionOrder.indexOf(section.name);
                const catColor = panel.categoryColors[resolvedGuideCategory] ?? 'var(--color-blue)';
                const filteredItems = lowerGuideSearch
                  ? section.items.filter((item) =>
                      item.guide.toLowerCase().includes(lowerGuideSearch) ||
                      item.title.toLowerCase().includes(lowerGuideSearch),
                    )
                  : section.items;

                return (
                  <div
                    key={section.name}
                    className="navbar-panel__column"
                    ref={(el) => drag.registerSlot(section.name, el)}
                    data-drop={drag.dropTarget === section.name ? 'true' : 'false'}
                  >
                    <div
                      className="navbar-panel__column-bar"
                      style={{ backgroundColor: catColor }}
                    />
                    <div className="navbar-panel__column-header">
                      <span className="navbar-panel__column-title">{section.name}</span>
                      <span className="navbar-panel__count-badge" style={{ backgroundColor: catColor }}>
                        {section.items.length}
                      </span>
                      <span className="navbar-panel__column-controls">
                        <span className="navbar-panel__control-group">
                          {orderIndex > 0 && (
                            <button
                              type="button"
                              className="navbar-panel__reorder-btn"
                              title="Move left"
                              onClick={() => onReorderSection(resolvedGuideCategory, orderIndex, -1)}
                            >
                              ◀
                            </button>
                          )}
                          {orderIndex < sectionOrder.length - 1 && (
                            <button
                              type="button"
                              className="navbar-panel__reorder-btn"
                              title="Move right"
                              onClick={() => onReorderSection(resolvedGuideCategory, orderIndex, 1)}
                            >
                              ▶
                            </button>
                          )}
                        </span>
                        <span className="navbar-panel__control-divider" />
                        <span className="navbar-panel__control-group">
                          <button
                            type="button"
                            className="navbar-panel__reorder-btn"
                            title="Rename section"
                            onClick={() =>
                              setDialog({
                                mode: 'renameSection',
                                category: resolvedGuideCategory,
                                sectionName: section.name,
                              })
                            }
                          >
                            ✎
                          </button>
                          <button
                            type="button"
                            className="navbar-panel__reorder-btn navbar-panel__reorder-btn--danger"
                            title="Delete section"
                            onClick={() =>
                              setDialog({
                                mode: 'deleteSection',
                                category: resolvedGuideCategory,
                                sectionName: section.name,
                              })
                            }
                          >
                            ✕
                          </button>
                        </span>
                      </span>
                    </div>
                    <div className="navbar-panel__column-items">
                      {filteredItems.map((item) => (
                        <div
                          key={item.slug}
                          className="navbar-panel__item"
                          onMouseDown={drag.poolMouseDown(item.slug, item.guide, catColor)}
                          onDoubleClick={() =>
                            setDialog({ mode: 'renameGuide', slug: item.slug, current: item.guide })
                          }
                        >
                          <span className="navbar-panel__item-name">{item.guide}</span>
                        </div>
                      ))}
                      {filteredItems.length === 0 && (
                        <div className="navbar-panel__empty">
                          {lowerGuideSearch ? 'No matches' : 'Drop guides here'}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
              </div>
            </div>

            <div className="navbar-panel__layout-divider" />

            <div className="navbar-panel__pool-area">
              <button
                type="button"
                className="token-button token-button--quiet navbar-panel__action-btn"
                onClick={() => setDialog({ mode: 'addSection', category: resolvedGuideCategory })}
              >
                + Add Section
              </button>
              <input
                className="field__input navbar-panel__pool-search"
                placeholder="Search guides…"
                value={guideSearch}
                onChange={(e) => setGuideSearch(e.target.value)}
              />
              {(() => {
                const unassigned = guideSections.find((s) => s.name === 'Unassigned');
                if (!unassigned) { return null; }
                const catColor = panel.categoryColors[resolvedGuideCategory] ?? 'var(--color-blue)';
                const filteredItems = lowerGuideSearch
                  ? unassigned.items.filter((item) =>
                      item.guide.toLowerCase().includes(lowerGuideSearch) ||
                      item.title.toLowerCase().includes(lowerGuideSearch),
                    )
                  : unassigned.items;

                return (
                  <div
                    className="navbar-panel__column navbar-panel__column--unassigned"
                    ref={(el) => drag.registerSlot('Unassigned', el)}
                    data-drop={drag.dropTarget === 'Unassigned' ? 'true' : 'false'}
                  >
                    <div
                      className="navbar-panel__column-bar"
                      style={{ backgroundColor: 'var(--color-overlay-0)' }}
                    />
                    <div className="navbar-panel__column-header">
                      <span className="navbar-panel__column-title">Unassigned</span>
                      <span className="navbar-panel__count-badge navbar-panel__count-badge--neutral">
                        {unassigned.items.length}
                      </span>
                    </div>
                    <div className="navbar-panel__column-items">
                      {filteredItems.map((item) => (
                        <div
                          key={item.slug}
                          className="navbar-panel__item"
                          onMouseDown={drag.poolMouseDown(item.slug, item.guide, catColor)}
                          onDoubleClick={() =>
                            setDialog({ mode: 'renameGuide', slug: item.slug, current: item.guide })
                          }
                        >
                          <span className="navbar-panel__item-name">{item.guide}</span>
                        </div>
                      ))}
                      {filteredItems.length === 0 && (
                        <div className="navbar-panel__empty">
                          {lowerGuideSearch ? 'No matches' : 'No unassigned guides'}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>
        </div>
      )}

      {/* ── Brands Tab ── */}
      {activeTab === 'brands' && (
        <div className="navbar-panel__brands">
          <div className="navbar-panel__brands-layout">
            <div className="navbar-panel__columns">
              {categoryIds.map((catId) => {
                const catColor = panel.categoryColors[catId] ?? 'var(--color-blue)';
                const catLabel = panel.categoryLabels[catId] ?? catId;
                const catBrands = panel.brands
                  .filter((b) => b.categories.includes(catId))
                  .sort((a, b) => a.displayName.localeCompare(b.displayName));

                return (
                  <div
                    key={catId}
                    className="navbar-panel__brand-column"
                    ref={(el) => drag.registerSlot(`brand-${catId}`, el)}
                    data-drop={drag.dropTarget === `brand-${catId}` ? 'true' : 'false'}
                  >
                    <div
                      className="navbar-panel__column-bar"
                      style={{ backgroundColor: catColor }}
                    />
                    <div className="navbar-panel__column-header">
                      <span className="navbar-panel__column-title">{catLabel}</span>
                      <span className="navbar-panel__count-badge" style={{ backgroundColor: catColor }}>
                        {catBrands.length}
                      </span>
                    </div>
                    <div className="navbar-panel__column-items">
                      {catBrands.map((brand) => {
                        const inNavbar = brand.navbar.includes(catId);
                        return (
                          <div
                            key={brand.slug}
                            className="navbar-panel__item"
                            onMouseDown={drag.slotMouseDown(0, brand.slug, brand.displayName, catColor)}
                            onDoubleClick={() =>
                              setDialog({ mode: 'renameBrand', slug: brand.slug, current: brand.displayName })
                            }
                          >
                            <button
                              type="button"
                              className={`navbar-panel__brand-check ${inNavbar ? 'navbar-panel__brand-check--active' : ''}`}
                              style={{ '--check-color': catColor } as React.CSSProperties}
                              title={inNavbar ? 'In navbar — click to hide' : 'Hidden — click to show in navbar'}
                              onClick={(e) => {
                                e.stopPropagation();
                                onToggleBrandNavbar(brand.slug, catId);
                              }}
                            >
                            </button>
                            <span className="navbar-panel__item-name">{brand.displayName}</span>
                            <button
                              type="button"
                              className="navbar-panel__edit-btn"
                              title="Rename brand"
                              onClick={(e) => {
                                e.stopPropagation();
                                setDialog({ mode: 'renameBrand', slug: brand.slug, current: brand.displayName });
                              }}
                            >
                              ✎
                            </button>
                          </div>
                        );
                      })}
                      {catBrands.length === 0 && (
                        <div className="navbar-panel__empty">Drop brands here</div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="navbar-panel__layout-divider" />

            <div className="navbar-panel__pool-area">
              <input
                className="field__input navbar-panel__pool-search"
                placeholder="Search brands…"
                value={brandSearch}
                onChange={(e) => setBrandSearch(e.target.value)}
              />
              <div
                className="navbar-panel__brand-column navbar-panel__brand-column--pool"
                ref={(el) => drag.registerPool(el)}
                data-drop-pool={drag.overPool ? 'true' : 'false'}
              >
                <div className="navbar-panel__column-bar" style={{ backgroundColor: 'var(--color-overlay-0)' }} />
                <div className="navbar-panel__column-header">
                  <span className="navbar-panel__column-title">All Brands</span>
                  <span className="navbar-panel__count-badge navbar-panel__count-badge--neutral">
                    {panel.brands.length}
                  </span>
                </div>
                <div className="navbar-panel__column-items">
                  {(lowerBrandSearch
                    ? panel.brands.filter((b) => b.displayName.toLowerCase().includes(lowerBrandSearch))
                    : panel.brands
                  )
                    .sort((a, b) => a.displayName.localeCompare(b.displayName))
                    .map((brand) => (
                      <div
                        key={brand.slug}
                        className="navbar-panel__item"
                        onMouseDown={drag.poolMouseDown(brand.slug, brand.displayName, 'var(--color-overlay-0)')}
                        onDoubleClick={() =>
                          setDialog({ mode: 'renameBrand', slug: brand.slug, current: brand.displayName })
                        }
                      >
                        <span className="navbar-panel__item-name">{brand.displayName}</span>
                        {brand.categories.length > 0 && (
                          <span className="navbar-panel__brand-cats">
                            {brand.categories.map((c) => (
                              <span
                                key={c}
                                className="navbar-panel__brand-cat-tag"
                                style={{ '--tag-color': panel.categoryColors[c] ?? 'var(--color-overlay-0)' } as React.CSSProperties}
                              >
                                {panel.categoryLabels[c] ?? c}
                              </span>
                            ))}
                          </span>
                        )}
                      </div>
                    ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Games Tab ── */}
      {activeTab === 'games' && (
        <div className="navbar-panel__games">
          <div className="navbar-panel__games-header">
            <span className="navbar-panel__games-title">
              Games
              <span className="navbar-panel__count-badge navbar-panel__count-badge--neutral">
                {panel.games.length}
              </span>
            </span>
            <span className="navbar-panel__games-count">
              {activeGames}/{panel.games.length} active
            </span>
            <button
              type="button"
              className="token-button token-button--quiet"
              onClick={onToggleAllGames}
            >
              {panel.games.every((g) => g.navbar) ? 'Deactivate All' : 'Activate All'}
            </button>
          </div>
          <div className="navbar-panel__games-grid">
            {panel.games.map((game) => (
              <div
                key={game.slug}
                className="navbar-panel__game-card"
                data-active={game.navbar ? 'true' : 'false'}
              >
                <span className="navbar-panel__game-name">{game.game}</span>
                <button
                  type="button"
                  className="navbar-panel__edit-btn"
                  title="Rename game"
                  onClick={() =>
                    setDialog({ mode: 'renameGame', slug: game.slug, current: game.game })
                  }
                >
                  ✎
                </button>
                <Toggle
                  checked={game.navbar}
                  label={`Toggle ${game.game} in navbar`}
                  onChange={(value) => onToggleGame(game.slug, value)}
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Hubs Tab ── */}
      {activeTab === 'hubs' && (
        <div className="navbar-panel__hubs">
          <div className="navbar-panel__hubs-header">
            <span className="navbar-panel__hubs-title">
              Hub Categories
              <span className="navbar-panel__count-badge navbar-panel__count-badge--neutral">
                {panel.hubs.length}
              </span>
            </span>
            <span className="navbar-panel__hubs-note">
              Read-only · Use Categories tab to edit flags
            </span>
          </div>
          <div className="navbar-panel__hubs-list">
            {panel.hubs.map((hub) => (
              <div
                key={hub.id}
                className="navbar-panel__hub-card"
                style={{ '--content-accent': hub.color } as VariableStyle}
              >
                <span
                  className="navbar-panel__hub-dot"
                  style={{ backgroundColor: hub.color }}
                />
                <span className="navbar-panel__hub-label">{hub.label}</span>
                <span className="navbar-panel__hub-badges">
                  <span className={`navbar-panel__badge ${hub.productActive ? 'navbar-panel__badge--prod' : 'navbar-panel__badge--off'}`}>
                    Product
                  </span>
                  <span className={`navbar-panel__badge ${hub.viteActive ? 'navbar-panel__badge--vite' : 'navbar-panel__badge--off'}`}>
                    Vite
                  </span>
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

// ── Slideshow panel ─────────────────────────────────────────────────────

type SlideshowSortKey = 'score' | 'release' | 'brand' | 'model';

const SLIDESHOW_SORT_OPTIONS: { key: SlideshowSortKey; label: string }[] = [
  { key: 'score', label: 'Score' },
  { key: 'release', label: 'Release' },
  { key: 'brand', label: 'Brand' },
  { key: 'model', label: 'Model' },
];

interface SlideshowPanelViewProps {
  panel: SlideshowPanelPayload;
  onAddToQueue: (entryId: string, position?: number) => void;
  onRemoveFromQueue: (entryId: string) => void;
  onReorderQueue: (fromIndex: number, toIndex: number) => void;
  onMoveInQueue: (index: number, direction: -1 | 1) => void;
  onSetMaxSlides: (max: number) => void;
  onClearQueue: () => void;
  onAutoFill: () => void;
}

function sortSlideshowProducts(
  products: SlideshowProduct[],
  sortKey: SlideshowSortKey,
): SlideshowProduct[] {
  const sorted = [...products];
  if (sortKey === 'score') {
    sorted.sort((a, b) => {
      if (a.overall !== b.overall) return b.overall - a.overall;
      return `${a.brand} ${a.model}`.localeCompare(`${b.brand} ${b.model}`, undefined, { sensitivity: 'base' });
    });
  } else if (sortKey === 'release') {
    sorted.sort((a, b) => {
      const [yearA, monthA] = parseReleaseDate(a.releaseDate);
      const [yearB, monthB] = parseReleaseDate(b.releaseDate);
      if (yearA !== yearB) return yearB - yearA;
      if (monthA !== monthB) return monthB - monthA;
      return b.overall - a.overall;
    });
  } else if (sortKey === 'brand') {
    sorted.sort((a, b) => {
      const cmp = a.brand.localeCompare(b.brand, undefined, { sensitivity: 'base' });
      return cmp !== 0 ? cmp : a.model.localeCompare(b.model, undefined, { sensitivity: 'base' });
    });
  } else {
    sorted.sort((a, b) => a.model.localeCompare(b.model, undefined, { sensitivity: 'base' }));
  }
  return sorted;
}

export function SlideshowPanelView({
  panel,
  onAddToQueue,
  onRemoveFromQueue,
  onReorderQueue,
  onMoveInQueue,
  onSetMaxSlides,
  onClearQueue,
  onAutoFill,
}: SlideshowPanelViewProps) {
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [sortKey, setSortKey] = useState<SlideshowSortKey>('score');
  const drag = useDragGhost();
  const slidesRef = useRef(panel.slides);
  slidesRef.current = panel.slides;

  useEffect(() => {
    drag.registerOnDrop(
      createDropHandler({
        onAssign: (key, slotIndex) => onAddToQueue(key, slotIndex),
        onRemove: (slotIndex) => {
          const entryId = slidesRef.current[slotIndex];
          if (entryId) onRemoveFromQueue(entryId);
        },
        onMove: (fromSlot, toSlot) => onReorderQueue(fromSlot, toSlot),
      }),
    );
  }, [onAddToQueue, onRemoveFromQueue, onReorderQueue]);

  const queueSet = new Set(panel.slides);

  const searchLower = search.trim().toLowerCase();
  const filtered = sortSlideshowProducts(
    panel.products.filter((p) => {
      if (categoryFilter !== 'all' && p.category !== categoryFilter) return false;
      if (searchLower && !`${p.brand} ${p.model}`.toLowerCase().includes(searchLower)) return false;
      return true;
    }),
    sortKey,
  );

  const productCategories = new Set(panel.products.map((p) => p.category));
  const categoryPills = [
    { key: 'all', label: 'All' },
    ...Object.entries(panel.categoryLabels)
      .filter(([id]) => productCategories.has(id))
      .map(([id, label]) => ({ key: id, label })),
  ];

  const productMap = new Map(panel.products.map((p) => [p.entryId, p]));

  const activeCatColor =
    categoryFilter !== 'all'
      ? panel.categoryColors[categoryFilter] ?? undefined
      : undefined;

  return (
    <section
      className="content-panel slideshow-panel"
      style={activeCatColor ? { '--slideshow-accent': activeCatColor } as VariableStyle : undefined}
    >
      <DragGhost ghost={drag.ghost} />

      {/* ── Category filter tabs ── */}
      <PillBar
        items={categoryPills}
        activeKey={categoryFilter}
        onSelect={setCategoryFilter}
        className="content-panel__main-tabs"
        pillClassName="content-panel__main-tab"
      />

      {/* ── Sort pills + search + queue controls ── */}
      <div className="slideshow-panel__controls">
        <PillBar
          items={SLIDESHOW_SORT_OPTIONS}
          activeKey={sortKey}
          onSelect={setSortKey}
          className="content-panel__sort-pills"
          pillClassName="content-panel__sort-pill"
        />
        <label className="content-panel__search">
          <span className="content-panel__search-label">Search</span>
          <input
            className="field__input"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filter products..."
          />
        </label>
      </div>

      {/* ── Pool + divider + queue ── */}
      <div className="slideshow-panel__layout">
        {/* Product pool */}
        <section
          className={`content-pool slideshow-panel__pool${drag.overPool && drag.dragItem ? ' content-pool--drop-active' : ''}`}
          ref={drag.registerPool}
        >
          <div className="content-pool__accent" />
          <div className="content-pool__header">
            <h2 className="content-pool__title">Product Pool</h2>
            <span className="content-pool__meta">
              {panel.products.length} products · {filtered.length} shown
            </span>
          </div>
          <div className="content-pool__table">
            <div className="content-pool__head">
              <span className="content-pool__col">Brand</span>
              <span className="content-pool__col">Model</span>
              <span className="content-pool__col">Cat</span>
              <span className="content-pool__col">Score</span>
              <span className="content-pool__col">Released</span>
              <span className="content-pool__col">$</span>
            </div>
            <div className="content-pool__body">
              {filtered.map((p) => {
                const inQueue = queueSet.has(p.entryId);
                const catColor = panel.categoryColors[p.category] ?? 'var(--color-surface-2)';
                return (
                  <div
                    key={p.entryId}
                    className={`content-pool__row${inQueue || drag.dragItem?.key === p.entryId ? ' content-pool__row--dragging' : ''}`}
                    style={{ ...contentAccentStyle(catColor), cursor: inQueue ? 'default' : 'grab' }}
                    onDoubleClick={inQueue ? undefined : () => onAddToQueue(p.entryId)}
                    onMouseDown={
                      inQueue
                        ? undefined
                        : drag.poolMouseDown(p.entryId, `${p.brand} ${p.model}`, catColor)
                    }
                    title={inQueue ? 'Already in queue' : 'Drag or double-click to add'}
                  >
                    <span className="content-pool__cell content-pool__cell--title">
                      {p.brand}
                    </span>
                    <span className="content-pool__cell content-pool__cell--title">
                      {p.model}
                    </span>
                    <span className="content-pool__cell slideshow-panel__cell-cat">
                      {panel.categoryLabels[p.category] ?? p.category}
                    </span>
                    <span className="content-pool__cell">{p.overall.toFixed(1)}</span>
                    <span className="content-pool__cell">{p.releaseDate || '—'}</span>
                    <span className="content-pool__cell slideshow-panel__cell-deal">
                      {p.hasDeal ? '$' : ''}
                    </span>
                  </div>
                );
              })}
              {filtered.length === 0 ? (
                <div className="content-pool__empty">
                  No eligible products match the current filter.
                </div>
              ) : null}
            </div>
          </div>
        </section>

        {/* Divider */}
        <div className="slideshow-panel__divider" />

        {/* Queue */}
        <section className="content-dashboard slideshow-panel__queue">
          <div className="content-dashboard__header">
            <div className="content-dashboard__title-wrap">
              <h2 className="content-dashboard__title">Slideshow Queue</h2>
              <button type="button" className="token-button token-button--quiet" onClick={onAutoFill}>
                Auto-fill
              </button>
              <button type="button" className="token-button token-button--danger" onClick={onClearQueue}>
                Clear
              </button>
            </div>
            <span className="content-dashboard__meta">
              {panel.slides.length}/{panel.maxSlides} filled · max
              <span className="slideshow-panel__stepper">
                <button
                  type="button"
                  className="slideshow-panel__stepper-btn"
                  disabled={panel.maxSlides <= 1}
                  onClick={() => onSetMaxSlides(panel.maxSlides - 1)}
                  aria-label="Decrease max slides"
                >
                  ‹
                </button>
                <span className="slideshow-panel__stepper-value">{panel.maxSlides}</span>
                <button
                  type="button"
                  className="slideshow-panel__stepper-btn"
                  disabled={panel.maxSlides >= 20}
                  onClick={() => onSetMaxSlides(panel.maxSlides + 1)}
                  aria-label="Increase max slides"
                >
                  ›
                </button>
              </span>
            </span>
          </div>
          <div className="content-dashboard__grid slideshow-panel__queue-grid">
            {Array.from({ length: panel.maxSlides }, (_, i) => {
              const entryId = panel.slides[i];
              const product = entryId ? productMap.get(entryId) : undefined;
              const isDropTarget = drag.dropTarget === String(i);
              const catColor = product
                ? panel.categoryColors[product.category] ?? 'var(--color-surface-2)'
                : 'var(--color-surface-2)';
              const isLowScore = product !== undefined && product.overall < 8.0;
              const slotClass = [
                'content-dashboard__slot',
                product ? 'content-dashboard__slot--filled' : '',
                product ? 'content-dashboard__slot--manual' : '',
                'slideshow-panel__slot',
                isLowScore ? 'slideshow-panel__slot--warning' : '',
                isDropTarget ? 'content-dashboard__slot--drop-target' : '',
              ].filter(Boolean).join(' ');

              return (
                <article
                  key={`slot-${i}`}
                  className={slotClass}
                  style={contentAccentStyle(catColor)}
                  ref={(el) => drag.registerSlot(String(i), el)}
                  onKeyDown={(e) => {
                    if (!product) return;
                    if (e.key === 'ArrowUp') { e.preventDefault(); onMoveInQueue(i, -1); }
                    if (e.key === 'ArrowDown') { e.preventDefault(); onMoveInQueue(i, 1); }
                    if (e.key === 'Delete' || e.key === 'Backspace') {
                      e.preventDefault();
                      onRemoveFromQueue(entryId!);
                    }
                  }}
                  tabIndex={product ? 0 : -1}
                >
                  <div className="content-dashboard__slot-inner slideshow-panel__slot-inner">
                    {product ? (
                      <button
                        type="button"
                        className="content-dashboard__remove slideshow-panel__slot-close"
                        onClick={(e) => { e.stopPropagation(); onRemoveFromQueue(entryId!); }}
                      >
                        <CloseIcon title="Remove from queue" />
                      </button>
                    ) : null}
                    <div className="content-dashboard__slot-top">
                      <div className="content-dashboard__slot-labels">
                        <span className="content-dashboard__slot-number">{i + 1}</span>
                      </div>
                      {product ? (
                        <span className={`content-dashboard__slot-badge${isLowScore ? ' slideshow-panel__badge--warning' : ''}`}>
                          {product.overall > 0 ? product.overall.toFixed(1) : '—'}
                        </span>
                      ) : null}
                    </div>
                    {product ? (
                      <div
                        className="content-dashboard__slot-body slideshow-panel__slot-body"
                        style={{ cursor: 'grab' }}
                        onMouseDown={drag.slotMouseDown(
                          i,
                          entryId!,
                          `${product.brand} ${product.model}`,
                          catColor,
                        )}
                      >
                        <div className="content-dashboard__slot-title slideshow-panel__slot-title">
                          {product.brand} — {product.model}
                        </div>
                      </div>
                    ) : (
                      <div className="content-dashboard__slot-empty">Drop product here</div>
                    )}
                    {product ? (
                      <div className="content-dashboard__slot-bottom">
                        <span className="content-dashboard__slot-category">
                          {panel.categoryLabels[product.category] ?? product.category}
                        </span>
                        <span className="content-dashboard__slot-date">
                          {product.releaseDate || '—'}
                        </span>
                      </div>
                    ) : null}
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      </div>
    </section>
  );
}


/* ── Image Defaults panel ───────────────────────────────────────────── */

interface ImageDefaultsPanelViewProps {
  panel: ImageDefaultsPanelPayload;
  onFieldChange: (categoryId: string, fieldKey: string, value: string[]) => void;
  onReorderPriority: (categoryId: string, fromIndex: number, toIndex: number) => void;
  onMovePriority: (categoryId: string, index: number, direction: number) => void;
  onResetPriority: (categoryId: string) => void;
  onSetViewMeta: (categoryId: string, view: string, field: string, value: string) => void;
  onToggleFit: (categoryId: string, view: string) => void;
}

const STATUS_COLORS: Record<string, string> = {
  common: 'var(--color-green)',
  partial: 'var(--color-yellow)',
  sparse: 'var(--color-red)',
  anomaly: 'var(--color-red)',
};

const STATUS_LABELS: Record<string, string> = {
  common: 'COM',
  partial: 'PAR',
  sparse: 'SPA',
  anomaly: 'ANO',
};

function FallbackTag({ view, coveragePct }: { view: string; coveragePct: number }) {
  return (
    <span className="image-defaults-panel__fallback-tag" title={`${view}: ${coveragePct}% coverage`}>
      {view} <span className="image-defaults-panel__fallback-pct">{coveragePct}%</span>
    </span>
  );
}

function FallbackRow({
  label,
  fieldKey,
  categoryId,
  resolved,
  scannerViews,
  totalProducts,
  canonicalViews,
  onFieldChange,
}: {
  label: string;
  fieldKey: string;
  categoryId: string;
  resolved: Record<string, unknown>;
  scannerViews: Record<string, number>;
  totalProducts: number;
  canonicalViews: string[];
  onFieldChange: (categoryId: string, fieldKey: string, value: string[]) => void;
}) {
  const currentValue = (resolved[fieldKey] as string[]) ?? [];
  const primaryViews = currentValue;
  const fallbacks = computeFallbacks(canonicalViews, primaryViews, scannerViews, totalProducts);

  const handleChange = (index: number, newView: string) => {
    const next = [...currentValue];
    next[index] = newView;
    onFieldChange(categoryId, fieldKey, next);
  };

  return (
    <div className="image-defaults-panel__fallback-row">
      <span className="image-defaults-panel__fallback-label">{label}</span>
      <div className="image-defaults-panel__fallback-selects">
        {currentValue.map((view, i) => (
          <select
            key={i}
            className="field__input image-defaults-panel__fallback-select"
            value={view}
            onChange={(e) => handleChange(i, e.target.value)}
          >
            {canonicalViews.map((v) => (
              <option key={v} value={v}>{v}</option>
            ))}
          </select>
        ))}
      </div>
      <div className="image-defaults-panel__fallback-tags">
        {fallbacks.slice(0, 5).map((fb) => (
          <FallbackTag key={fb.view} view={fb.view} coveragePct={fb.coveragePct} />
        ))}
      </div>
    </div>
  );
}

export function ImageDefaultsPanelView({
  panel,
  onFieldChange,
  onReorderPriority,
  onMovePriority,
  onResetPriority,
  onSetViewMeta,
  onToggleFit,
}: ImageDefaultsPanelViewProps) {
  const [activeCategory, setActiveCategory] = useState('__defaults__');

  const resolved = resolveDefaults(panel, activeCategory);

  // Scanner data for the active category
  const scannerData = activeCategory === '__defaults__'
    ? null
    : panel.scanner[activeCategory] ?? null;

  // Aggregate view counts across all categories for __defaults__
  const aggregateViewCounts: Record<string, number> = {};
  let aggregateTotalProducts = 0;
  if (activeCategory === '__defaults__') {
    for (const catData of Object.values(panel.scanner)) {
      aggregateTotalProducts += catData.productCount;
      for (const vs of catData.views) {
        aggregateViewCounts[vs.view] = (aggregateViewCounts[vs.view] ?? 0) + vs.count;
      }
    }
  }

  const scannerViews: Record<string, number> = activeCategory === '__defaults__'
    ? aggregateViewCounts
    : Object.fromEntries(
        (scannerData?.views ?? []).map((vs) => [vs.view, vs.count]),
      );
  const totalProducts = activeCategory === '__defaults__'
    ? aggregateTotalProducts
    : scannerData?.productCount ?? 0;

  // Scanner display rows (sorted by coverage desc)
  const scannerRows = activeCategory === '__defaults__'
    ? Object.entries(aggregateViewCounts)
        .map(([view, count]) => {
          const pct = aggregateTotalProducts > 0 ? Math.round((count / aggregateTotalProducts) * 100) : 0;
          const isCanonical = panel.canonicalViews.includes(view);
          const status = !isCanonical ? 'anomaly' : pct >= 90 ? 'common' : pct >= 50 ? 'partial' : 'sparse';
          return { view, count, coveragePct: pct, status, isCanonical };
        })
        .sort((a, b) => b.coveragePct - a.coveragePct)
    : (scannerData?.views ?? []);

  const viewPriority = resolved.viewPriority as string[];
  const viewMeta = resolved.viewMeta as Record<string, { objectFit: string; label: string; labelShort: string }>;
  const hasOverridePriority = activeCategory !== '__defaults__' && (panel.categories[activeCategory]?.viewPriority != null);

  const activePill = panel.categoryPills.find((p) => p.id === activeCategory);
  const accentColor = activePill?.color ?? 'var(--theme-site-primary)';

  return (
    <section
      className="content-panel image-defaults-panel"
      style={{ '--image-defaults-accent': accentColor } as VariableStyle}
    >
      <div className="content-panel__main-tabs">
        {panel.categoryPills.map((pill) => (
          <button
            key={pill.id}
            type="button"
            className="content-panel__main-tab"
            data-active={pill.id === activeCategory ? 'true' : 'false'}
            style={{ '--content-accent': pill.color } as VariableStyle}
            onClick={() => setActiveCategory(pill.id)}
          >
            {pill.label}
            {pill.productCount > 0 ? (
              <span className="image-defaults-panel__pill-count">{pill.productCount}</span>
            ) : null}
          </button>
        ))}
      </div>

      <div className="image-defaults-panel__layout">
        {/* ── Scanner (left) ──────────────────────────────────────── */}
        <div className="image-defaults-panel__scanner">
          <div className="image-defaults-panel__section-title">
            View Scanner
            <span className="image-defaults-panel__section-meta">
              {totalProducts} products
            </span>
          </div>
          <div className="content-pool__accent" />
          <div className="content-pool__head image-defaults-panel__scanner-head">
            <span>View</span>
            <span>Count</span>
            <span>%</span>
            <span>Status</span>
          </div>
          <div className="content-pool__body image-defaults-panel__scanner-body">
            {scannerRows.map((row) => (
              <div
                key={row.view}
                className="content-pool__row image-defaults-panel__scanner-row"
              >
                <span className={row.isCanonical ? '' : 'image-defaults-panel__anomaly'}>
                  {row.view}
                </span>
                <span>{row.count}</span>
                <span>{row.coveragePct}%</span>
                <span
                  className="image-defaults-panel__status-badge"
                  style={{ color: STATUS_COLORS[row.status] } as VariableStyle}
                >
                  {STATUS_LABELS[row.status]}
                </span>
              </div>
            ))}
            {scannerRows.length === 0 ? (
              <div className="content-pool__row image-defaults-panel__scanner-row">
                <span className="image-defaults-panel__empty">No scanner data</span>
              </div>
            ) : null}
          </div>
        </div>

        {/* ── Divider ──────────────────────────────────────────────── */}
        <div className="image-defaults-panel__divider" />

        {/* ── Editor (right) ──────────────────────────────────────── */}
        <div className="image-defaults-panel__editor">

          {/* ═══ Contain Defaults ═══ */}
          <div className="image-defaults-panel__section-title">Contain Defaults</div>
          <FallbackRow
            label="Default View"
            fieldKey="defaultImageView"
            categoryId={activeCategory}
            resolved={resolved}
            scannerViews={scannerViews}
            totalProducts={totalProducts}
            canonicalViews={panel.canonicalViews}
            onFieldChange={onFieldChange}
          />
          <FallbackRow
            label="List Thumb"
            fieldKey="listThumbKeyBase"
            categoryId={activeCategory}
            resolved={resolved}
            scannerViews={scannerViews}
            totalProducts={totalProducts}
            canonicalViews={panel.canonicalViews}
            onFieldChange={onFieldChange}
          />
          <FallbackRow
            label="Header Game"
            fieldKey="headerGame"
            categoryId={activeCategory}
            resolved={resolved}
            scannerViews={scannerViews}
            totalProducts={totalProducts}
            canonicalViews={panel.canonicalViews}
            onFieldChange={onFieldChange}
          />

          {/* ═══ Cover Defaults ═══ */}
          <div className="image-defaults-panel__section-title">Cover Defaults</div>
          <FallbackRow
            label="Cover View"
            fieldKey="coverImageView"
            categoryId={activeCategory}
            resolved={resolved}
            scannerViews={scannerViews}
            totalProducts={totalProducts}
            canonicalViews={panel.canonicalViews}
            onFieldChange={onFieldChange}
          />

          {/* ═══ View Priority ═══ */}
          <div className="image-defaults-panel__section-title">
            View Priority
            {hasOverridePriority ? (
              <button
                type="button"
                className="token-button image-defaults-panel__reset-btn"
                onClick={() => onResetPriority(activeCategory)}
              >
                Reset to Defaults
              </button>
            ) : null}
          </div>
          <div className="image-defaults-panel__priority-list">
            {viewPriority.map((view, i) => (
              <div key={view} className="image-defaults-panel__priority-item">
                <span className="image-defaults-panel__priority-num">{i + 1}.</span>
                <span className="image-defaults-panel__priority-view">{view}</span>
                <button
                  type="button"
                  className="image-defaults-panel__ghost-btn"
                  disabled={i === 0}
                  onClick={() => onMovePriority(activeCategory, i, -1)}
                  aria-label={`Move ${view} up`}
                >
                  ▲
                </button>
                <button
                  type="button"
                  className="image-defaults-panel__ghost-btn"
                  disabled={i === viewPriority.length - 1}
                  onClick={() => onMovePriority(activeCategory, i, 1)}
                  aria-label={`Move ${view} down`}
                >
                  ▼
                </button>
              </div>
            ))}
          </div>

          {/* ═══ View Meta ═══ */}
          <div className="image-defaults-panel__section-title">View Meta</div>
          <div className="image-defaults-panel__meta-table">
            <div className="image-defaults-panel__meta-head">
              <span>View</span>
              <span>Fit</span>
              <span>Label</span>
              <span>Short</span>
            </div>
            {Object.entries(viewMeta).map(([view, meta]) => (
              <div key={view} className="image-defaults-panel__meta-row">
                <span className="image-defaults-panel__meta-view">{view}</span>
                <button
                  type="button"
                  className={`token-button image-defaults-panel__meta-toggle ${
                    meta.objectFit === 'contain'
                      ? 'image-defaults-panel__meta-toggle--contain'
                      : 'image-defaults-panel__meta-toggle--cover'
                  }`}
                  onClick={() => onToggleFit(activeCategory, view)}
                >
                  {meta.objectFit}
                </button>
                <input
                  type="text"
                  className="field__input image-defaults-panel__meta-input"
                  value={meta.label}
                  onChange={(e) => onSetViewMeta(activeCategory, view, 'label', e.target.value)}
                />
                <input
                  type="text"
                  className="field__input image-defaults-panel__meta-input image-defaults-panel__meta-input--short"
                  value={meta.labelShort}
                  onChange={(e) => onSetViewMeta(activeCategory, view, 'labelShort', e.target.value)}
                />
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

/* ─────────────────────────────────────────────────────────────────
 * Cache / CDN panel
 * ────────────────────────────────────────────────────────────────── */

const CACHE_POLICY_NAMES = [
  'staticPages', 'hubPages', 'staticAssets', 'images', 'searchApi', 'dynamicApis',
] as const;

const CACHE_PAGE_TYPE_NAMES = [
  'sitePages', 'hubPages', 'staticAssets', 'images', 'searchApi',
  'authAndSession', 'userData', 'apiFallback',
] as const;

type CacheCdnTab = 'policies' | 'pageTypes' | 'targets' | 'preview' | 'audit';

interface CacheCdnPanelViewProps {
  panel: CacheCdnPanelPayload;
  onSetPolicyField: (policyName: string, fieldName: string, value: unknown) => void;
  onSetPageTypeField: (pageTypeName: string, fieldName: string, value: unknown) => void;
  onSetTargetField: (targetIndex: number, fieldName: string, value: unknown) => void;
  onAddTarget: () => void;
  onDeleteTarget: (targetIndex: number) => void;
}

export function CacheCdnPanelView({
  panel,
  onSetPolicyField,
  onSetPageTypeField,
  onSetTargetField,
  onAddTarget,
  onDeleteTarget,
}: CacheCdnPanelViewProps) {
  const [activeTab, setActiveTab] = useState<CacheCdnTab>('policies');
  const [selectedPolicy, setSelectedPolicy] = useState<string>(CACHE_POLICY_NAMES[0]);
  const [selectedPageType, setSelectedPageType] = useState<string>(CACHE_PAGE_TYPE_NAMES[0]);
  const [selectedTargetIndex, setSelectedTargetIndex] = useState(0);

  const config = panel.config;

  // Clamp target index when targets change
  useEffect(() => {
    if (selectedTargetIndex >= config.targets.length) {
      setSelectedTargetIndex(Math.max(0, config.targets.length - 1));
    }
  }, [config.targets.length, selectedTargetIndex]);

  const tabs: { key: CacheCdnTab; label: string }[] = [
    { key: 'policies', label: 'Document Types' },
    { key: 'pageTypes', label: 'Page Types' },
    { key: 'targets', label: 'Route Targets' },
    { key: 'preview', label: 'Preview' },
    { key: 'audit', label: 'Audit' },
  ];

  return (
    <section className="cache-cdn-panel">
      <nav className="content-panel__main-tabs">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            className="content-panel__main-tab"
            data-active={activeTab === tab.key ? 'true' : undefined}
            onClick={() => setActiveTab(tab.key)}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      {activeTab === 'policies' && (
        <div className="cache-cdn-panel__master-detail">
          <div className="cache-cdn-panel__list-pane">
            {CACHE_POLICY_NAMES.map((name) => (
              <button
                key={name}
                type="button"
                className="cache-cdn-panel__list-item"
                data-active={name === selectedPolicy ? '' : undefined}
                onClick={() => setSelectedPolicy(name)}
              >
                <span className="cache-cdn-panel__list-item-name">{name}</span>
                <span className="cache-cdn-panel__preview-string">
                  {buildPolicyPreview(config.policies[name])}
                </span>
              </button>
            ))}
          </div>
          <div className="cache-cdn-panel__detail-pane">
            {config.policies[selectedPolicy] && (
              <CachePolicyDetail
                policyName={selectedPolicy}
                policy={config.policies[selectedPolicy]}
                onSetField={onSetPolicyField}
              />
            )}
          </div>
        </div>
      )}

      {activeTab === 'pageTypes' && (
        <div className="cache-cdn-panel__master-detail">
          <div className="cache-cdn-panel__list-pane">
            {CACHE_PAGE_TYPE_NAMES.map((name) => (
              <button
                key={name}
                type="button"
                className="cache-cdn-panel__list-item"
                data-active={name === selectedPageType ? '' : undefined}
                onClick={() => setSelectedPageType(name)}
              >
                <span className="cache-cdn-panel__list-item-name">
                  {config.pageTypes[name]?.label ?? name}
                </span>
                <span className="cache-cdn-panel__list-item-sub">
                  {config.pageTypes[name]?.policy ?? ''}
                </span>
              </button>
            ))}
          </div>
          <div className="cache-cdn-panel__detail-pane">
            {config.pageTypes[selectedPageType] && (
              <CachePageTypeDetail
                pageTypeName={selectedPageType}
                pageType={config.pageTypes[selectedPageType]}
                config={config}
                onSetField={onSetPageTypeField}
              />
            )}
          </div>
        </div>
      )}

      {activeTab === 'targets' && (
        <div className="cache-cdn-panel__master-detail">
          <div className="cache-cdn-panel__list-pane">
            <div className="cache-cdn-panel__action-bar">
              <button type="button" className="token-button" onClick={onAddTarget}>
                + Target
              </button>
              <button
                type="button"
                className="token-button"
                onClick={() => onDeleteTarget(selectedTargetIndex)}
                disabled={config.targets.length <= 1}
              >
                Delete
              </button>
            </div>
            {config.targets.map((target, index) => (
              <button
                key={target.id}
                type="button"
                className="cache-cdn-panel__list-item"
                data-active={index === selectedTargetIndex ? '' : undefined}
                onClick={() => setSelectedTargetIndex(index)}
              >
                <span className="cache-cdn-panel__list-item-name">{target.label}</span>
                <span className="cache-cdn-panel__list-item-sub">{target.pageType}</span>
              </button>
            ))}
          </div>
          <div className="cache-cdn-panel__detail-pane">
            {config.targets[selectedTargetIndex] && (
              <CacheTargetDetail
                targetIndex={selectedTargetIndex}
                target={config.targets[selectedTargetIndex]}
                onSetField={onSetTargetField}
              />
            )}
          </div>
        </div>
      )}

      {activeTab === 'preview' && (
        <div className="cache-cdn-panel__text-pane">
          <pre className="cache-cdn-panel__preview-text">{buildPreviewText(config)}</pre>
        </div>
      )}

      {activeTab === 'audit' && (
        <div className="cache-cdn-panel__text-pane">
          {(() => {
            const issues = auditConfig(config);
            if (issues.length === 0) {
              return <p className="cache-cdn-panel__audit-clean">No issues detected.</p>;
            }
            return (
              <ul className="cache-cdn-panel__audit-list">
                {issues.map((issue, i) => (
                  <li key={i} className="cache-cdn-panel__audit-issue">{issue}</li>
                ))}
              </ul>
            );
          })()}
        </div>
      )}
    </section>
  );
}

function CachePolicyDetail({
  policyName,
  policy,
  onSetField,
}: {
  policyName: string;
  policy: CacheCdnPanelPayload['config']['policies'][string];
  onSetField: (policyName: string, fieldName: string, value: unknown) => void;
}) {
  return (
    <div className="cache-cdn-panel__detail-form">
      <h3 className="cache-cdn-panel__detail-heading">{policyName}</h3>
      <div className="cache-cdn-panel__preview-string cache-cdn-panel__preview-string--detail">
        {buildPolicyPreview(policy)}
      </div>

      <label className="cache-cdn-panel__field">
        <span className="cache-cdn-panel__field-label">Browser Max-Age</span>
        <input
          type="number"
          className="field__input"
          value={policy.browserMaxAge}
          min={0}
          onChange={(e) => onSetField(policyName, 'browserMaxAge', coerceInt(e.target.value, 0))}
        />
      </label>

      <label className="cache-cdn-panel__field">
        <span className="cache-cdn-panel__field-label">Edge Max-Age</span>
        <input
          type="number"
          className="field__input"
          value={policy.edgeMaxAge}
          min={0}
          onChange={(e) => onSetField(policyName, 'edgeMaxAge', coerceInt(e.target.value, 0))}
        />
      </label>

      <label className="cache-cdn-panel__field">
        <span className="cache-cdn-panel__field-label">Stale While Revalidate</span>
        <input
          type="number"
          className="field__input"
          value={policy.staleWhileRevalidate}
          min={0}
          onChange={(e) => onSetField(policyName, 'staleWhileRevalidate', coerceInt(e.target.value, 0))}
        />
      </label>

      <label className="cache-cdn-panel__field">
        <span className="cache-cdn-panel__field-label">Must Revalidate</span>
        <input
          type="checkbox"
          checked={policy.mustRevalidate}
          onChange={(e) => onSetField(policyName, 'mustRevalidate', e.target.checked)}
        />
      </label>

      <label className="cache-cdn-panel__field">
        <span className="cache-cdn-panel__field-label">Immutable</span>
        <input
          type="checkbox"
          checked={policy.immutable}
          onChange={(e) => onSetField(policyName, 'immutable', e.target.checked)}
        />
      </label>

      <label className="cache-cdn-panel__field">
        <span className="cache-cdn-panel__field-label">No Store</span>
        <input
          type="checkbox"
          checked={policy.noStore}
          onChange={(e) => onSetField(policyName, 'noStore', e.target.checked)}
        />
      </label>

      <label className="cache-cdn-panel__field">
        <span className="cache-cdn-panel__field-label">Vary Query</span>
        <select
          className="field__input"
          value={policy.varyQuery}
          onChange={(e) => onSetField(policyName, 'varyQuery', e.target.value)}
        >
          <option value="none">none</option>
          <option value="all">all</option>
        </select>
      </label>

      <label className="cache-cdn-panel__field">
        <span className="cache-cdn-panel__field-label">Vary Headers</span>
        <input
          type="text"
          className="field__input"
          value={(policy.varyHeaders ?? []).join(', ')}
          onChange={(e) => onSetField(policyName, 'varyHeaders', cleanHeaders(e.target.value))}
        />
      </label>

      <label className="cache-cdn-panel__field">
        <span className="cache-cdn-panel__field-label">Invalidation Group</span>
        <input
          type="text"
          className="field__input"
          value={policy.invalidationGroup}
          onChange={(e) => onSetField(policyName, 'invalidationGroup', e.target.value)}
        />
      </label>
    </div>
  );
}

function CachePageTypeDetail({
  pageTypeName,
  pageType,
  config,
  onSetField,
}: {
  pageTypeName: string;
  pageType: CacheCdnPanelPayload['config']['pageTypes'][string];
  config: CacheCdnPanelPayload['config'];
  onSetField: (pageTypeName: string, fieldName: string, value: unknown) => void;
}) {
  const patterns = listPageTypeTargets(config, pageTypeName);

  return (
    <div className="cache-cdn-panel__detail-form">
      <h3 className="cache-cdn-panel__detail-heading">{pageTypeName}</h3>

      <label className="cache-cdn-panel__field">
        <span className="cache-cdn-panel__field-label">Label</span>
        <input
          type="text"
          className="field__input"
          value={pageType.label}
          onChange={(e) => onSetField(pageTypeName, 'label', e.target.value)}
        />
      </label>

      <label className="cache-cdn-panel__field">
        <span className="cache-cdn-panel__field-label">Description</span>
        <input
          type="text"
          className="field__input"
          value={pageType.description}
          onChange={(e) => onSetField(pageTypeName, 'description', e.target.value)}
        />
      </label>

      <label className="cache-cdn-panel__field">
        <span className="cache-cdn-panel__field-label">Document Type</span>
        <select
          className="field__input"
          value={pageType.policy}
          onChange={(e) => onSetField(pageTypeName, 'policy', e.target.value)}
        >
          {CACHE_POLICY_NAMES.map((name) => (
            <option key={name} value={name}>{name}</option>
          ))}
        </select>
      </label>

      <div className="cache-cdn-panel__field">
        <span className="cache-cdn-panel__field-label">Assigned Routes</span>
        <div className="cache-cdn-panel__assigned-routes">
          {patterns.length > 0
            ? patterns.map((p, i) => <div key={i}>{p}</div>)
            : <span className="cache-cdn-panel__no-routes">No targets assigned</span>}
        </div>
      </div>
    </div>
  );
}

function CacheTargetDetail({
  targetIndex,
  target,
  onSetField,
}: {
  targetIndex: number;
  target: CacheCdnPanelPayload['config']['targets'][number];
  onSetField: (targetIndex: number, fieldName: string, value: unknown) => void;
}) {
  return (
    <div className="cache-cdn-panel__detail-form">
      <h3 className="cache-cdn-panel__detail-heading">{target.id}</h3>

      <label className="cache-cdn-panel__field">
        <span className="cache-cdn-panel__field-label">ID</span>
        <input
          type="text"
          className="field__input"
          value={target.id}
          onChange={(e) => onSetField(targetIndex, 'id', e.target.value)}
        />
      </label>

      <label className="cache-cdn-panel__field">
        <span className="cache-cdn-panel__field-label">Label</span>
        <input
          type="text"
          className="field__input"
          value={target.label}
          onChange={(e) => onSetField(targetIndex, 'label', e.target.value)}
        />
      </label>

      <label className="cache-cdn-panel__field">
        <span className="cache-cdn-panel__field-label">Page Type</span>
        <select
          className="field__input"
          value={target.pageType}
          onChange={(e) => onSetField(targetIndex, 'pageType', e.target.value)}
        >
          {CACHE_PAGE_TYPE_NAMES.map((name) => (
            <option key={name} value={name}>{name}</option>
          ))}
        </select>
      </label>

      <label className="cache-cdn-panel__field">
        <span className="cache-cdn-panel__field-label">Path Patterns</span>
        <textarea
          className="field__input cache-cdn-panel__patterns-textarea"
          rows={8}
          value={(target.pathPatterns ?? []).join('\n')}
          onChange={(e) => onSetField(targetIndex, 'pathPatterns', cleanPatterns(e.target.value) || ['/new-path/*'])}
        />
      </label>
    </div>
  );
}

// ── Ads panel ────────────────────────────────────────────────────────────

const ADS_COLLECTIONS = ['reviews', 'guides', 'news', 'games', 'brands', 'pages'] as const;
const ADS_PROVIDERS = ['adsense', 'direct'] as const;
const ADS_SAMPLE_MODES = ['mixed', 'svg', 'video'] as const;
const ADS_SAMPLE_NETWORKS = ['mixed', 'adsense', 'raptive', 'mediavine', 'ezoic'] as const;
const IAB_SIZE_PRESETS: Record<string, string> = {
  'Leaderboard': '728x90',
  'Medium Rectangle': '300x250',
  'Large Rectangle': '336x280',
  'Half Page': '300x600',
  'Billboard': '970x250',
  'Mobile Banner': '320x50',
  'Mobile Leaderboard': '320x100',
  'Large Mobile': '320x480',
  'Skyscraper': '300x400',
};
const WEIGHT_BAR_COLORS = [
  'var(--color-blue)', 'var(--color-green)', 'var(--color-peach)', 'var(--color-mauve)',
  'var(--color-teal)', 'var(--color-yellow)', 'var(--color-red)', 'var(--color-sapphire)',
];

type AdsTab = 'positions' | 'scanner' | 'inline' | 'sponsors' | 'dashboard';

interface AdsPanelViewProps {
  panel: AdsPanelPayload;
  onSetGlobalField: (field: string, value: unknown) => void;
  onSetPositionField: (name: string, field: string, value: unknown) => void;
  onAddPosition: (name: string, provider: string) => void;
  onDeletePosition: (name: string) => void;
  onDuplicatePosition: (sourceName: string, newName: string) => void;
  onSetInlineCollectionField: (collection: string, path: string, value: unknown) => void;
  onSetInlineDefaultsField: (field: string, value: unknown) => void;
  onAddCreative: (positionName: string) => void;
  onDeleteCreative: (positionName: string, index: number) => void;
  onSetCreativeField: (positionName: string, index: number, field: string, value: unknown) => void;
  onNormalizeWeights: (positionName: string) => void;
  onSetAdsEnabled: (enabled: boolean) => void;
  onScan: () => Promise<AdsScanResult>;
}

export function AdsPanelView({
  panel,
  onSetGlobalField,
  onSetPositionField,
  onAddPosition,
  onDeletePosition,
  onDuplicatePosition,
  onSetInlineCollectionField,
  onSetInlineDefaultsField,
  onAddCreative,
  onDeleteCreative,
  onSetCreativeField,
  onNormalizeWeights,
  onSetAdsEnabled,
  onScan,
}: AdsPanelViewProps) {
  const [activeTab, setActiveTab] = useState<AdsTab>('positions');
  const [selectedPosition, setSelectedPosition] = useState(() => {
    const names = Object.keys(panel.registry.positions);
    return names[0] ?? '';
  });
  const [positionFilter, setPositionFilter] = useState('');
  const [selectedCollection, setSelectedCollection] = useState<string>('reviews');
  const [sponsorPosition, setSponsorPosition] = useState('');
  const [selectedCreativeIndex, setSelectedCreativeIndex] = useState(0);
  const [newPosName, setNewPosName] = useState('');
  const [newPosProvider, setNewPosProvider] = useState<string>('adsense');
  const [showNewPosForm, setShowNewPosForm] = useState(false);
  const [duplicateName, setDuplicateName] = useState('');
  const [showDuplicateForm, setShowDuplicateForm] = useState(false);
  const [wordCount, setWordCount] = useState(2000);
  const [newSizeInput, setNewSizeInput] = useState('');
  const [scanResult, setScanResult] = useState<AdsScanResult | null>(null);
  const [scanLoading, setScanLoading] = useState(false);
  const [scanSortCol, setScanSortCol] = useState<string | null>(null);
  const [scanSortReverse, setScanSortReverse] = useState(false);

  const { registry, inline, sponsors } = panel;
  const positionNames = Object.keys(registry.positions);
  const filteredPositions = adsFilterPositions(positionNames, positionFilter);

  // Derive direct-only positions for sponsors tab
  const directPositions = positionNames.filter(
    (name) => registry.positions[name]?.provider === 'direct',
  );

  // Auto-select sponsor position
  useEffect(() => {
    if (!sponsorPosition || !directPositions.includes(sponsorPosition)) {
      setSponsorPosition(directPositions[0] ?? '');
    }
  }, [directPositions.join(',')]);

  // Clamp creative index
  const sponsorCreatives = sponsors.creatives[sponsorPosition] ?? [];
  useEffect(() => {
    if (selectedCreativeIndex >= sponsorCreatives.length) {
      setSelectedCreativeIndex(Math.max(0, sponsorCreatives.length - 1));
    }
  }, [sponsorCreatives.length, selectedCreativeIndex]);

  const tabs: { key: AdsTab; label: string }[] = [
    { key: 'positions', label: 'Positions' },
    { key: 'scanner', label: 'Scanner' },
    { key: 'inline', label: 'Inline Config' },
    { key: 'sponsors', label: 'Sponsors' },
    { key: 'dashboard', label: 'Dashboard' },
  ];

  const handleAddPosition = () => {
    if (!newPosName.trim()) return;
    onAddPosition(newPosName.trim(), newPosProvider);
    setNewPosName('');
    setShowNewPosForm(false);
    setSelectedPosition(newPosName.trim());
  };

  const handleDuplicate = () => {
    if (!selectedPosition) return;
    if (!showDuplicateForm) {
      setDuplicateName(selectedPosition + '_copy');
      setShowDuplicateForm(true);
      return;
    }
    if (!duplicateName.trim()) return;
    onDuplicatePosition(selectedPosition, duplicateName.trim());
    setSelectedPosition(duplicateName.trim());
    setShowDuplicateForm(false);
    setDuplicateName('');
  };

  return (
    <section className="ads-panel">
      {/* Globals bar */}
      <div className="ads-panel__globals-bar">
        <label className="ads-panel__global-field">
          <span className="ads-panel__global-label">Client ID</span>
          <input
            type="text"
            className="ads-panel__global-input ads-panel__global-input--wide"
            value={registry.global.adsenseClient}
            onChange={(e) => onSetGlobalField('adsenseClient', e.target.value)}
          />
        </label>
        <label className="ads-panel__global-field">
          <span className="ads-panel__global-label">Ad Label</span>
          <input
            type="text"
            className="ads-panel__global-input"
            value={registry.global.adLabel}
            onChange={(e) => onSetGlobalField('adLabel', e.target.value)}
            style={{ width: 60 }}
          />
        </label>
        <span className="ads-panel__global-divider" />
        <ToggleRow
          label="Enabled"
          checked={panel.adsEnabled}
          ariaLabel="Ads enabled"
          onChange={onSetAdsEnabled}
          className="ads-panel__global-field ads-panel__global-toggle"
        />
        <ToggleRow
          label="Placeholders"
          checked={registry.global.showProductionPlaceholders}
          ariaLabel="Production placeholders"
          onChange={(v) => onSetGlobalField('showProductionPlaceholders', v)}
          className="ads-panel__global-field ads-panel__global-toggle"
        />
        <ToggleRow
          label="Sample"
          checked={registry.global.loadSampleAds}
          ariaLabel="Load sample ads"
          onChange={(v) => onSetGlobalField('loadSampleAds', v)}
          className="ads-panel__global-field ads-panel__global-toggle"
        />
        <label className="ads-panel__global-field">
          <span className="ads-panel__global-label">Mode</span>
          <select
            className="ads-panel__global-select"
            value={registry.global.sampleAdMode}
            onChange={(e) => onSetGlobalField('sampleAdMode', e.target.value)}
          >
            {ADS_SAMPLE_MODES.map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
        </label>
        <label className="ads-panel__global-field">
          <span className="ads-panel__global-label">Network</span>
          <select
            className="ads-panel__global-select"
            value={registry.global.sampleAdNetwork}
            onChange={(e) => onSetGlobalField('sampleAdNetwork', e.target.value)}
          >
            {ADS_SAMPLE_NETWORKS.map((n) => (
              <option key={n} value={n}>{n}</option>
            ))}
          </select>
        </label>
      </div>

      {/* Tab bar */}
      <nav className="content-panel__main-tabs">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            className="content-panel__main-tab"
            data-active={activeTab === tab.key ? 'true' : undefined}
            onClick={() => setActiveTab(tab.key)}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      {/* Positions tab */}
      {activeTab === 'positions' && (
        <div className="ads-panel__master-detail">
          <div className="ads-panel__list-pane">
            <div className="ads-panel__filter-row">
              <input
                type="text"
                className="ads-panel__filter-input"
                placeholder="Filter..."
                value={positionFilter}
                onChange={(e) => setPositionFilter(e.target.value)}
              />
            </div>
            <div className="ads-panel__action-bar">
              <button type="button" className="token-button" onClick={() => setShowNewPosForm(!showNewPosForm)}>
                + New
              </button>
              <button
                type="button"
                className="token-button"
                onClick={handleDuplicate}
                disabled={!selectedPosition}
              >
                Copy
              </button>
              <button
                type="button"
                className="token-button"
                onClick={() => {
                  onDeletePosition(selectedPosition);
                  setSelectedPosition(positionNames.filter((n) => n !== selectedPosition)[0] ?? '');
                }}
                disabled={positionNames.length <= 1}
              >
                Delete
              </button>
            </div>
            {showNewPosForm && (
              <div className="ads-panel__new-pos-form">
                <input
                  type="text"
                  className="ads-panel__filter-input"
                  placeholder="position_name"
                  value={newPosName}
                  onChange={(e) => setNewPosName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAddPosition()}
                />
                <select
                  className="ads-panel__global-select"
                  value={newPosProvider}
                  onChange={(e) => setNewPosProvider(e.target.value)}
                >
                  {ADS_PROVIDERS.map((p) => <option key={p} value={p}>{p}</option>)}
                </select>
                <button type="button" className="token-button token-button--accent" onClick={handleAddPosition}>
                  Add
                </button>
              </div>
            )}
            {showDuplicateForm && (
              <div className="ads-panel__new-pos-form">
                <input
                  type="text"
                  className="ads-panel__filter-input"
                  placeholder="new_name"
                  value={duplicateName}
                  onChange={(e) => setDuplicateName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleDuplicate()}
                />
                <button type="button" className="token-button token-button--accent" onClick={handleDuplicate}>
                  Duplicate
                </button>
                <button type="button" className="token-button" onClick={() => setShowDuplicateForm(false)}>
                  Cancel
                </button>
              </div>
            )}
            {filteredPositions.map((name) => {
              const pos = registry.positions[name];
              return (
                <button
                  key={name}
                  type="button"
                  className="ads-panel__list-item"
                  data-active={name === selectedPosition ? '' : undefined}
                  onClick={() => setSelectedPosition(name)}
                >
                  <span className="ads-panel__list-item-row">
                    <span
                      className="ads-panel__position-dot"
                      data-on={pos?.display ? '' : undefined}
                    />
                    <span className="ads-panel__list-item-name">{name}</span>
                  </span>
                  <span className="ads-panel__list-item-sub">
                    <span className="ads-panel__provider-badge" data-provider={pos?.provider}>
                      {pos?.provider}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
          <div className="ads-panel__detail-pane">
            {registry.positions[selectedPosition] && (
              <AdsPositionDetail
                name={selectedPosition}
                position={registry.positions[selectedPosition]}
                onSetField={onSetPositionField}
                newSizeInput={newSizeInput}
                onNewSizeChange={setNewSizeInput}
              />
            )}
          </div>
        </div>
      )}

      {/* Scanner tab */}
      {activeTab === 'scanner' && (
        <div className="ads-panel__scanner-layout">
          <div className="ads-panel__scanner-toolbar">
            <button
              type="button"
              className="token-button token-button--accent"
              disabled={scanLoading}
              onClick={() => {
                setScanLoading(true);
                onScan()
                  .then((result) => setScanResult(result))
                  .catch(() => setScanResult(null))
                  .finally(() => setScanLoading(false));
              }}
            >
              {scanLoading ? 'Scanning...' : 'Scan src/'}
            </button>
            {scanResult && (
              <button
                type="button"
                className="token-button"
                onClick={() => {
                  const header = 'File\tLine\tPosition\tProvider\tDisplay';
                  const lines = scanResult.rows.map((r) =>
                    `${r.file}\t${r.line}\t${r.position}\t${r.provider}\t${r.display}`
                  );
                  navigator.clipboard.writeText([header, ...lines].join('\n'));
                }}
              >
                Copy All
              </button>
            )}
            <span className="ads-panel__scanner-status">
              {scanResult
                ? `Found ${scanResult.rows.length} reference${scanResult.rows.length !== 1 ? 's' : ''} in src/`
                : 'Click Scan to find ad positions in code'}
            </span>
          </div>

          {/* Scan results table */}
          <div className="ads-panel__scanner-table-wrap">
            <table className="ads-panel__scanner-table">
              <thead>
                <tr>
                  {(['file', 'line', 'position', 'provider', 'display'] as const).map((col) => {
                    const labels: Record<string, string> = {
                      file: 'File', line: 'Line', position: 'Position',
                      provider: 'Provider', display: 'Display',
                    };
                    const arrow = scanSortCol === col ? (scanSortReverse ? ' \u25bc' : ' \u25b2') : '';
                    return (
                      <th
                        key={col}
                        className="ads-panel__scanner-th"
                        onClick={() => {
                          if (scanSortCol === col) {
                            setScanSortReverse(!scanSortReverse);
                          } else {
                            setScanSortCol(col);
                            setScanSortReverse(false);
                          }
                        }}
                      >
                        {labels[col]}{arrow}
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {(() => {
                  const rows = scanResult?.rows ?? [];
                  if (rows.length === 0) {
                    return (
                      <tr>
                        <td colSpan={5} className="ads-panel__scanner-empty">
                          {scanResult ? 'No references found' : 'Run a scan to populate results'}
                        </td>
                      </tr>
                    );
                  }
                  const sorted = [...rows];
                  if (scanSortCol) {
                    sorted.sort((a, b) => {
                      const aVal = (a as Record<string, unknown>)[scanSortCol!];
                      const bVal = (b as Record<string, unknown>)[scanSortCol!];
                      if (scanSortCol === 'line') {
                        return scanSortReverse
                          ? (bVal as number) - (aVal as number)
                          : (aVal as number) - (bVal as number);
                      }
                      const cmp = String(aVal).toLowerCase().localeCompare(String(bVal).toLowerCase());
                      return scanSortReverse ? -cmp : cmp;
                    });
                  }
                  return sorted.map((row, i) => (
                    <tr
                      key={i}
                      className="ads-panel__scanner-row"
                      onDoubleClick={() => {
                        if (row.position in registry.positions) {
                          setSelectedPosition(row.position);
                          setActiveTab('positions');
                        }
                      }}
                    >
                      <td className="ads-panel__scanner-td ads-panel__scanner-td--file">{row.file}</td>
                      <td className="ads-panel__scanner-td ads-panel__scanner-td--center">{row.line}</td>
                      <td className="ads-panel__scanner-td">{row.position}</td>
                      <td className="ads-panel__scanner-td ads-panel__scanner-td--center">{row.provider}</td>
                      <td className="ads-panel__scanner-td ads-panel__scanner-td--center">{row.display}</td>
                    </tr>
                  ));
                })()}
              </tbody>
            </table>
          </div>

          {/* Orphan positions */}
          <div className="ads-panel__scanner-section">
            <h4 className="ads-panel__scanner-section-title">Unplaced Positions</h4>
            <p className="ads-panel__scanner-section-text" data-warn={scanResult?.orphans.length ? '' : undefined}>
              {!scanResult
                ? 'Run a scan to check which registry positions are not found in code.'
                : scanResult.orphans.length > 0
                  ? `${scanResult.orphans.length} position${scanResult.orphans.length !== 1 ? 's' : ''} not found in code: ${scanResult.orphans.join(', ')}`
                  : scanResult.rows.length > 0
                    ? 'All registry positions are placed in code.'
                    : 'No references found \u2014 ads not yet placed in any page.'}
            </p>
          </div>

          {/* Inline ads status */}
          <div className="ads-panel__scanner-section">
            <h4 className="ads-panel__scanner-section-title">Auto-Injected Inline Ads</h4>
            <p className="ads-panel__scanner-section-text">
              {(() => {
                const colls = inline.collections;
                const enabled = Object.keys(colls).filter((c) => colls[c]?.enabled);
                const disabled = Object.keys(colls).filter((c) => !colls[c]?.enabled);
                const parts: string[] = [];
                if (enabled.length) parts.push(`Enabled: ${enabled.join(', ')}`);
                if (disabled.length) parts.push(`Disabled: ${disabled.join(', ')}`);
                return parts.join('  |  ') || 'No collections configured.';
              })()}
            </p>
          </div>
        </div>
      )}

      {/* Inline Config tab */}
      {activeTab === 'inline' && (
        <div className="ads-panel__inline-layout">
          <div className="ads-panel__collection-pills">
            {ADS_COLLECTIONS.map((coll) => {
              const collCfg = inline.collections[coll];
              const isEnabled = collCfg?.enabled ?? false;
              return (
                <button
                  key={coll}
                  type="button"
                  className="ads-panel__collection-pill"
                  data-active={coll === selectedCollection ? '' : undefined}
                  onClick={() => setSelectedCollection(coll)}
                >
                  <span
                    className="ads-panel__position-dot"
                    data-on={isEnabled ? '' : undefined}
                  />
                  {coll}
                </button>
              );
            })}
          </div>
          <div className="ads-panel__inline-body">
            <AdsInlineCollectionEditor
              collection={selectedCollection}
              config={inline.collections[selectedCollection]}
              onSetField={onSetInlineCollectionField}
            />
            <div className="ads-panel__preview-calc">
              <h4 className="ads-panel__preview-calc-title">Preview Calculator</h4>
              <label className="ads-panel__field">
                <span className="ads-panel__field-label">Word count</span>
                <input
                  type="number"
                  className="ads-panel__field-input"
                  value={wordCount}
                  onChange={(e) => setWordCount(Number.parseInt(e.target.value, 10) || 0)}
                />
              </label>
              {inline.collections[selectedCollection] && (() => {
                const result = calculateInlineAds(wordCount, inline.collections[selectedCollection]);
                return (
                  <div className="ads-panel__preview-calc-result">
                    <span>Desktop: <strong>{result.desktop}</strong> ads</span>
                    <span>Mobile: <strong>{result.mobile}</strong> ads</span>
                  </div>
                );
              })()}
            </div>
          </div>
        </div>
      )}

      {/* Sponsors tab */}
      {activeTab === 'sponsors' && (
        <div className="ads-panel__master-detail">
          <div className="ads-panel__list-pane">
            {directPositions.length === 0 ? (
              <div className="ads-panel__placeholder-tab">
                <p>No positions with provider "direct".</p>
                <p>Set a position's provider to "direct" first.</p>
              </div>
            ) : (
              <>
                <label className="ads-panel__field" style={{ padding: '8px 14px' }}>
                  <span className="ads-panel__field-label">Position</span>
                  <select
                    className="ads-panel__global-select"
                    value={sponsorPosition}
                    onChange={(e) => {
                      setSponsorPosition(e.target.value);
                      setSelectedCreativeIndex(0);
                    }}
                  >
                    {directPositions.map((p) => <option key={p} value={p}>{p}</option>)}
                  </select>
                </label>
                <div className="ads-panel__action-bar">
                  <button type="button" className="token-button" onClick={() => onAddCreative(sponsorPosition)}>
                    + Add
                  </button>
                  <button
                    type="button"
                    className="token-button"
                    onClick={() => onDeleteCreative(sponsorPosition, selectedCreativeIndex)}
                    disabled={sponsorCreatives.length === 0}
                  >
                    Delete
                  </button>
                  <button
                    type="button"
                    className="token-button"
                    onClick={() => onNormalizeWeights(sponsorPosition)}
                    disabled={sponsorCreatives.length === 0}
                  >
                    Normalize
                  </button>
                </div>
                {sponsorCreatives.length > 0 && (() => {
                  const totalWeight = sponsorCreatives.reduce((sum, c) => sum + (c.weight || 0), 0);
                  const isBalanced = Math.abs(totalWeight - 100) < 0.1;
                  return (
                    <>
                      <div className="ads-panel__weight-bar">
                        {sponsorCreatives.map((c, i) => {
                          const w = c.weight || 0;
                          return (
                            <div
                              key={i}
                              className="ads-panel__weight-segment"
                              style={{
                                flex: `${Math.max(w, 2)} 0 0`,
                                background: WEIGHT_BAR_COLORS[i % WEIGHT_BAR_COLORS.length],
                              }}
                              title={`${c.label || `Creative ${i + 1}`}: ${w}%`}
                            />
                          );
                        })}
                      </div>
                      <div className="ads-panel__weight-sum" data-warn={!isBalanced ? '' : undefined}>
                        Total: {Math.round(totalWeight * 10) / 10}%
                      </div>
                    </>
                  );
                })()}
                {sponsorCreatives.map((creative, index) => {
                  const status = getCreativeStatus(creative);
                  return (
                    <button
                      key={index}
                      type="button"
                      className="ads-panel__list-item"
                      data-active={index === selectedCreativeIndex ? '' : undefined}
                      onClick={() => setSelectedCreativeIndex(index)}
                    >
                      <span className="ads-panel__list-item-row">
                        <span className="ads-panel__list-item-name">
                          {creative.label || `Creative ${index + 1}`}
                        </span>
                        <span className="ads-panel__creative-status" data-status={status}>
                          {status}
                        </span>
                      </span>
                    </button>
                  );
                })}
              </>
            )}
          </div>
          <div className="ads-panel__detail-pane">
            {sponsorCreatives[selectedCreativeIndex] && (
              <AdsSponsorDetail
                positionName={sponsorPosition}
                index={selectedCreativeIndex}
                creative={sponsorCreatives[selectedCreativeIndex]}
                onSetField={onSetCreativeField}
              />
            )}
          </div>
        </div>
      )}

      {/* Dashboard tab — deferred */}
      {activeTab === 'dashboard' && (
        <div className="ads-panel__placeholder-tab">
          <p>Post-launch analytics dashboard.</p>
          <p>Coming after site launch.</p>
        </div>
      )}
    </section>
  );
}

// ── Ads sub-components ──────────────────────────────────────────────────

function AdsPositionDetail({
  name,
  position,
  onSetField,
  newSizeInput,
  onNewSizeChange,
}: {
  name: string;
  position: AdsPanelPayload['registry']['positions'][string];
  onSetField: (name: string, field: string, value: unknown) => void;
  newSizeInput: string;
  onNewSizeChange: (v: string) => void;
}) {
  const sizes = adsParseSizes(position.sizes || '');
  const sizeStrings = (position.sizes || '').split(',').map((s) => s.trim()).filter(Boolean);

  const addSize = (sizeStr: string) => {
    const trimmed = sizeStr.trim();
    if (!/^\d+x\d+$/.test(trimmed)) return;
    if (sizeStrings.includes(trimmed)) return;
    onSetField(name, 'sizes', [...sizeStrings, trimmed].join(','));
    onNewSizeChange('');
  };

  const removeSize = (idx: number) => {
    const next = sizeStrings.filter((_, i) => i !== idx);
    onSetField(name, 'sizes', next.join(','));
  };

  return (
    <div className="ads-panel__detail-form">
      <h3 className="ads-panel__detail-heading">{name}</h3>

      <label className="ads-panel__field">
        <span className="ads-panel__field-label">Provider</span>
        <select
          className="ads-panel__global-select"
          value={position.provider}
          onChange={(e) => onSetField(name, 'provider', e.target.value)}
        >
          {ADS_PROVIDERS.map((p) => <option key={p} value={p}>{p}</option>)}
        </select>
      </label>

      <ToggleRow
        label="Display"
        checked={position.display}
        ariaLabel="Display position"
        onChange={(v) => onSetField(name, 'display', v)}
        className="ads-panel__field ads-panel__toggle-row"
      />

      {/* Provider-specific fields */}
      {position.provider === 'adsense' && (
        <label className="ads-panel__field">
          <span className="ads-panel__field-label">Ad Slot</span>
          <input
            type="text"
            className="ads-panel__field-input"
            value={position.adSlot ?? ''}
            onChange={(e) => onSetField(name, 'adSlot', e.target.value)}
          />
        </label>
      )}

      {position.provider === 'direct' && (
        <>
          <label className="ads-panel__field">
            <span className="ads-panel__field-label">Image URL</span>
            <input
              type="text"
              className="ads-panel__field-input"
              value={position.img ?? ''}
              onChange={(e) => onSetField(name, 'img', e.target.value)}
              placeholder="/images/ads/..."
            />
          </label>
          <label className="ads-panel__field">
            <span className="ads-panel__field-label">Link URL</span>
            <input
              type="text"
              className="ads-panel__field-input"
              value={position.href ?? ''}
              onChange={(e) => onSetField(name, 'href', e.target.value)}
              placeholder="https://..."
            />
          </label>
          <div className="ads-panel__field-row">
            <label className="ads-panel__field">
              <span className="ads-panel__field-label">Width</span>
              <input
                type="number"
                className="ads-panel__field-input ads-panel__field-input--small"
                value={position.width ?? 300}
                onChange={(e) => onSetField(name, 'width', Number.parseInt(e.target.value, 10) || 0)}
              />
            </label>
            <label className="ads-panel__field">
              <span className="ads-panel__field-label">Height</span>
              <input
                type="number"
                className="ads-panel__field-input ads-panel__field-input--small"
                value={position.height ?? 250}
                onChange={(e) => onSetField(name, 'height', Number.parseInt(e.target.value, 10) || 0)}
              />
            </label>
          </div>
        </>
      )}

      {/* Sizes — individual add/remove + IAB presets */}
      <div className="ads-panel__field">
        <span className="ads-panel__field-label">Sizes</span>
        <div className="ads-panel__sizes-editor">
          {sizes.map((s, i) => (
            <div key={i} className="ads-panel__size-row">
              <span className="ads-panel__size-pill">{s.width}×{s.height}</span>
              <button
                type="button"
                className="ads-panel__size-remove"
                onClick={() => removeSize(i)}
                title="Remove size"
              >
                ×
              </button>
            </div>
          ))}
          <div className="ads-panel__size-add-row">
            <input
              type="text"
              className="ads-panel__field-input ads-panel__field-input--small"
              placeholder="300x250"
              value={newSizeInput}
              onChange={(e) => onNewSizeChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  addSize(newSizeInput);
                }
              }}
            />
            <button
              type="button"
              className="token-button"
              onClick={() => addSize(newSizeInput)}
            >
              Add
            </button>
            <select
              className="ads-panel__global-select"
              value=""
              onChange={(e) => {
                if (e.target.value) addSize(e.target.value);
              }}
            >
              <option value="">IAB Preset...</option>
              {Object.entries(IAB_SIZE_PRESETS).map(([label, size]) => (
                <option key={size} value={size}>{label} ({size})</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="ads-panel__field">
        <span className="ads-panel__field-label">Placement</span>
        <div className="ads-panel__radio-group">
          <label className="ads-panel__radio-label">
            <input
              type="radio"
              name={`placement-${name}`}
              checked={(position.placementType ?? 'rail') === 'rail'}
              onChange={() => onSetField(name, 'placementType', 'rail')}
            />
            <span>Rail</span>
          </label>
          <label className="ads-panel__radio-label">
            <input
              type="radio"
              name={`placement-${name}`}
              checked={position.placementType === 'inline'}
              onChange={() => onSetField(name, 'placementType', 'inline')}
            />
            <span>Inline</span>
          </label>
        </div>
      </div>

      <label className="ads-panel__field">
        <span className="ads-panel__field-label">Notes</span>
        <textarea
          className="ads-panel__field-textarea"
          rows={3}
          value={position.notes}
          onChange={(e) => onSetField(name, 'notes', e.target.value)}
        />
      </label>
    </div>
  );
}

function AdsInlineCollectionEditor({
  collection,
  config,
  onSetField,
}: {
  collection: string;
  config: AdsPanelPayload['inline']['collections'][string] | undefined;
  onSetField: (collection: string, path: string, value: unknown) => void;
}) {
  if (!config) {
    return (
      <div className="ads-panel__inline-editor">
        <p className="ads-panel__muted">No configuration for "{collection}". It will use defaults.</p>
      </div>
    );
  }

  const hasDesktop = config.desktop !== undefined;
  const hasMobile = config.mobile !== undefined;

  return (
    <div className="ads-panel__inline-editor">
      <ToggleRow
        label="Enabled"
        checked={config.enabled}
        ariaLabel={`${collection} inline ads enabled`}
        onChange={(v) => onSetField(collection, 'enabled', v)}
        className="ads-panel__field ads-panel__toggle-row"
      />

      {config.enabled && hasDesktop && (
        <fieldset className="ads-panel__cadence-group">
          <legend>Desktop</legend>
          <label className="ads-panel__field">
            <span className="ads-panel__field-label">First after</span>
            <input
              type="number"
              className="ads-panel__field-input ads-panel__field-input--small"
              value={config.desktop!.firstAfter}
              onChange={(e) => onSetField(collection, 'desktop.firstAfter', Number.parseInt(e.target.value, 10) || 0)}
            />
            <span className="ads-panel__field-unit">§</span>
          </label>
          <label className="ads-panel__field">
            <span className="ads-panel__field-label">Every</span>
            <input
              type="number"
              className="ads-panel__field-input ads-panel__field-input--small"
              value={config.desktop!.every}
              onChange={(e) => onSetField(collection, 'desktop.every', Number.parseInt(e.target.value, 10) || 0)}
            />
            <span className="ads-panel__field-unit">§</span>
          </label>
          <label className="ads-panel__field">
            <span className="ads-panel__field-label">Max</span>
            <input
              type="number"
              className="ads-panel__field-input ads-panel__field-input--small"
              value={config.desktop!.max}
              onChange={(e) => onSetField(collection, 'desktop.max', Number.parseInt(e.target.value, 10) || 0)}
            />
          </label>
        </fieldset>
      )}

      {config.enabled && hasMobile && (
        <fieldset className="ads-panel__cadence-group">
          <legend>Mobile</legend>
          <label className="ads-panel__field">
            <span className="ads-panel__field-label">First after</span>
            <input
              type="number"
              className="ads-panel__field-input ads-panel__field-input--small"
              value={config.mobile!.firstAfter}
              onChange={(e) => onSetField(collection, 'mobile.firstAfter', Number.parseInt(e.target.value, 10) || 0)}
            />
            <span className="ads-panel__field-unit">§</span>
          </label>
          <label className="ads-panel__field">
            <span className="ads-panel__field-label">Every</span>
            <input
              type="number"
              className="ads-panel__field-input ads-panel__field-input--small"
              value={config.mobile!.every}
              onChange={(e) => onSetField(collection, 'mobile.every', Number.parseInt(e.target.value, 10) || 0)}
            />
            <span className="ads-panel__field-unit">§</span>
          </label>
          <label className="ads-panel__field">
            <span className="ads-panel__field-label">Max</span>
            <input
              type="number"
              className="ads-panel__field-input ads-panel__field-input--small"
              value={config.mobile!.max}
              onChange={(e) => onSetField(collection, 'mobile.max', Number.parseInt(e.target.value, 10) || 0)}
            />
          </label>
        </fieldset>
      )}

      {config.enabled && config.wordScaling && (
        <fieldset className="ads-panel__cadence-group">
          <legend>Word Scaling</legend>
          <ToggleRow
            label="Enable word scaling"
            checked={config.wordScaling.enabled}
            ariaLabel={`${collection} word scaling enabled`}
            onChange={(v) => onSetField(collection, 'wordScaling.enabled', v)}
            className="ads-panel__field ads-panel__toggle-row"
          />
          {config.wordScaling.enabled && (
            <>
              <label className="ads-panel__field">
                <span className="ads-panel__field-label">Desktop words/ad</span>
                <input
                  type="number"
                  className="ads-panel__field-input ads-panel__field-input--small"
                  value={config.wordScaling.desktopWordsPerAd}
                  onChange={(e) => onSetField(collection, 'wordScaling.desktopWordsPerAd', Number.parseInt(e.target.value, 10) || 0)}
                />
              </label>
              <label className="ads-panel__field">
                <span className="ads-panel__field-label">Mobile words/ad</span>
                <input
                  type="number"
                  className="ads-panel__field-input ads-panel__field-input--small"
                  value={config.wordScaling.mobileWordsPerAd}
                  onChange={(e) => onSetField(collection, 'wordScaling.mobileWordsPerAd', Number.parseInt(e.target.value, 10) || 0)}
                />
              </label>
              <label className="ads-panel__field">
                <span className="ads-panel__field-label">Min first words</span>
                <input
                  type="number"
                  className="ads-panel__field-input ads-panel__field-input--small"
                  value={config.wordScaling.minFirstAdWords}
                  onChange={(e) => onSetField(collection, 'wordScaling.minFirstAdWords', Number.parseInt(e.target.value, 10) || 0)}
                />
              </label>
            </>
          )}
        </fieldset>
      )}
    </div>
  );
}

function AdsSponsorDetail({
  positionName,
  index,
  creative,
  onSetField,
}: {
  positionName: string;
  index: number;
  creative: AdsPanelPayload['sponsors']['creatives'][string][number];
  onSetField: (positionName: string, index: number, field: string, value: unknown) => void;
}) {
  return (
    <div className="ads-panel__detail-form">
      <h3 className="ads-panel__detail-heading">{creative.label || `Creative ${index + 1}`}</h3>

      <label className="ads-panel__field">
        <span className="ads-panel__field-label">Label</span>
        <input
          type="text"
          className="ads-panel__field-input"
          value={creative.label}
          onChange={(e) => onSetField(positionName, index, 'label', e.target.value)}
        />
      </label>

      <label className="ads-panel__field">
        <span className="ads-panel__field-label">Image</span>
        <input
          type="text"
          className="ads-panel__field-input"
          value={creative.img}
          onChange={(e) => onSetField(positionName, index, 'img', e.target.value)}
        />
      </label>

      <label className="ads-panel__field">
        <span className="ads-panel__field-label">Click URL</span>
        <input
          type="text"
          className="ads-panel__field-input"
          value={creative.href}
          onChange={(e) => onSetField(positionName, index, 'href', e.target.value)}
        />
      </label>

      <div className="ads-panel__field-row">
        <label className="ads-panel__field">
          <span className="ads-panel__field-label">Width</span>
          <input
            type="number"
            className="ads-panel__field-input ads-panel__field-input--small"
            value={creative.width}
            onChange={(e) => onSetField(positionName, index, 'width', Number.parseInt(e.target.value, 10) || 0)}
          />
        </label>
        <label className="ads-panel__field">
          <span className="ads-panel__field-label">Height</span>
          <input
            type="number"
            className="ads-panel__field-input ads-panel__field-input--small"
            value={creative.height}
            onChange={(e) => onSetField(positionName, index, 'height', Number.parseInt(e.target.value, 10) || 0)}
          />
        </label>
        <label className="ads-panel__field">
          <span className="ads-panel__field-label">Weight %</span>
          <input
            type="number"
            className="ads-panel__field-input ads-panel__field-input--small"
            value={creative.weight}
            onChange={(e) => onSetField(positionName, index, 'weight', Number.parseFloat(e.target.value) || 0)}
          />
        </label>
      </div>

      <div className="ads-panel__field-row">
        <label className="ads-panel__field">
          <span className="ads-panel__field-label">Start Date</span>
          <input
            type="date"
            className="ads-panel__field-input"
            value={creative.startDate}
            onChange={(e) => onSetField(positionName, index, 'startDate', e.target.value)}
          />
        </label>
        <label className="ads-panel__field">
          <span className="ads-panel__field-label">End Date</span>
          <input
            type="date"
            className="ads-panel__field-input"
            value={creative.endDate}
            onChange={(e) => onSetField(positionName, index, 'endDate', e.target.value)}
          />
        </label>
      </div>

      <label className="ads-panel__field">
        <span className="ads-panel__field-label">Rel</span>
        <input
          type="text"
          className="ads-panel__field-input"
          value={creative.rel}
          onChange={(e) => onSetField(positionName, index, 'rel', e.target.value)}
        />
      </label>

      <label className="ads-panel__field">
        <span className="ads-panel__field-label">Alt Text</span>
        <input
          type="text"
          className="ads-panel__field-input"
          value={creative.alt}
          onChange={(e) => onSetField(positionName, index, 'alt', e.target.value)}
        />
      </label>
    </div>
  );
}

